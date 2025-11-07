/**
 * Official Claude Token Counter Service
 *
 * Accurate token calculation service based on Claude official Token Count API
 * Supports precise token statistics and cost calculation for all message types and Claude models
 *
 * 2025 latest official pricing and Claude 4 series model support
 */

import Anthropic from '@anthropic-ai/sdk';
import { api } from './api';

// Official pricing (per million tokens) - Latest as of Jan 2025
export const CLAUDE_PRICING = {
  'claude-opus-4': {
    input: 15.0,
    output: 75.0,
    cache_write: 18.75,
    cache_read: 1.50,
  },
  'claude-opus-4-1': {
    input: 15.0,
    output: 75.0,
    cache_write: 18.75,
    cache_read: 1.50,
  },
  'claude-opus-4-1-20250805': {
    input: 15.0,
    output: 75.0,
    cache_write: 18.75,
    cache_read: 1.50,
  },
  'claude-sonnet-4': {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.30,
  },
  'claude-sonnet-3.7': {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.30,
  },
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.30,
  },
  'claude-3-5-sonnet-20240620': {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.30,
  },
  'claude-haiku-3.5': {
    input: 0.80,
    output: 4.0,
    cache_write: 1.0,
    cache_read: 0.08,
  },
  'claude-3-5-haiku-20241022': {
    input: 0.80,
    output: 4.0,
    cache_write: 1.0,
    cache_read: 0.08,
  },
  // Backward compatibility
  'claude-3-opus-20240229': {
    input: 15.0,
    output: 75.0,
    cache_write: 22.5,
    cache_read: 1.5,
  },
  'claude-3-sonnet-20240229': {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.30,
  },
  // Default value
  'default': {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.30,
  }
} as const;

// Standardized model name mapping
export const MODEL_ALIASES = {
  'opus': 'claude-opus-4',
  'opus4': 'claude-opus-4',
  'opus-4': 'claude-opus-4',
  'sonnet': 'claude-sonnet-4',
  'sonnet4': 'claude-sonnet-4',
  'sonnet-4': 'claude-sonnet-4',
} as const;

// Token usage statistics interface
export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_creation_tokens?: number;
  cache_read_input_tokens?: number;
  cache_read_tokens?: number;
}

// Message interface
export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image' | 'document';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}

// Tool definition interface
export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Token calculation response interface
export interface TokenCountResponse {
  input_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// Cost analysis result
export interface CostBreakdown {
  input_cost: number;
  output_cost: number;
  cache_write_cost: number;
  cache_read_cost: number;
  total_cost: number;
  total: number; // 向后兼容字段
}

// Token breakdown analysis
export interface TokenBreakdown {
  total: number;
  input: number;
  output: number;
  cache_write: number;
  cache_read: number;
  cost: CostBreakdown;
  efficiency: {
    cache_hit_rate: number;
    cost_savings: number;
  };
}

export class TokenCounterService {
  private client: Anthropic | null = null;
  private apiKey: string | null = null;
  private baseURL: string | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Anthropic client
   */
  private async initialize() {
    try {
      // Get API key from multiple sources
      this.apiKey = this.getApiKey();
      this.baseURL = this.getBaseURL();

      if (this.apiKey) {
        this.client = new Anthropic({
          apiKey: this.apiKey,
          baseURL: this.baseURL || undefined,
          defaultHeaders: {
            'anthropic-beta': 'prompt-caching-2024-07-31,token-counting-2024-11-01',
          },
        });
      }
    } catch (error) {
      console.warn('[TokenCounter] Initialization failed, falling back to estimation method:', error);
    }
  }

  /**
   * Get API key
   */
  private getApiKey(): string | null {
    // 1. 环境变量
    if (typeof window !== 'undefined') {
      // Browser environment
      return null; // API key should not be used directly in browser
    }

    // Node.js environment
    return process.env.ANTHROPIC_API_KEY ||
           process.env.ANTHROPIC_AUTH_TOKEN ||
           null;
  }

