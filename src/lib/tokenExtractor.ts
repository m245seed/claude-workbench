/**
 * Unified Token Extraction and Display Utility
 *
 * Resolves inconsistent token field naming in Claude Workbench:
 * - Message: cache_creation_tokens, cache_read_tokens
 * - Database: cache_write_tokens, cache_read_tokens
 * - API: cache_creation_tokens, cache_read_tokens
 *
 * Core features:
 * 1. Unified extraction of actual token usage per message
 * 2. Intelligent field mapping and normalization
 * 3. Handles dual usage fields in messages (message.usage and usage)
 * 4. Provides accurate four token data: input, output, cache creation, cache read
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @date 2025-09-26
 */

// 导入现有类型定义
import type { ClaudeStreamMessage } from '@/types/claude';
/**
 * Extended message type to support all token field variants
 */
export interface ExtendedClaudeStreamMessage {
  type?: string;
  message?: {
    usage?: RawTokenUsage;
    [key: string]: any;
  };
  usage?: RawTokenUsage;
  [key: string]: any;
}

/**
 * Standardized token usage data interface
 */
export interface StandardizedTokenUsage {
  /** Number of input tokens */
  input_tokens: number;
  /** Number of output tokens */
  output_tokens: number;
  /** Number of cache creation tokens */
  cache_creation_tokens: number;
  /** Number of cache read tokens */
  cache_read_tokens: number;
  /** Total number of tokens */
  total_tokens: number;
}

/**
 * Raw token usage data interface (supports various field name variants)
 *
 * Field variants found via code analysis:
 * - cache_creation_input_tokens (ConversationMetrics.tsx)
 * - cache_read_input_tokens (ConversationMetrics.tsx)
 * - cache_creation_tokens (standard API)
 * - cache_write_tokens (database)
 * - cache_read_tokens (standard)
 * - cache_creation (object format in JSONL)
 */
export interface RawTokenUsage {
  input_tokens?: number;
  output_tokens?: number;

  // 缓存创建token的各种命名方式
  cache_creation_tokens?: number;
  cache_write_tokens?: number;
  cache_creation_input_tokens?: number; // Found in ConversationMetrics

  // cache_creation object format (as in JSONL)
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };

  // 缓存读取token的各种命名方式
  cache_read_tokens?: number;
  cache_read_input_tokens?: number; // Found in ConversationMetrics

  // Different naming for total token count
  total_tokens?: number;
  tokens?: number;
}

/**
 * Message display options
 */
export interface TokenDisplayOptions {
  /** Show detailed info */
  showDetails?: boolean;
  /** Show cost info */
  showCost?: boolean;
  /** Show cache efficiency */
  showCacheEfficiency?: boolean;
  /** Use compact mode */
  compact?: boolean;
  /** Custom formatter function */
  customFormatter?: (tokens: StandardizedTokenUsage) => string;
}

/**
 * Token tooltip info
 */
export interface TokenTooltipInfo {
  /** Main content */
  content: string;
  /** Detailed breakdown */
  breakdown: {
    input: string;
    output: string;
    cache_creation: string;
    cache_read: string;
    total: string;
  };
  /** Efficiency metrics */
  efficiency?: {
    cache_hit_rate: string;
    cost_savings: string;
  };
}

/**
 * Extract token data from ClaudeStreamMessage
 *
 * Intelligently handles multiple field naming variants and data structures:
 * 1. Prefer message.usage
 * 2. Fallback to top-level usage
 * 3. Map all discovered field name variants
 * 4. Safely handle null/undefined values
 * 5. Backward compatible with existing code
 * 6. Handles cache_creation object format
 *
 * @param message - Claude stream message object
 * @returns Standardized token usage data
 */
