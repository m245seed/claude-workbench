/**
 * Prompt context configuration service
 * Manages context extraction configuration for prompt optimization
 */

export interface PromptContextConfig {
  /**
   * Maximum number of messages to extract
   * @default 15
   */
  maxMessages: number;
  
  /**
   * Maximum character length for assistant messages (truncated if exceeded)
   * @default 2000
   */
  maxAssistantMessageLength: number;
  
  /**
   * Maximum character length for user messages (truncated if exceeded)
   * @default 1000
   */
  maxUserMessageLength: number;
  
  /**
   * Whether to include execution results
   * @default true
   */
  includeExecutionResults: boolean;
  
  /**
   * Maximum character length for execution results
   * @default 500
   */
  maxExecutionResultLength: number;
}

const STORAGE_KEY = 'prompt_context_config';

/**
 * Default configuration
 */
export const DEFAULT_CONTEXT_CONFIG: PromptContextConfig = {
  maxMessages: 15,
  maxAssistantMessageLength: 2000,
  maxUserMessageLength: 1000,
  includeExecutionResults: true,
  maxExecutionResultLength: 500,
};

/**
 * Preset configuration templates
 */
export const CONTEXT_PRESETS = {
  minimal: {
    name: 'Minimal Mode',
    description: 'Minimal context, suitable for simple tasks',
    config: {
      maxMessages: 5,
      maxAssistantMessageLength: 500,
      maxUserMessageLength: 500,
      includeExecutionResults: false,
      maxExecutionResultLength: 0,
    } as PromptContextConfig,
  },
  balanced: {
    name: 'Balanced Mode',
    description: 'Default configuration, suitable for most scenarios',
    config: DEFAULT_CONTEXT_CONFIG,
  },
  detailed: {
    name: 'Detailed Mode',
    description: 'Full context, suitable for complex tasks',
    config: {
      maxMessages: 30,
      maxAssistantMessageLength: 5000,
      maxUserMessageLength: 2000,
      includeExecutionResults: true,
      maxExecutionResultLength: 1000,
    } as PromptContextConfig,
  },
};

/**
 * Load configuration
 */
export function loadContextConfig(): PromptContextConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_CONTEXT_CONFIG;
    }
    
    const config = JSON.parse(stored) as PromptContextConfig;
    // Merge default values to ensure new fields have defaults
    return {
      ...DEFAULT_CONTEXT_CONFIG,
      ...config,
    };
  } catch (error) {
    console.error('[PromptContextConfig] Failed to load config:', error);
    return DEFAULT_CONTEXT_CONFIG;
  }
}

/**
 * Save configuration
 */
export function saveContextConfig(config: PromptContextConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('[PromptContextConfig] Failed to save config:', error);
  }
}

/**
 * Reset to default configuration
 */
export function resetContextConfig(): void {
  saveContextConfig(DEFAULT_CONTEXT_CONFIG);
}

/**
 * Apply preset configuration
 */
export function applyPreset(presetKey: keyof typeof CONTEXT_PRESETS): void {
  const preset = CONTEXT_PRESETS[presetKey];
  if (preset) {
    saveContextConfig(preset.config);
  }
}