  /**
   * Get base URL
   */
  private getBaseURL(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('anthropic_base_url');
    }

    return process.env.ANTHROPIC_BASE_URL ||
           process.env.CLAUDE_API_BASE_URL ||
           null;
  }

  /**
   * Normalize model name
   */
  public normalizeModel(model?: string): string {
    if (!model) return 'claude-3-5-sonnet-20241022';

    const normalized = model.toLowerCase().replace(/-/g, '').replace(/\./g, '');

    // Check alias mapping
    for (const [alias, fullName] of Object.entries(MODEL_ALIASES)) {
      if (normalized.includes(alias.toLowerCase().replace(/-/g, '').replace(/\./g, ''))) {
        return fullName;
      }
    }

    // Model name pattern matching
    if (model.includes('opus')) return 'claude-opus-4';
    if (model.includes('sonnet') && model.includes('4')) return 'claude-sonnet-4';
    if (model.includes('sonnet') && model.includes('3.7')) return 'claude-sonnet-3.7';
    if (model.includes('sonnet')) return 'claude-3-5-sonnet-20241022';

    return model; // Return original name
  }

  /**
   * Calculate token count using official API
   */
  async countTokens(
    messages: ClaudeMessage[],
    model?: string,
    tools?: ClaudeTool[],
    systemPrompt?: string
  ): Promise<TokenCountResponse> {
    const normalizedModel = this.normalizeModel(model);

    // If client is not available, use estimation method
    if (!this.client) {
      return this.estimateTokens(messages, tools, systemPrompt);
    }

    try {
      const requestData: any = {
        model: normalizedModel,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      };

      if (tools && tools.length > 0) {
        requestData.tools = tools;
      }

      if (systemPrompt) {
        requestData.system = systemPrompt;
      }

      const response = await this.client.messages.countTokens(requestData);

      return {
        input_tokens: response.input_tokens,
        cache_creation_input_tokens: (response as any).cache_creation_input_tokens,
        cache_read_input_tokens: (response as any).cache_read_input_tokens,
      };
    } catch (error) {
      console.warn('[TokenCounter] API call failed, using estimation method:', error);
      return this.estimateTokens(messages, tools, systemPrompt);
    }
  }

