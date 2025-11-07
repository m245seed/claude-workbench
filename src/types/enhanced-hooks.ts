/**
 * Enhanced Hooks Automation System TypeScript Type Definitions
 * Synchronized with Rust backend structures
 */

/**
 * Extended Hook Event Types
 */
export type HookEvent =
  // Existing events
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'Stop'
  | 'SubagentStop'
  // New events
  | 'OnContextCompact'     // Triggered when context is compacted
  | 'OnAgentSwitch'        // Triggered when switching sub-agents
  | 'OnFileChange'         // Triggered when files are modified
  | 'OnSessionStart'       // Triggered when session starts
  | 'OnSessionEnd'         // Triggered when session ends
  | 'OnTabSwitch';         // Triggered when switching tabs

/**
 * Hook Execution Context
 */
export interface HookContext {
  event: string;
  session_id: string;
  project_path: string;
  data: any; // Event-specific data
}

/**
 * Hook Execution Result
 */
export interface HookExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  execution_time_ms: number;
  hook_command: string;
}

/**
 * Hook Chain Execution Result
 */
export interface HookChainResult {
  event: string;
  total_hooks: number;
  successful: number;
  failed: number;
  results: HookExecutionResult[];
  should_continue: boolean; // Whether to continue subsequent operations
}

/**
 * Conditional Trigger Configuration
 */
export interface ConditionalTrigger {
  condition: string;      // Condition expression
  enabled: boolean;
  priority?: number;      // Execution priority
}

/**
 * Enhanced Hook Definition
 */
export interface EnhancedHook {
  command: string;
  timeout?: number;
  retry?: number;
  condition?: ConditionalTrigger;
  on_success?: string[];    // Commands to execute on success
  on_failure?: string[];    // Commands to execute on failure
}

/**
 * Enhanced Hooks Configuration
 */
export interface EnhancedHooksConfiguration {
  // Existing events
  PreToolUse?: EnhancedHook[];
  PostToolUse?: EnhancedHook[];
  Notification?: EnhancedHook[];
  Stop?: EnhancedHook[];
  SubagentStop?: EnhancedHook[];

  // New events
  OnContextCompact?: EnhancedHook[];
  OnAgentSwitch?: EnhancedHook[];
  OnFileChange?: EnhancedHook[];
  OnSessionStart?: EnhancedHook[];
  OnSessionEnd?: EnhancedHook[];
  OnTabSwitch?: EnhancedHook[];
}

/**
 * Enhanced Hooks API Interface
 */
export interface EnhancedHooksAPI {
  /**
   * Trigger Hook Event
   */
  triggerHookEvent(event: string, context: HookContext): Promise<HookChainResult>;

  /**
   * Test Hook Condition
   */
  testHookCondition(condition: string, context: HookContext): Promise<boolean>;
}

/**
 * Hook Event Descriptions
 */
export const HOOK_EVENT_DESCRIPTIONS: Record<HookEvent, string> = {
  // Existing events
  'PreToolUse': 'Triggered before tool use',
  'PostToolUse': 'Triggered after tool use',
  'Notification': 'Triggered on notification events',
  'Stop': 'Triggered on stop events',
  'SubagentStop': 'Triggered when sub-agent stops',

  // New events
  'OnContextCompact': 'Triggered when context is compacted, can be used for backup or notification',
  'OnAgentSwitch': 'Triggered when switching sub-agents, can be used for state transfer',
  'OnFileChange': 'Triggered when files are modified, can be used for auto-save or validation',
  'OnSessionStart': 'Triggered when session starts, can be used for environment initialization',
  'OnSessionEnd': 'Triggered when session ends, can be used for cleanup and summary',
  'OnTabSwitch': 'Triggered when switching tabs, can be used for state synchronization',
};

/**
 * Hook Event Categories
 */
export const HOOK_EVENT_CATEGORIES = {
  'Session Lifecycle': ['OnSessionStart', 'OnSessionEnd'],
  'Context Management': ['OnContextCompact'],
  'Agent Management': ['OnAgentSwitch', 'SubagentStop'],
  'User Interface': ['OnTabSwitch'],
  'File System': ['OnFileChange'],
  'Tool Usage': ['PreToolUse', 'PostToolUse'],
  'System Events': ['Notification', 'Stop'],
} as const;

/**
 * Common Hook Templates
 */
export interface HookTemplate {
  name: string;
  description: string;
  events: HookEvent[];
  hooks: EnhancedHook[];
}

