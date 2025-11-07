import { api, type TranslationConfig } from './api';

/**
 * Rate Limit Configuration Interface
 */
interface RateLimitConfig {
  rpm: number; // Requests Per Minute
  tpm: number; // Tokens Per Minute
  maxConcurrent: number; // Maximum concurrent requests
  batchSize: number; // Batch size
}

/**
 * Request Queue Item Interface
 */
interface QueueItem {
  id: string;
  text: string;
  targetLanguage: string;
  priority: number;
  estimatedTokens: number;
  timestamp: number;
  resolve: (result: string) => void;
  reject: (error: any) => void;
}

/**
 * Translation Middleware - Provides transparent Chinese-English translation functionality (performance optimized version)
 *
 * Core features:
 * 1. Automatically translate Chinese input to English for Claude API
 * 2. Automatically translate Claude's English responses to Chinese for users
 * 3. Completely transparent to users
 * 4. Intelligent rate limit management (RPM: 1,000, TPM: 80,000)
 * 5. Request queue and batch processing optimization
 * 6. Intelligent caching and deduplication mechanism
 */
export class TranslationMiddleware {
  private config: TranslationConfig | null = null;
  private initialized = false;

  // Performance optimization related
  private rateLimitConfig: RateLimitConfig = {
    rpm: 950, // Slightly below 1,000 to leave safety margin
    tpm: 75000, // Slightly below 80,000 to leave safety margin
    maxConcurrent: 5, // Maximum concurrent requests
    batchSize: 10 // Batch size
  };

  // Rate limit tracking
  private requestTimes: number[] = [];
  private tokenUsage: Array<{ timestamp: number; tokens: number }> = [];
  private activeRequests = 0;

  // Request queue
  private translationQueue: QueueItem[] = [];
  private isProcessingQueue = false;

  // Intelligent cache
  private translationCache = new Map<string, { result: string; timestamp: number; tokens: number }>();
  private maxCacheSize = 1000;
  private cacheHitCount = 0;
  private cacheMissCount = 0;

  constructor() {
    this.init();
    this.startQueueProcessor();
    this.startCacheCleanup();
  }

  /**
   * Estimate the number of tokens in text (rough estimate)
   */
  private estimateTokens(text: string): number {
    // English: approximately 4 characters = 1 token
    // Chinese: approximately 1-2 characters = 1 token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars * 1.5 + otherChars / 4);
  }