  /**
   * Fallback estimation method (when API is unavailable)
   */
  private estimateTokens(
    messages: ClaudeMessage[],
    tools?: ClaudeTool[],
    systemPrompt?: string
  ): TokenCountResponse {
    let totalTokens = 0;

    // Estimate message tokens
    for (const message of messages) {
      if (typeof message.content === 'string') {
        totalTokens += Math.ceil(message.content.length / 4); // Rough estimate: 4 chars = 1 token
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text' && content.text) {
            totalTokens += Math.ceil(content.text.length / 4);
          } else if (content.type === 'image') {
            totalTokens += 1551; // Estimate for image tokens based on official docs
          } else if (content.type === 'document') {
            totalTokens += 2188; // Estimate for PDF tokens based on official docs
          }
        }
      }
    }

    // Estimate system prompt tokens
    if (systemPrompt) {
      totalTokens += Math.ceil(systemPrompt.length / 4);
    }

    // Estimate tool definition tokens
    if (tools && tools.length > 0) {
      const toolsJson = JSON.stringify(tools);
      totalTokens += Math.ceil(toolsJson.length / 4);
    }

    return {
      input_tokens: totalTokens,
    };
  }

  /**
   * Batch token calculation (parallel processing)
   */
  async batchCountTokens(
    requests: Array<{
      messages: ClaudeMessage[];
      model?: string;
      tools?: ClaudeTool[];
      systemPrompt?: string;
    }>
  ): Promise<TokenCountResponse[]> {
    try {
      const promises = requests.map(req =>
        this.countTokens(req.messages, req.model, req.tools, req.systemPrompt)
      );
      return await Promise.all(promises);
    } catch (error) {
      console.error('[TokenCounter] Batch calculation failed:', error);
      // Fallback to individual calculation
      const results: TokenCountResponse[] = [];
      for (const req of requests) {
        try {
          const result = await this.countTokens(req.messages, req.model, req.tools, req.systemPrompt);
          results.push(result);
        } catch (err) {
          results.push({ input_tokens: 0 });
        }
      }
      return results;
    }
  }

  /**
   * Calculate cost
   */
  calculateCost(usage: TokenUsage, model?: string): CostBreakdown {
    const normalizedModel = this.normalizeModel(model);
    const pricing = CLAUDE_PRICING[normalizedModel as keyof typeof CLAUDE_PRICING];

    if (!pricing) {
      console.warn(`[TokenCounter] Unknown model pricing: ${normalizedModel}`);
      return {
        input_cost: 0,
        output_cost: 0,
        cache_write_cost: 0,
        cache_read_cost: 0,
        total_cost: 0,
        total: 0, // 向后兼容字段
      };
    }

    const input_tokens = usage.input_tokens || 0;
    const output_tokens = usage.output_tokens || 0;
    const cache_write_tokens = usage.cache_creation_input_tokens || usage.cache_creation_tokens || 0;
    const cache_read_tokens = usage.cache_read_input_tokens || usage.cache_read_tokens || 0;

    const input_cost = (input_tokens * pricing.input) / 1_000_000;
    const output_cost = (output_tokens * pricing.output) / 1_000_000;
    const cache_write_cost = (cache_write_tokens * pricing.cache_write) / 1_000_000;
    const cache_read_cost = (cache_read_tokens * pricing.cache_read) / 1_000_000;

    const total_cost = input_cost + output_cost + cache_write_cost + cache_read_cost;
    return {
      input_cost,
      output_cost,
      cache_write_cost,
      cache_read_cost,
      total_cost,
      total: total_cost, // 向后兼容字段
    };
  }

  /**
   * Get detailed token breakdown analysis
   */
  calculateBreakdown(usage: TokenUsage, model?: string): TokenBreakdown {
    const normalized = this.normalizeUsage(usage);
    const cost = this.calculateCost(normalized, model);

    const total = normalized.input_tokens + normalized.output_tokens +
                 (normalized.cache_creation_tokens || 0) + (normalized.cache_read_tokens || 0);

    const cache_hit_rate = total > 0 ? ((normalized.cache_read_tokens || 0) / total) * 100 : 0;

    // Calculate cache cost savings
    const standard_cost = ((normalized.cache_read_tokens || 0) *
                (CLAUDE_PRICING[this.normalizeModel(model) as keyof typeof CLAUDE_PRICING]?.input || 3)) / 1_000_000;
    const actual_cache_cost = cost.cache_read_cost;
    const cost_savings = standard_cost - actual_cache_cost;

    return {
      total,
      input: normalized.input_tokens,
      output: normalized.output_tokens,
      cache_write: normalized.cache_creation_tokens || 0,
      cache_read: normalized.cache_read_tokens || 0,
      cost,
      efficiency: {
        cache_hit_rate,
        cost_savings,
      },
    };
  }

  /**
   * Normalize token usage data
   */
  normalizeUsage(usage: TokenUsage): Required<TokenUsage> {
    return {
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens || usage.cache_creation_tokens || 0,
      cache_creation_tokens: usage.cache_creation_tokens || usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: usage.cache_read_input_tokens || usage.cache_read_tokens || 0,
      cache_read_tokens: usage.cache_read_tokens || usage.cache_read_input_tokens || 0,
    };
  }

  /**
   * Format token count for display
   */
  formatCount(count: number): string {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(2)}M`;
    } else if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toLocaleString();
  }

  /**
   * Format cost for display
   */
  formatCost(cost: number): string {
    if (cost >= 1) {
      return `$${cost.toFixed(2)}`;
    } else if (cost >= 0.01) {
      return `$${cost.toFixed(3)}`;
    } else if (cost >= 0.001) {
      return `$${cost.toFixed(4)}`;
    } else if (cost > 0) {
      return `$${cost.toFixed(6)}`;
    }
    return '$0.00';
  }

  /**
   * Format token breakdown for display
   */
  formatBreakdown(
    usage: TokenUsage,
    model?: string,
    options: {
      compact?: boolean;
      includeCost?: boolean;
      includeEfficiency?: boolean
    } = {}
  ): string {
    const breakdown = this.calculateBreakdown(usage, model);

    if (options.compact) {
      const parts: string[] = [];

      if (breakdown.input > 0) parts.push(`${this.formatCount(breakdown.input)} in`);
      if (breakdown.output > 0) parts.push(`${this.formatCount(breakdown.output)} out`);
      if (breakdown.cache_read > 0) parts.push(`${this.formatCount(breakdown.cache_read)} read`);

      let result = parts.join(', ');

      if (options.includeCost && breakdown.cost.total_cost > 0) {
        result += ` • ${this.formatCost(breakdown.cost.total_cost)}`;
      }

      if (options.includeEfficiency && breakdown.efficiency.cache_hit_rate > 0) {
        result += ` (${breakdown.efficiency.cache_hit_rate.toFixed(1)}% cached)`;
      }

      return result || `${this.formatCount(breakdown.total)} tokens`;
    }

    return `${this.formatCount(breakdown.total)} tokens`;
  }

  /**
   * Create detailed tooltip content
   */
  createTooltip(usage: TokenUsage, model?: string): string {
    const breakdown = this.calculateBreakdown(usage, model);
    const normalizedModel = this.normalizeModel(model);
    const pricing = CLAUDE_PRICING[normalizedModel as keyof typeof CLAUDE_PRICING];

    const lines: string[] = [];

    lines.push(`Model: ${normalizedModel}`);
    lines.push(`Total Tokens: ${breakdown.total.toLocaleString()}`);
    lines.push('');

    // Token breakdown
    if (breakdown.input > 0) {
      lines.push(`Input Tokens: ${breakdown.input.toLocaleString()}`);
    }
    if (breakdown.output > 0) {
      lines.push(`Output Tokens: ${breakdown.output.toLocaleString()}`);
    }
    if (breakdown.cache_write > 0) {
      lines.push(`Cache Write: ${breakdown.cache_write.toLocaleString()}`);
    }
    if (breakdown.cache_read > 0) {
      lines.push(`Cache Read: ${breakdown.cache_read.toLocaleString()}`);
    }

    // Cost breakdown
    if (breakdown.cost.total_cost > 0) {
      lines.push('');
      lines.push(`Total Cost: ${this.formatCost(breakdown.cost.total_cost)}`);

      if (breakdown.cost.input_cost > 0) {
        lines.push(`Input Cost: ${this.formatCost(breakdown.cost.input_cost)}`);
      }
      if (breakdown.cost.output_cost > 0) {
        lines.push(`Output Cost: ${this.formatCost(breakdown.cost.output_cost)}`);
      }
      if (breakdown.cost.cache_write_cost > 0) {
        lines.push(`Cache Write Cost: ${this.formatCost(breakdown.cost.cache_write_cost)}`);
      }
      if (breakdown.cost.cache_read_cost > 0) {
        lines.push(`Cache Read Cost: ${this.formatCost(breakdown.cost.cache_read_cost)}`);
      }
    }

    // Efficiency metrics
    if (breakdown.efficiency.cache_hit_rate > 0) {
      lines.push('');
      lines.push(`Cache Hit Rate: ${breakdown.efficiency.cache_hit_rate.toFixed(1)}%`);
      if (breakdown.efficiency.cost_savings > 0) {
        lines.push(`Cost Savings: ${this.formatCost(breakdown.efficiency.cost_savings)}`);
      }
    }

    // Pricing info
    if (pricing) {
      lines.push('');
      lines.push('Pricing (per million tokens):');
      lines.push(`Input: $${pricing.input}`);
      lines.push(`Output: $${pricing.output}`);
      lines.push(`Cache Write: $${pricing.cache_write}`);
      lines.push(`Cache Read: $${pricing.cache_read}`);
    }

    return lines.join('\n');
  }

  /**
   * Get supported model list
   */
  getSupportedModels(): string[] {
    return Object.keys(CLAUDE_PRICING);
  }

  /**
   * Aggregate multiple token usage data
   */
  aggregateUsage(usages: TokenUsage[]): TokenUsage {
    return usages.reduce(
      (total, usage) => {
        const normalized = this.normalizeUsage(usage);
        return {
          input_tokens: (total.input_tokens || 0) + (normalized.input_tokens || 0),
          output_tokens: (total.output_tokens || 0) + (normalized.output_tokens || 0),
          cache_creation_tokens: (total.cache_creation_tokens || 0) + (normalized.cache_creation_tokens || 0),
          cache_read_tokens: (total.cache_read_tokens || 0) + (normalized.cache_read_tokens || 0),
          cache_creation_input_tokens: (total.cache_creation_input_tokens || 0) + (normalized.cache_creation_input_tokens || 0),
          cache_read_input_tokens: (total.cache_read_input_tokens || 0) + (normalized.cache_read_input_tokens || 0),
        };
      },
      { input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
    );
  }

  /**
   * Check if API is available
   */
  isApiAvailable(): boolean {
    return this.client !== null;
  }
}

/**
 * Session-level token statistics
 */
export interface SessionTokenStats {
  total_tokens: number;
  total_cost: number;
  message_count: number;
  average_tokens_per_message: number;
  cache_efficiency: number;
  breakdown: TokenBreakdown;
  trend: {
    tokens_per_hour: number;
    cost_per_hour: number;
    peak_usage_time?: string;
  };
}

// Export singleton instance
export const tokenCounter = new TokenCounterService();

// Convenience function exports
export const countTokens = (messages: ClaudeMessage[], model?: string, tools?: ClaudeTool[], systemPrompt?: string) =>
  tokenCounter.countTokens(messages, model, tools, systemPrompt);

export const calculateCost = (usage: TokenUsage, model?: string) =>
  tokenCounter.calculateCost(usage, model);

/**
 * Backward compatible function
 * Normalize usage data from different API response formats
 */
export function normalizeTokenUsage(usage: any): TokenUsage {
  return tokenCounter.normalizeUsage(usage);
}

/**
 * Backward compatible function
 * Get model pricing configuration
 */
export function getModelPricing(model?: string) {
  const normalizedModel = tokenCounter.normalizeModel(model);
  return CLAUDE_PRICING[normalizedModel as keyof typeof CLAUDE_PRICING] || CLAUDE_PRICING.default;
}

/**
 * Calculate detailed token breakdown with cost analysis
 */
export function calculateTokenBreakdown(
  usage: TokenUsage,
  model?: string
): TokenBreakdown {
  return tokenCounter.calculateBreakdown(usage, model);
}

/**
 * Format token count for display with appropriate units
 */
export function formatTokenCount(tokens: number): string {
  return tokenCounter.formatCount(tokens);
}

/**
 * Format cost for display with appropriate precision
 */
export function formatCost(cost: number): string {
  return tokenCounter.formatCost(cost);
}

/**
 * Create a detailed usage summary string
 */
export function formatUsageBreakdown(
  usage: TokenUsage,
  model?: string,
  options: {
    includeTotal?: boolean;
    includeCost?: boolean;
    includeEfficiency?: boolean;
    compact?: boolean;
  } = {}
): string {
  return tokenCounter.formatBreakdown(usage, model, {
    compact: options.compact,
    includeCost: options.includeCost,
    includeEfficiency: options.includeEfficiency
  });
}

/**
 * Create a detailed tooltip with comprehensive token information
 */
export function createTokenTooltip(
  usage: TokenUsage,
  model?: string
): string {
  return tokenCounter.createTooltip(usage, model);
}

/**
 * Aggregate tokens from multiple messages (e.g., for session totals)
 */
export function aggregateTokenUsage(usages: TokenUsage[]): TokenUsage {
  return usages.reduce(
    (total, usage) => {
      const normalized = normalizeTokenUsage(usage);
      return {
        input_tokens: (total.input_tokens || 0) + (normalized.input_tokens || 0),
        output_tokens: (total.output_tokens || 0) + (normalized.output_tokens || 0),
        cache_creation_tokens: (total.cache_creation_tokens || 0) + (normalized.cache_creation_tokens || 0),
        cache_read_tokens: (total.cache_read_tokens || 0) + (normalized.cache_read_tokens || 0),
      };
    },
    { input_tokens: 0, output_tokens: 0, cache_creation_tokens: 0, cache_read_tokens: 0 }
  );
}

/**
 * Calculate session-level statistics with trends
 */
export function calculateSessionStats(
  messages: Array<{ usage?: any; timestamp?: string; receivedAt?: string }>,
  model?: string
): SessionTokenStats {
  // Extract valid usage data from messages
  const usages = messages
    .filter(msg => msg.usage)
    .map(msg => normalizeTokenUsage(msg.usage));

  if (usages.length === 0) {
    return {
      total_tokens: 0,
      total_cost: 0,
      message_count: messages.length,
      average_tokens_per_message: 0,
      cache_efficiency: 0,
      breakdown: calculateTokenBreakdown({ input_tokens: 0, output_tokens: 0 }, model),
      trend: {
        tokens_per_hour: 0,
        cost_per_hour: 0,
      }
    };
  }

  const aggregated = aggregateTokenUsage(usages);
  const breakdown = calculateTokenBreakdown(aggregated, model);

  // Calculate time-based trends
  const timestampedMessages = messages.filter(msg => msg.timestamp || msg.receivedAt);
  let tokensPerHour = 0;
  let costPerHour = 0;
  let peakUsageTime: string | undefined;

  if (timestampedMessages.length >= 2) {
    const firstTime = new Date(timestampedMessages[0].timestamp || timestampedMessages[0].receivedAt!);
    const lastTime = new Date(timestampedMessages[timestampedMessages.length - 1].timestamp || timestampedMessages[timestampedMessages.length - 1].receivedAt!);
    const hoursElapsed = (lastTime.getTime() - firstTime.getTime()) / (1000 * 60 * 60);

    if (hoursElapsed > 0) {
      tokensPerHour = breakdown.total / hoursElapsed;
      costPerHour = breakdown.cost.total_cost / hoursElapsed;
    }
  }

  return {
    total_tokens: breakdown.total,
    total_cost: breakdown.cost.total_cost,
    message_count: messages.length,
    average_tokens_per_message: breakdown.total / messages.length,
    cache_efficiency: breakdown.efficiency.cache_hit_rate,
    breakdown,
    trend: {
      tokens_per_hour: tokensPerHour,
      cost_per_hour: costPerHour,
      peak_usage_time: peakUsageTime,
    }
  };
}

/**
 * Get cached session token data from the API
 */
export async function getSessionCacheTokens(sessionId: string): Promise<{ cache_creation: number; cache_read: number }> {
  try {
    const cacheData = await api.getSessionCacheTokens(sessionId);
    return {
      cache_creation: cacheData.total_cache_creation_tokens,
      cache_read: cacheData.total_cache_read_tokens
    };
  } catch (error) {
    console.warn('Failed to fetch session cache tokens:', error);
    return { cache_creation: 0, cache_read: 0 };
  }
}

export default tokenCounter;