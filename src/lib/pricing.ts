/**
 * Unified Claude model pricing module
 * 
 * According to the official documentation: https://docs.claude.com/en/docs/claude-code/costs
 * Price unit: USD per million tokens
 */

export interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/**
 * Model pricing constants (per million tokens)
 * Source: Anthropic official pricing
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 4.1 Opus
  'claude-opus-4.1': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.50
  },
  
  // Claude 4.5 Sonnet (current latest)
  'claude-sonnet-4.5': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30
  },
  
  // Claude 3.5 Sonnet
  'claude-sonnet-3.5': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30
  },
  
  // Default fallback (use Sonnet 4.5 pricing)
  'default': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30
  }
};

/**
 * Get pricing by model name
 * @param model - Model name or identifier
 * @returns Model pricing object
 */
export function getPricingForModel(model?: string): ModelPricing {
  if (!model) {
    return MODEL_PRICING['default'];
  }
  
  const normalizedModel = model.toLowerCase();
  
  // Claude 4.1 Opus
  if (normalizedModel.includes('opus-4') || normalizedModel.includes('opus 4')) {
    return MODEL_PRICING['claude-opus-4.1'];
  }
  
  // Claude 4.5 Sonnet
  if (normalizedModel.includes('sonnet-4.5') || normalizedModel.includes('sonnet 4.5')) {
    return MODEL_PRICING['claude-sonnet-4.5'];
  }
  
  // Claude 3.5 Sonnet
  if (normalizedModel.includes('sonnet-3.5') || normalizedModel.includes('sonnet 3.5') || normalizedModel.includes('35')) {
    return MODEL_PRICING['claude-sonnet-3.5'];
  }
  
  // Default to Sonnet 4.5 pricing
  return MODEL_PRICING['default'];
}

/**
 * Calculate the cost of a single message
 * @param tokens - Token usage statistics
 * @param model - Model name
 * @returns Cost (USD)
 */
export function calculateMessageCost(
  tokens: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  },
  model?: string
): number {
  const pricing = getPricingForModel(model);
  
  const inputCost = (tokens.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (tokens.output_tokens / 1_000_000) * pricing.output;
  const cacheWriteCost = (tokens.cache_creation_tokens / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost = (tokens.cache_read_tokens / 1_000_000) * pricing.cacheRead;
  
  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Format cost display
 * @param amount - Cost amount (USD)
 * @returns Formatted string
 */
export function formatCost(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.01) {
    // Show as cents if less than 1 cent
    const cents = amount * 100;
    return `$${cents.toFixed(3)}¢`;
  }
  return `$${amount.toFixed(4)}`;
}

/**
 * Format duration
 * @param seconds - Number of seconds
 * @returns Formatted duration string (e.g. "6m 19s" or "6h 33m")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