  /**
   * Check if a request can be made (rate limiting)
   */
  private canMakeRequest(estimatedTokens: number): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean up expired request time records
    this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);
    this.tokenUsage = this.tokenUsage.filter(usage => usage.timestamp > oneMinuteAgo);

    // Check RPM limit
    if (this.requestTimes.length >= this.rateLimitConfig.rpm) {
      return false;
    }

    // Check TPM limit
    const currentTokenUsage = this.tokenUsage.reduce((sum, usage) => sum + usage.tokens, 0);
    if (currentTokenUsage + estimatedTokens > this.rateLimitConfig.tpm) {
      return false;
    }

    // Check concurrency limit
    if (this.activeRequests >= this.rateLimitConfig.maxConcurrent) {
      return false;
    }

    return true;
  }

  /**
   * Record request and token usage
   */
  private recordRequest(tokens: number): void {
    const now = Date.now();
    this.requestTimes.push(now);
    this.tokenUsage.push({ timestamp: now, tokens });
    this.activeRequests++;
  }

  /**
   * Complete request record
   */
  private completeRequest(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(text: string, targetLanguage: string): string {
    return `${targetLanguage}:${text.trim().toLowerCase()}`;
  }

  /**
   * Get translation result from cache
   */
  private getFromCache(text: string, targetLanguage: string): string | null {
    const key = this.getCacheKey(text, targetLanguage);
    const cached = this.translationCache.get(key);

    if (cached) {
      // Check if cache is expired (1 hour)
      if (Date.now() - cached.timestamp < 3600000) {
        this.cacheHitCount++;
        return cached.result;
      } else {
        this.translationCache.delete(key);
      }
    }

    this.cacheMissCount++;
    return null;
  }

  /**
   * Store to cache
   */
  private storeToCache(text: string, targetLanguage: string, result: string, tokens: number): void {
    const key = this.getCacheKey(text, targetLanguage);

    // If cache is full, delete the oldest entry
    if (this.translationCache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.translationCache.keys())[0];
      this.translationCache.delete(oldestKey);
    }

    this.translationCache.set(key, {
      result,
      timestamp: Date.now(),
      tokens
    });
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 1000); // Check queue every second
  }

  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
    }, 300000); // Clean expired cache every 5 minutes
  }

  /**
   * Clean up expired cache
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, value] of this.translationCache.entries()) {
      if (now - value.timestamp > 3600000) { // 1 hour expiration
        expired.push(key);
      }
    }

    expired.forEach(key => this.translationCache.delete(key));

    if (expired.length > 0) {
      console.log(`[TranslationMiddleware] Cleaned up ${expired.length} expired cache entries`);
    }
  }

  /**
   * Process translation queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.translationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Sort queue by priority
      this.translationQueue.sort((a, b) => b.priority - a.priority);

      // Collect items that can be batched
      const batchItems: QueueItem[] = [];
      let totalEstimatedTokens = 0;

      for (const item of this.translationQueue) {
        if (batchItems.length >= this.rateLimitConfig.batchSize) {
          break;
        }

        if (totalEstimatedTokens + item.estimatedTokens > this.rateLimitConfig.tpm / 4) {
          break; // Avoid single batch consuming too many tokens
        }

        if (this.canMakeRequest(item.estimatedTokens)) {
          batchItems.push(item);
          totalEstimatedTokens += item.estimatedTokens;
        } else {
          break; // Reached rate limit, stop processing
        }
      }

      if (batchItems.length > 0) {
        await this.processBatch(batchItems);

        // Remove processed items from queue
        this.translationQueue = this.translationQueue.filter(
          item => !batchItems.includes(item)
        );
      }
    } catch (error) {
      console.error('[TranslationMiddleware] Queue processing error:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process batch translation
   */
  private async processBatch(items: QueueItem[]): Promise<void> {
    if (items.length === 0) return;

    try {
      // Record request
      const totalTokens = items.reduce((sum, item) => sum + item.estimatedTokens, 0);
      this.recordRequest(totalTokens);

      // Deduplication - requests with same text and target language
      const uniqueItems = new Map<string, QueueItem[]>();

      for (const item of items) {
        const key = this.getCacheKey(item.text, item.targetLanguage);
        if (!uniqueItems.has(key)) {
          uniqueItems.set(key, []);
        }
        uniqueItems.get(key)!.push(item);
      }

      // Process each unique translation request
      for (const [, duplicateItems] of uniqueItems.entries()) {
        const firstItem = duplicateItems[0];

        try {
          // Check cache
          let result = this.getFromCache(firstItem.text, firstItem.targetLanguage);

          if (!result) {
            // Perform translation
            result = await api.translateText(firstItem.text, firstItem.targetLanguage);

            // Store to cache
            if (result) {
              this.storeToCache(firstItem.text, firstItem.targetLanguage, result, firstItem.estimatedTokens);
            }
          }

          // Resolve all duplicate requests
          if (result) {
            duplicateItems.forEach(item => item.resolve(result!));
          } else {
            duplicateItems.forEach(item => item.reject(new Error('Translation failed')));
          }

        } catch (error) {
          // Reject all duplicate requests
          duplicateItems.forEach(item => item.reject(error));
        }
      }

    } catch (error) {
      // Reject all items
      items.forEach(item => item.reject(error));
    } finally {
      this.completeRequest();
    }
  }

  /**
   * Optimized queued translation method
   */
  private async queueTranslation(
    text: string,
    targetLanguage: string,
    priority: number = 1
  ): Promise<string> {
    // Check cache
    const cachedResult = this.getFromCache(text, targetLanguage);
    if (cachedResult) {
      return cachedResult;
    }

    return new Promise<string>((resolve, reject) => {
      const queueItem: QueueItem = {
        id: `${Date.now()}-${Math.random()}`,
        text,
        targetLanguage,
        priority,
        estimatedTokens: this.estimateTokens(text),
        timestamp: Date.now(),
        resolve,
        reject
      };

      // Add to queue
      this.translationQueue.push(queueItem);

      // If can process immediately, trigger queue processing
      if (this.canMakeRequest(queueItem.estimatedTokens) && !this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Configure rate limits (adjust based on API quota)
   */
  public configureRateLimits(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = {
      ...this.rateLimitConfig,
      ...config
    };

    console.log('[TranslationMiddleware] Rate limits updated:', this.rateLimitConfig);
  }

  /**
   * Get performance statistics
   */
  public getPerformanceStats(): {
    queueLength: number;
    activeRequests: number;
    cacheSize: number;
    cacheHitRate: number;
    rateLimits: RateLimitConfig;
    tokenUsageLastMinute: number;
    requestsLastMinute: number;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const recentTokenUsage = this.tokenUsage
      .filter(usage => usage.timestamp > oneMinuteAgo)
      .reduce((sum, usage) => sum + usage.tokens, 0);

    const recentRequests = this.requestTimes.filter(time => time > oneMinuteAgo).length;

    const totalCacheAccess = this.cacheHitCount + this.cacheMissCount;
    const cacheHitRate = totalCacheAccess > 0 ? this.cacheHitCount / totalCacheAccess : 0;

    return {
      queueLength: this.translationQueue.length,
      activeRequests: this.activeRequests,
      cacheSize: this.translationCache.size,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      rateLimits: this.rateLimitConfig,
      tokenUsageLastMinute: recentTokenUsage,
      requestsLastMinute: recentRequests
    };
  }

  /**
   * Initialize translation middleware
   */
  private async init(): Promise<void> {
    try {
      this.config = await api.getTranslationConfig();
      this.initialized = true;
      console.log('[TranslationMiddleware] ✅ Initialized with saved config:', {
        enabled: this.config.enabled,
        model: this.config.model,
        hasApiKey: !!this.config.api_key
      });
    } catch (error) {
      console.warn('[TranslationMiddleware] ⚠️ Failed to load saved config, using default:', error);
      this.config = {
        enabled: true,  // 🔧 Fix: Enable translation by default
        api_base_url: "https://api.siliconflow.cn/v1",
        api_key: "sk-ednywbvnfwerfcxnqjkmnhxvgcqoyuhmjvfywrshpxsgjbzm",
        model: "tencent/Hunyuan-MT-7B",
        timeout_seconds: 30,
        cache_ttl_seconds: 3600,
      };
      this.initialized = true;
      console.log('[TranslationMiddleware] ✅ Initialized with default config (translation enabled)');
    }
  }

  /**
   * Ensure middleware is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Check if translation is enabled
   */
  public async isEnabled(): Promise<boolean> {
    await this.ensureInitialized();
    return this.config?.enabled ?? false;
  }

  /**
   * Detect text language
   */
  public async detectLanguage(text: string): Promise<string> {
    try {
      return await api.detectTextLanguage(text);
    } catch (error) {
      console.error('[TranslationMiddleware] Language detection failed:', error);
      // Use stronger Chinese-English detection fallback
      return this.detectChineseContent(text) ? 'zh' : 'en';
    }
  }

  /**
   * Improved Chinese content detection, smarter handling of mixed content
   */
  private detectChineseContent(text: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }

    // Extended Chinese character range matching
    const chineseChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g);

    if (!chineseChars) {
      return false;
    }

    // Simplified preprocessing: only remove obvious non-Chinese content
    const preprocessedText = text
      // Keep Chinese punctuation and full-width characters
      // Remove obvious URLs
      .replace(/https?:\/\/[^\s\u4e00-\u9fff]+/g, ' ')
      // Remove Windows paths (but keep paths containing Chinese)
      .replace(/[a-zA-Z]:[\\\//](?![\s\S]*[\u4e00-\u9fff])[^\s]+/g, ' ')
      // Remove pure English error prefixes (but keep error messages containing Chinese)
      .replace(/^\s*(error|warning|info|debug):\s*(?![\s\S]*[\u4e00-\u9fff])/gmi, ' ')
      // Remove pure English code blocks
      .replace(/```(?![\s\S]*[\u4e00-\u9fff])[\s\S]*?```/g, ' ')
      // Remove pure English inline code
      .replace(/`(?![^`]*[\u4e00-\u9fff])[^`]+`/g, ' ')
      // Remove email addresses
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Recalculate Chinese characters
    const finalChineseChars = preprocessedText.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g);
    const totalLength = preprocessedText.length;
    const chineseCount = finalChineseChars?.length || 0;

    console.log('[TranslationMiddleware] Chinese detection analysis:', {
      originalLength: text.length,
      processedLength: totalLength,
      chineseCount,
      originalChineseCount: chineseChars.length,
      textPreview: text.slice(0, 100)
    });

    // 🔧 Optimization: More lenient Chinese detection logic
    // 1. If there is 1 or more Chinese characters, it may be Chinese (suitable for short text)
    // 2. For longer text, require Chinese characters to reach a certain ratio
    // 3. Special handling: If Chinese character count is sufficient, directly consider as Chinese
    if (chineseCount >= 1) {
      const ratio = totalLength > 0 ? chineseCount / totalLength : 1;
      const originalRatio = text.length > 0 ? chineseChars.length / text.length : 0;

      // Short text: If there are Chinese characters, consider as Chinese
      if (text.length <= 20 && chineseCount >= 1) {
        return true;
      }

      // Long text: Require certain ratio, or sufficient Chinese character count
      return ratio >= 0.1 || originalRatio >= 0.08 || chineseCount >= 5;
    }

    return false;
  }

  /**
   * Detect if it is a slash command
   * 
   * @param text Input text
   * @returns Whether it is a slash command
   */
  private isSlashCommand(text: string): boolean {
    const trimmedText = text.trim();
    
    // Check if starts with slash
    if (!trimmedText.startsWith('/')) {
      return false;
    }
    
    // Exclude double slash comments (like // comment)
    if (trimmedText.startsWith('//')) {
      return false;
    }
    
    // Exclude direct URLs (entire string is URL)
    if (trimmedText.match(/^https?:\/\/|^ftp:\/\/|^file:\/\/|^\/\//)) {
      return false;
    }
    
    return true;
  }

  /**
   * Translate user input (Chinese->English)
   *
   * Call this method before sending to Claude API
   * If input is Chinese, translate to English
   * If input is already English or translation is not enabled, return original text
   *
   * Special handling:
   * - Skip translation for slash commands (commands starting with /), pass as is
   * - Enhanced robustness of slash command detection, avoid misjudging URLs, etc.
   *
   * @param userInput User's original input text
   * @returns Processed text (translated English or original text)
   */
  public async translateUserInput(userInput: string): Promise<{
    translatedText: string;
    originalText: string;
    wasTranslated: boolean;
    detectedLanguage: string;
  }> {
    await this.ensureInitialized();

    // Check if it is a slash command - if so, return original without translation
    if (this.isSlashCommand(userInput)) {
      const trimmedInput = userInput.trim();
      const commandPreview = trimmedInput.split('\n')[0];
      console.log('[TranslationMiddleware] ✅ Detected slash command, skipping translation:', {
        command: commandPreview,
        originalLength: userInput.length,
        trimmedLength: trimmedInput.length
      });
      
      // For slash commands, we still detect language but do not translate
      const detectedLang = await this.detectLanguage(userInput);
      return {
        translatedText: userInput,
        originalText: userInput,
        wasTranslated: false,
        detectedLanguage: detectedLang,
      };
    }

    // Check if translation is enabled
    if (!this.config?.enabled) {
      const detectedLang = await this.detectLanguage(userInput);
      return {
        translatedText: userInput,
        originalText: userInput,
        wasTranslated: false,
        detectedLanguage: detectedLang,
      };
    }

    try {
      // Detect language
      const detectedLanguage = await this.detectLanguage(userInput);
      console.log('[TranslationMiddleware] Detected input language:', detectedLanguage);

      // Improved Chinese detection strategy: Use both language code detection and content detection simultaneously
      const isChineseByCode = detectedLanguage?.toLowerCase().startsWith('zh');
      const isChineseByContent = this.detectChineseContent(userInput);

      // Prioritize content detection as it is more accurate
      const isAsciiOnly = /^[\u0000-\u007F]*$/.test(userInput);
      const shouldTranslate = isChineseByContent || (isChineseByCode && !isAsciiOnly);

      console.log('[TranslationMiddleware] Enhanced language analysis:', {
        detectedLanguage,
        isChineseByCode,
        isChineseByContent,
        shouldTranslate,
        inputLength: userInput.length,
        inputPreview: userInput.slice(0, 100)
      });

      // If Chinese is detected, use queued translation to English
      if (shouldTranslate) {
        console.log('[TranslationMiddleware] 🎯 Chinese content detected, initiating translation to English...');

        try {
          const translatedText = await this.queueTranslation(userInput, 'en', 3); // High priority

          // Verify translation result is not empty and not equal to original
          if (translatedText && translatedText.trim() !== userInput.trim()) {
            console.log('[TranslationMiddleware] ✅ Translation successful:', {
              originalLength: userInput.length,
              translatedLength: translatedText.length,
              preview: {
                original: userInput.slice(0, 50),
                translated: translatedText.slice(0, 50)
              }
            });

            return {
              translatedText,
              originalText: userInput,
              wasTranslated: true,
              detectedLanguage,
            };
          } else {
            console.warn('[TranslationMiddleware] ⚠️ Translation returned empty or unchanged result, using original text');
          }
        } catch (error) {
          console.error('[TranslationMiddleware] ❌ Translation failed:', error);
        }
      }

      // If already English or other language, return as is
      return {
        translatedText: userInput,
        originalText: userInput,
        wasTranslated: false,
        detectedLanguage,
      };
    } catch (error) {
      console.error('[TranslationMiddleware] Failed to translate user input:', error);
      // Fallback strategy: Return original text on translation failure
      const detectedLang = await this.detectLanguage(userInput);
      return {
        translatedText: userInput,
        originalText: userInput,
        wasTranslated: false,
        detectedLanguage: detectedLang,
      };
    }
  }

  /**
   * Translate Claude response (English->Chinese)
   *
   * Call this method before displaying Claude response to user
   * If response is English and user original input was Chinese, translate to Chinese
   * If translation is not enabled or user input was originally English, return original text
   *
   * @param claudeResponse Response text returned by Claude API
   * @param userInputWasChinese Whether user's original input was Chinese (used to decide if response needs translation)
   * @returns Processed response text (translated Chinese or original text)
   */
  public async translateClaudeResponse(
    claudeResponse: string,
    _userInputWasChinese: boolean = false  // 🔧 Parameter kept for API compatibility, currently unused
  ): Promise<{
    translatedText: string;
    originalText: string;
    wasTranslated: boolean;
    detectedLanguage: string;
  }> {
    await this.ensureInitialized();

    // 🔧 Prevent duplicate translation: Check if content is too short or empty
    if (!claudeResponse || claudeResponse.trim().length === 0) {
      console.log('[TranslationMiddleware] ⚠️ Empty or whitespace-only response, skipping translation');
      return {
        translatedText: claudeResponse,
        originalText: claudeResponse,
        wasTranslated: false,
        detectedLanguage: 'unknown',
      };
    }

    // 🔧 Prevent duplicate translation: Check if content is too short (content with less than 3 characters usually doesn't need translation)
    if (claudeResponse.trim().length < 3) {
      console.log('[TranslationMiddleware] ⚠️ Very short response, skipping translation:', claudeResponse.trim());
      return {
        translatedText: claudeResponse,
        originalText: claudeResponse,
        wasTranslated: false,
        detectedLanguage: 'short',
      };
    }

    // Check if translation is enabled
    if (!this.config?.enabled) {
      const detectedLang = await this.detectLanguage(claudeResponse);
      return {
        translatedText: claudeResponse,
        originalText: claudeResponse,
        wasTranslated: false,
        detectedLanguage: detectedLang,
      };
    }

    try {
      // Detect response language
      const detectedLanguage = await this.detectLanguage(claudeResponse);
      console.log('[TranslationMiddleware] 🔍 Detected response language:', {
        language: detectedLanguage,
        contentLength: claudeResponse.length,
        preview: claudeResponse.substring(0, 50) + (claudeResponse.length > 50 ? '...' : '')
      });

       // 🔧 Optimization: Only translate responses confirmed to be English
       if (detectedLanguage === 'en') {
         console.log('[TranslationMiddleware] 🎯 Queuing English response for Chinese translation...');

         try {
           const translatedText = await this.queueTranslation(claudeResponse, 'zh', 2); // Medium priority

           console.log('[TranslationMiddleware] ✅ Response translation successful:', {
             originalLength: claudeResponse.length,
             translatedLength: translatedText.length,
             originalPreview: claudeResponse.substring(0, 50) + '...',
             translatedPreview: translatedText.substring(0, 50) + '...'
           });

           return {
             translatedText,
             originalText: claudeResponse,
             wasTranslated: true,
             detectedLanguage,
           };
         } catch (translationError) {
           console.error('[TranslationMiddleware] ❌ Translation queue failed:', translationError);
           // On translation failure, return original text without throwing error
           return {
             translatedText: claudeResponse,
             originalText: claudeResponse,
             wasTranslated: false,
             detectedLanguage,
           };
         }
       }

       // If response is already Chinese or other language, return original text
       console.log('[TranslationMiddleware] ⏭️ Content not English, returning original text');
       return {
         translatedText: claudeResponse,
         originalText: claudeResponse,
         wasTranslated: false,
         detectedLanguage,
       };
    } catch (error) {
      console.error('[TranslationMiddleware] ❌ Failed to translate Claude response:', error);
      // Fallback strategy: Return original text on translation failure
      const detectedLang = await this.detectLanguage(claudeResponse);
      return {
        translatedText: claudeResponse,
        originalText: claudeResponse,
        wasTranslated: false,
        detectedLanguage: detectedLang,
      };
    }
  }

  /**
   * Batch translate texts (for processing multiple messages) - Performance optimized version
   * Uses queued processing and intelligent deduplication
   */
  public async translateBatch(
    texts: string[],
    targetLanguage: string = 'zh'
  ): Promise<string[]> {
    await this.ensureInitialized();

    if (!this.config?.enabled) {
      return texts;
    }

    try {
      // Filter empty texts
      const validTexts = texts.filter(text => text && text.trim().length > 0);

      if (validTexts.length === 0) {
        return texts;
      }

      console.log(`[TranslationMiddleware] Processing batch translation for ${validTexts.length} texts`);

      // Use Promise.all for parallel processing, queue system automatically manages rate limits
      const translationPromises = validTexts.map((text) =>
        this.queueTranslation(text, targetLanguage, 1) // Standard priority
      );

      const translatedTexts = await Promise.all(translationPromises);

      // Reassemble results, maintain original array structure
      const results: string[] = [];
      let translatedIndex = 0;

      for (const originalText of texts) {
        if (originalText && originalText.trim().length > 0) {
          results.push(translatedTexts[translatedIndex++]);
        } else {
          results.push(originalText); // Keep empty texts unchanged
        }
      }

      const stats = this.getPerformanceStats();
      console.log(`[TranslationMiddleware] Batch translation completed. Performance stats:`, {
        queueLength: stats.queueLength,
        cacheHitRate: stats.cacheHitRate,
        tokenUsageLastMinute: stats.tokenUsageLastMinute
      });

      return results;

    } catch (error) {
      console.error('[TranslationMiddleware] Batch translation failed:', error);
      return texts; // Fallback strategy: Return original texts
    }
  }

  /**
   * Update translation configuration
   */
  public async updateConfig(config: TranslationConfig): Promise<void> {
    try {
      await api.updateTranslationConfig(config);
      this.config = config;
      console.log('[TranslationMiddleware] Configuration updated:', config);
    } catch (error) {
      console.error('[TranslationMiddleware] Failed to update configuration:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  public async getConfig(): Promise<TranslationConfig> {
    await this.ensureInitialized();
    return this.config!;
  }

  /**
   * Enable/disable translation functionality
   */
  public async setEnabled(enabled: boolean): Promise<void> {
    await this.ensureInitialized();
    if (this.config) {
      this.config.enabled = enabled;
      await this.updateConfig(this.config);
    }
  }

  /**
   * Clear translation cache
   */
  public async clearCache(): Promise<void> {
    try {
      await api.clearTranslationCache();
      console.log('[TranslationMiddleware] Cache cleared');
    } catch (error) {
      console.error('[TranslationMiddleware] Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    activeEntries: number;
  }> {
    try {
      const stats = await api.getTranslationCacheStats();
      return {
        totalEntries: stats.total_entries,
        expiredEntries: stats.expired_entries,
        activeEntries: stats.active_entries,
      };
    } catch (error) {
      console.error('[TranslationMiddleware] Failed to get cache stats:', error);
      throw error;
    }
  }

  /**
   * Translate error messages or status messages (for UI feedback)
   * Specifically for translating error messages, notification messages, etc. for UI feedback
   */
  public async translateErrorMessage(message: string): Promise<string> {
    await this.ensureInitialized();

    if (!this.config?.enabled || !message || message.trim().length === 0) {
      return message;
    }

    try {
      // Detect language, translate to Chinese if English
      const detectedLanguage = await this.detectLanguage(message);

      if (detectedLanguage === 'en') {
        const result = await this.queueTranslation(message, 'zh', 2); // Medium priority
        return result || message;
      }

      return message;
    } catch (error) {
      console.error('[TranslationMiddleware] Failed to translate error message:', error);
      return message; // Return original message on failure
    }
  }

  /**
   * Batch translate error messages
   */
  public async translateErrorMessages(messages: string[]): Promise<string[]> {
    await this.ensureInitialized();

    if (!this.config?.enabled) {
      return messages;
    }

    try {
      const translationPromises = messages.map(message =>
        this.translateErrorMessage(message)
      );

      return await Promise.all(translationPromises);
    } catch (error) {
      console.error('[TranslationMiddleware] Failed to translate error messages:', error);
      return messages;
    }
  }
}

// Export singleton instance
export const translationMiddleware = new TranslationMiddleware();

/**
 * Utility function: Detect if it is a slash command
 * Can be used in other components to ensure consistency of detection logic
 * 
 * @param text Input text
 * @returns Whether it is a slash command
 */
export function isSlashCommand(text: string): boolean {
  const trimmedText = text.trim();
  
  // Check if starts with slash
  if (!trimmedText.startsWith('/')) {
    return false;
  }
  
  // Exclude double slash comments (like // comment)
  if (trimmedText.startsWith('//')) {
    return false;
  }
  
  // Exclude direct URLs (entire string is URL)
  if (trimmedText.match(/^https?:\/\/|^ftp:\/\/|^file:\/\/|^\/\//)) {
    return false;
  }
  
  return true;
}

/**
 * Translation result interface
 */
export interface TranslationResult {
  translatedText: string;
  originalText: string;
  wasTranslated: boolean;
  detectedLanguage: string;
}

/**
 * Translation middleware status interface
 */
export interface TranslationStatus {
  enabled: boolean;
  cacheEntries: number;
  lastError?: string;
}