export function extractMessageTokens(message: ClaudeStreamMessage | ExtendedClaudeStreamMessage): StandardizedTokenUsage {
  // Try to get usage data from different locations (priority based on code analysis)
  const primaryUsage = (message as ExtendedClaudeStreamMessage).message?.usage; // Priority 1: message.usage (main usage)
  const secondaryUsage = message.usage; // Priority 2: top-level usage
  const rawUsage: RawTokenUsage = primaryUsage || secondaryUsage || {};

  // Extract basic token data
  const input_tokens = rawUsage.input_tokens ?? 0;
  const output_tokens = rawUsage.output_tokens ?? 0;

  // Intelligent mapping for cache creation tokens (handle all discovered variants)
  // ⚠️ Fix: cache_creation_input_tokens already contains the total for all cache writes,
  // should not add cache_creation object's subfields again, or it will double count
  let cache_creation_tokens = 0;

  // Priority 1: use API standard fields (these are already totals)
  if (rawUsage.cache_creation_input_tokens !== undefined) {
    cache_creation_tokens = rawUsage.cache_creation_input_tokens;
  } else if (rawUsage.cache_creation_tokens !== undefined) {
    cache_creation_tokens = rawUsage.cache_creation_tokens;
  } else if (rawUsage.cache_write_tokens !== undefined) {
    cache_creation_tokens = rawUsage.cache_write_tokens;
  }
  // Priority 2: if no total field, then calculate from cache_creation object
  else if ((rawUsage as any).cache_creation) {
    const cacheCreation = (rawUsage as any).cache_creation;
    if (cacheCreation.ephemeral_5m_input_tokens) {
      cache_creation_tokens += cacheCreation.ephemeral_5m_input_tokens;
    }
    if (cacheCreation.ephemeral_1h_input_tokens) {
      cache_creation_tokens += cacheCreation.ephemeral_1h_input_tokens;
    }
  }

  // Intelligent mapping for cache read tokens (handle all discovered variants)
  const cache_read_tokens =
    rawUsage.cache_read_tokens ??
    rawUsage.cache_read_input_tokens ?? 0;

  // Calculate total token count (prefer recorded value, otherwise compute)
  const total_tokens = rawUsage.total_tokens ?? rawUsage.tokens ??
    (input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens);

  return {
    input_tokens,
    output_tokens,
    cache_creation_tokens,
    cache_read_tokens,
    total_tokens,
  };
}

/**
 * Format token data as display string
 *
 * @param tokens - Standardized token usage data
 * @param options - Display options
 * @returns Formatted display string
 */
export function formatMessageTokenDisplay(
  tokens: StandardizedTokenUsage,
  options: TokenDisplayOptions = {}
): string {
  const { showDetails = false, compact = false, customFormatter } = options;

  // 使用自定义格式化器
  if (customFormatter) {
    return customFormatter(tokens);
  }

  // Compact mode - show only total
  if (compact) {
    return `${tokens.total_tokens.toLocaleString()}`;
  }

  // Detailed mode - show breakdown
  if (showDetails) {
    const parts = [];

    if (tokens.input_tokens > 0) {
      parts.push(`Input: ${tokens.input_tokens.toLocaleString()}`);
    }

    if (tokens.output_tokens > 0) {
      parts.push(`Output: ${tokens.output_tokens.toLocaleString()}`);
    }

    if (tokens.cache_creation_tokens > 0) {
      parts.push(`Cache Created: ${tokens.cache_creation_tokens.toLocaleString()}`);
    }

    if (tokens.cache_read_tokens > 0) {
      parts.push(`Cache Read: ${tokens.cache_read_tokens.toLocaleString()}`);
    }

    return parts.length > 0 ? parts.join(' | ') : '0';
  }

  // Standard mode - show main info
  const inputOutput = `${tokens.input_tokens.toLocaleString()}→${tokens.output_tokens.toLocaleString()}`;
  const cacheInfo = tokens.cache_creation_tokens > 0 || tokens.cache_read_tokens > 0
    ? ` (Cache: ${(tokens.cache_creation_tokens + tokens.cache_read_tokens).toLocaleString()})`
    : '';

  return `${inputOutput}${cacheInfo}`;
}

/**
 * Create detailed tooltip for token info
 *
 * @param tokens - Standardized token usage data
 * @param model - Model name (for cost calculation)
 * @returns Tooltip info object
 */