export const HOOK_TEMPLATES: HookTemplate[] = [
  {
    name: 'Auto Backup',
    description: 'Automatically backup when context is compacted',
    events: ['OnContextCompact'],
    hooks: [
      {
        command: 'git add . && git commit -m "Auto backup: $(date)"',
        timeout: 30,
        retry: 1,
      }
    ]
  },
  {
    name: 'Session Logging',
    description: 'Record session start and end times',
    events: ['OnSessionStart', 'OnSessionEnd'],
    hooks: [
      {
        command: 'echo "$(date): Session $HOOK_EVENT" >> session.log',
        timeout: 5,
      }
    ]
  },
  {
    name: 'Performance Monitoring',
    description: 'Monitor performance before and after tool use',
    events: ['PreToolUse', 'PostToolUse'],
    hooks: [
      {
        command: 'echo "$(date): $HOOK_EVENT - Memory: $(free -h | grep Mem)" >> perf.log',
        timeout: 10,
      }
    ]
  },
  {
    name: 'File Change Notification',
    description: 'Send notification when files are modified',
    events: ['OnFileChange'],
    hooks: [
      {
        command: 'notify-send "File Modified" "Project: $PROJECT_PATH"',
        timeout: 5,
        condition: {
          condition: 'event == "OnFileChange"',
          enabled: true,
        }
      }
    ]
  },
];

/**
 * Hook Condition Expression Examples
 */
export const CONDITION_EXAMPLES = [
  'event == "OnContextCompact"',
  'session_id == "specific-session"',
  'data.tokens > 100000',
  'data.file_count > 50',
  'data.agent_type == "code-reviewer"',
] as const;

// ============ Intelligent Automation Scenario Type Definitions ============

/**
 * Pre-Commit Code Review Hook Configuration
 */
export interface PreCommitCodeReviewConfig {
  enabled: boolean;
  quality_threshold: number;        // Minimum quality score threshold (0.0-10.0)
  block_critical_issues: boolean;   // Whether to block critical issues
  block_major_issues: boolean;      // Whether to block major issues
  review_scope: string;             // "security", "performance", "all"
  exclude_patterns: string[];       // Excluded file patterns
  max_files_to_review: number;      // Maximum number of files to review
  show_suggestions: boolean;        // Whether to show improvement suggestions
}

/**
 * Commit Decision Result
 */
export type CommitDecision =
  | {
      type: 'Allow';
      message: string;
      suggestions: string[];
    }
  | {
      type: 'Block';
      reason: string;
      details: string;
      suggestions: string[];
    };

/**
 * Intelligent Hook Template Configuration
 */
export interface IntelligentHookTemplate {
  id: string;
  name: string;
  description: string;
  category: 'quality' | 'security' | 'performance' | 'automation';
  config: PreCommitCodeReviewConfig;
  icon: string;
  enabled_by_default: boolean;
}

/**
 * Predefined Intelligent Hook Templates
 */
export const INTELLIGENT_HOOK_TEMPLATES: IntelligentHookTemplate[] = [
  {
    id: 'strict-quality-gate',
    name: 'Strict Quality Gate',
    description: 'Block all critical and major issues to ensure code quality',
    category: 'quality',
    config: {
      enabled: true,
      quality_threshold: 7.0,
      block_critical_issues: true,
      block_major_issues: true,
      review_scope: 'all',
      exclude_patterns: ['node_modules/**', 'dist/**', 'build/**', 'target/**'],
      max_files_to_review: 20,
      show_suggestions: true,
    },
    icon: 'shield-check',
    enabled_by_default: false,
  },
  {
    id: 'security-focused',
    name: 'Security First',
    description: 'Focus on security issue detection, block all security threats',
    category: 'security',
    config: {
      enabled: true,
      quality_threshold: 5.0,
      block_critical_issues: true,
      block_major_issues: false,
      review_scope: 'security',
      exclude_patterns: ['node_modules/**', 'dist/**', 'test/**', '*.test.*'],
      max_files_to_review: 30,
      show_suggestions: true,
    },
    icon: 'shield-alert',
    enabled_by_default: true,
  },
  {
    id: 'performance-monitor',
    name: 'Performance Monitor',
    description: 'Focus on performance issue detection and optimization suggestions',
    category: 'performance',
    config: {
      enabled: true,
      quality_threshold: 6.0,
      block_critical_issues: false,
      block_major_issues: false,
      review_scope: 'performance',
      exclude_patterns: ['node_modules/**', 'dist/**', '*.min.*'],
      max_files_to_review: 15,
      show_suggestions: true,
    },
    icon: 'gauge',
    enabled_by_default: false,
  },
  {
    id: 'balanced-review',
    name: 'Balanced Review',
    description: 'Balanced code review, suitable for daily development',
    category: 'quality',
    config: {
      enabled: true,
      quality_threshold: 6.0,
      block_critical_issues: true,
      block_major_issues: false,
      review_scope: 'all',
      exclude_patterns: ['node_modules/**', 'dist/**', 'build/**', 'target/**', '.git/**'],
      max_files_to_review: 25,
      show_suggestions: true,
    },
    icon: 'bot',
    enabled_by_default: true,
  },
];

/**
 * Hook Configuration Validation Rules
 */
export interface HookConfigValidation {
  quality_threshold: { min: number; max: number };
  max_files_to_review: { min: number; max: number };
  review_scopes: string[];
}

export const HOOK_CONFIG_VALIDATION: HookConfigValidation = {
  quality_threshold: { min: 0.0, max: 10.0 },
  max_files_to_review: { min: 1, max: 100 },
  review_scopes: ['security', 'performance', 'maintainability', 'style', 'all'],
};