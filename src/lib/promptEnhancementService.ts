/**
 * Prompt Enhancement Service
 * Supports multiple third-party API providers (OpenAI, Deepseek, Qwen, etc.)
 *
 * ⚡ Uses Tauri HTTP client to bypass CORS restrictions
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export interface PromptEnhancementProvider {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  enabled: boolean;
  apiFormat?: 'openai' | 'gemini';  // ⚡ New: API format type
}

export interface PromptEnhancementConfig {
  providers: PromptEnhancementProvider[];
  lastUsedProviderId?: string;
}

const STORAGE_KEY = 'prompt_enhancement_providers';
const ENCRYPTION_KEY = 'prompt_enhancement_encryption_salt';

/**
 * Preset provider templates
 */
export const PRESET_PROVIDERS = {
  openai: {
    name: 'OpenAI GPT-4',
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiFormat: 'openai' as const,
    // ⚡ Do not set temperature and maxTokens, let API use default values
  },
  deepseek: {
    name: 'Deepseek Chat',
    apiUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    apiFormat: 'openai' as const,
  },
  qwen: {
    name: 'Qwen Max',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-max',
    apiFormat: 'openai' as const,
  },
  siliconflow: {
    name: 'SiliconFlow Qwen',
    apiUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    apiFormat: 'openai' as const,
  },
  gemini: {
    name: 'Google Gemini 2.0',
    apiUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.0-flash-exp',
    apiFormat: 'gemini' as const,
  },
};

/**
 * Simple XOR encryption (frontend basic protection, not truly secure encryption)
 */
function simpleEncrypt(text: string, salt: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
  }
  return btoa(result);
}

function simpleDecrypt(encrypted: string, salt: string): string {
  try {
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
    }
    return result;
  } catch {
    return '';
  }
}

/**
 * Get or create encryption salt
 */
function getEncryptionSalt(): string {
  let salt = localStorage.getItem(ENCRYPTION_KEY);
  if (!salt) {
    salt = Math.random().toString(36).substring(2, 15);
    localStorage.setItem(ENCRYPTION_KEY, salt);
  }
  return salt;
}

/**
 * Load config
 */
export function loadConfig(): PromptEnhancementConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { providers: [] };
    }
    
    const config = JSON.parse(stored) as PromptEnhancementConfig;
    const salt = getEncryptionSalt();
    
    // Decrypt API Key
    config.providers = config.providers.map(p => ({
      ...p,
      apiKey: simpleDecrypt(p.apiKey, salt),
    }));
    
    return config;
  } catch (error) {
    console.error('[PromptEnhancement] Failed to load config:', error);
    return { providers: [] };
  }
}

/**
 * Save config
 */
export function saveConfig(config: PromptEnhancementConfig): void {
  try {
    const salt = getEncryptionSalt();
    
    // Encrypt API Key before saving
    const encryptedConfig = {
      ...config,
      providers: config.providers.map(p => ({
        ...p,
        apiKey: simpleEncrypt(p.apiKey, salt),
      })),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encryptedConfig));
  } catch (error) {
    console.error('[PromptEnhancement] Failed to save config:', error);
  }
}

/**
 * Call OpenAI format API
 */
async function callOpenAIFormat(
  provider: PromptEnhancementProvider,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // ⚡ Only include required fields, optional params added by user if needed
  const requestBody: any = {
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    stream: false  // 🔧 Explicitly disable streaming response
  };

  // Only add optional params if set by user
  if (provider.temperature !== undefined && provider.temperature !== null) {
    requestBody.temperature = provider.temperature;
  }
  if (provider.maxTokens !== undefined && provider.maxTokens !== null) {
    requestBody.max_tokens = provider.maxTokens;
  }

  // ⚡ Fix: handle trailing slash in apiUrl
  const baseUrl = provider.apiUrl.endsWith('/') ? provider.apiUrl.slice(0, -1) : provider.apiUrl;

  // ⚡ Use Tauri HTTP client to bypass CORS
  const response = await tauriFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`Failed to parse API response: ${parseError}`);
  }

  // Check response data integrity
  if (!data.choices || data.choices.length === 0) {
    if (data.error) {
      throw new Error(`API error: ${JSON.stringify(data.error)}`);
    }
    throw new Error(`API returned no choices`);
  }

  const choice = data.choices[0];
  if (!choice.message) {
    throw new Error(`Choice has no message`);
  }

  const content = choice.message.content;
  if (!content || content.trim() === '') {
    if (choice.finish_reason) {
      throw new Error(`Content is empty. Finish reason: ${choice.finish_reason}`);
    }
    throw new Error('API returned empty content');
  }

  return content.trim();
}