export function createMessageTokenTooltip(
  tokens: StandardizedTokenUsage,
  model?: string
): TokenTooltipInfo {
  // Build detailed breakdown
  const breakdown = {
    input: `Input Tokens: ${tokens.input_tokens.toLocaleString()}`,
    output: `Output Tokens: ${tokens.output_tokens.toLocaleString()}`,
    cache_creation: tokens.cache_creation_tokens > 0
      ? `Cache Created: ${tokens.cache_creation_tokens.toLocaleString()}`
      : '',
    cache_read: tokens.cache_read_tokens > 0
      ? `Cache Read: ${tokens.cache_read_tokens.toLocaleString()}`
      : '',
    total: `Total: ${tokens.total_tokens.toLocaleString()} tokens`,
  };

  // Calculate cache efficiency (if cache data exists)
  let efficiency;
  if (tokens.cache_creation_tokens > 0 || tokens.cache_read_tokens > 0) {
    const cache_total = tokens.cache_creation_tokens + tokens.cache_read_tokens;
    const cache_hit_rate = tokens.total_tokens > 0
      ? ((cache_total / tokens.total_tokens) * 100).toFixed(1)
      : '0';

    efficiency = {
      cache_hit_rate: `Cache Utilization: ${cache_hit_rate}%`,
      cost_savings: model ? `Model: ${model}` : 'Cost Savings: Calculating...'
    };
  }

  // Build main content
  const content = [
    breakdown.input,
    breakdown.output,
    breakdown.cache_creation,
    breakdown.cache_read,
    '---',
    breakdown.total,
  ].filter(Boolean).join('\n');

  return {
    content,
    breakdown,
    efficiency,
  };
}

/**
 * Batch extract token data from multiple messages
 *
 * @param messages - Claude stream message array
 * @returns Array of standardized token usage data
 */
export function extractBatchMessageTokens(messages: ClaudeStreamMessage[]): StandardizedTokenUsage[] {
  return messages.map(message => extractMessageTokens(message));
}

/**
 * Calculate total token usage for a message session
 *
 * @param messages - Claude stream message array
 * @returns Session total token usage data
 */
export function calculateSessionTokenTotals(messages: ClaudeStreamMessage[]): StandardizedTokenUsage {
  const tokenData = extractBatchMessageTokens(messages);

  return tokenData.reduce((total, current) => ({
    input_tokens: total.input_tokens + current.input_tokens,
    output_tokens: total.output_tokens + current.output_tokens,
    cache_creation_tokens: total.cache_creation_tokens + current.cache_creation_tokens,
    cache_read_tokens: total.cache_read_tokens + current.cache_read_tokens,
    total_tokens: total.total_tokens + current.total_tokens,
  }), {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_tokens: 0,
    cache_read_tokens: 0,
    total_tokens: 0,
  });
}

/**
 * Validate the integrity and accuracy of token data
 *
 * @param tokens - Standardized token usage data
 * @returns Validation result and warning messages
 */
export function validateTokenData(tokens: StandardizedTokenUsage): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for negative values
  if (tokens.input_tokens < 0) warnings.push('Input token count is negative');
  if (tokens.output_tokens < 0) warnings.push('Output token count is negative');
  if (tokens.cache_creation_tokens < 0) warnings.push('Cache creation token count is negative');
  if (tokens.cache_read_tokens < 0) warnings.push('Cache read token count is negative');

  // Check total consistency
  const calculated_total = tokens.input_tokens + tokens.output_tokens +
                          tokens.cache_creation_tokens + tokens.cache_read_tokens;
  if (Math.abs(tokens.total_tokens - calculated_total) > 1) {
    warnings.push(`Total token count mismatch: recorded ${tokens.total_tokens}, calculated ${calculated_total}`);
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

// Export main features
export const tokenExtractor = {
  extract: extractMessageTokens,
  format: formatMessageTokenDisplay,
  tooltip: createMessageTokenTooltip,
  batch: extractBatchMessageTokens,
  sessionTotal: calculateSessionTokenTotals,
  validate: validateTokenData,
};

// Default export
export default tokenExtractor;