/**
 * Call Gemini format API
 */
async function callGeminiFormat(
  provider: PromptEnhancementProvider,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const requestBody: any = {
    contents: [
      {
        parts: [
          { text: systemPrompt + '\n\n' + userPrompt }
        ]
      }
    ],
  };
  
  // ⚡ Only add optional params if set by user
  const generationConfig: any = {};
  if (provider.temperature !== undefined && provider.temperature !== null) {
    generationConfig.temperature = provider.temperature;
  }
  if (provider.maxTokens !== undefined && provider.maxTokens !== null) {
    generationConfig.maxOutputTokens = provider.maxTokens;
  }
  
  // Only add generationConfig if configured
  if (Object.keys(generationConfig).length > 0) {
    requestBody.generationConfig = generationConfig;
  }

  // ⚡ Fix: handle trailing slash in apiUrl, avoid double slashes
  const baseUrl = provider.apiUrl.endsWith('/') ? provider.apiUrl.slice(0, -1) : provider.apiUrl;

  // Gemini API format: /v1beta/models/{model}:generateContent
  const endpoint = `${baseUrl}/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;

  // ⚡ Use Tauri HTTP client to bypass CORS
  const response = await tauriFetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error('Gemini API returned empty response');
  }

  return content.trim();
}

/**
 * Call prompt enhancement API (supports multiple formats)
 */
export async function callEnhancementAPI(
  provider: PromptEnhancementProvider,
  prompt: string,
  context?: string[]
): Promise<string> {
  const systemPrompt = `You are a professional prompt enhancement assistant, specializing in optimizing user prompts for the Claude Code programming assistant.

[Optimization Goals]
1. Preserve the user's original intent and core requirements
2. Make the prompt clearer, more specific, and more structured
3. Supplement necessary technical details based on conversation context
4. Use accurate technical terminology and avoid ambiguity

[Optimization Principles]
- ✅ Maintain technicality and practicality
- ✅ Only optimize expression, do not change core requirements
- ✅ If the user's intent is already clear, only make minor adjustments
- ❌ Do not add role-playing (e.g., "Please act as...")
- ❌ Do not add excessive polite or formal language
- ❌ Do not change the type of question (e.g., do not turn a technical question into an analysis report)
- ❌ Do not add extra tasks not requested by the user

${context && context.length > 0 ? `\n[Current Conversation Context]\n${context.join('\n')}\n` : ''}

[Output Requirements]
Return only the optimized prompt, do not add any explanations, comments, or meta information.`;

  const userPrompt = `Please optimize the following prompt:\n\n${prompt}`;

  console.log('[PromptEnhancement] Calling API:', provider.name, provider.apiFormat || 'openai');

  try {
    // Call different functions based on API format
    if (provider.apiFormat === 'gemini') {
      return await callGeminiFormat(provider, systemPrompt, userPrompt);
    } else {
      // Default to OpenAI format
      return await callOpenAIFormat(provider, systemPrompt, userPrompt);
    }
  } catch (error) {
    console.error('[PromptEnhancement] API call failed:', error);
    throw error;
  }
}

/**
 * Test API connection
 */
export async function testAPIConnection(provider: PromptEnhancementProvider): Promise<{
  success: boolean;
  message: string;
  latency?: number;
}> {
  const startTime = Date.now();
  
  try {
    const testPrompt = 'Hello';
    await callEnhancementAPI(provider, testPrompt);
    
    const latency = Date.now() - startTime;
    return {
      success: true,
      message: `Connection successful! Latency: ${latency}ms`,
      latency,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Get all enabled providers
 */
export function getEnabledProviders(): PromptEnhancementProvider[] {
  const config = loadConfig();
  return config.providers.filter(p => p.enabled);
}

/**
 * Add provider
 */
export function addProvider(provider: PromptEnhancementProvider): void {
  const config = loadConfig();
  config.providers.push(provider);
  saveConfig(config);
}

/**
 * Update provider
 */
export function updateProvider(id: string, updates: Partial<PromptEnhancementProvider>): void {
  const config = loadConfig();
  const index = config.providers.findIndex(p => p.id === id);
  if (index >= 0) {
    config.providers[index] = { ...config.providers[index], ...updates };
    saveConfig(config);
  }
}

/**
 * Delete provider
 */
export function deleteProvider(id: string): void {
  const config = loadConfig();
  config.providers = config.providers.filter(p => p.id !== id);
  saveConfig(config);
}

/**
 * Get provider
 */
export function getProvider(id: string): PromptEnhancementProvider | undefined {
  const config = loadConfig();
  return config.providers.find(p => p.id === id);
}

