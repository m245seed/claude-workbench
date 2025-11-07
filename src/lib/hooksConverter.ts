/**
 * Type conversion utilities - Convert between existing HooksConfiguration and new EnhancedHooksConfiguration
 */

import type { HooksConfiguration } from '@/types/hooks';
import type { EnhancedHooksConfiguration } from '@/types/enhanced-hooks';

/**
 * Convert existing HooksConfiguration to EnhancedHooksConfiguration
 */
export function convertToEnhanced(config: HooksConfiguration): EnhancedHooksConfiguration {
  const enhanced: EnhancedHooksConfiguration = {};

  // Handle events with matcher (PreToolUse, PostToolUse)
  if (config.PreToolUse) {
    enhanced.PreToolUse = config.PreToolUse.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }

  if (config.PostToolUse) {
    enhanced.PostToolUse = config.PostToolUse.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }

  // Handle simple command events - now also in HookMatcher[] format
  if (config.Notification) {
    enhanced.Notification = config.Notification.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }

  if (config.Stop) {
    enhanced.Stop = config.Stop.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }

  if (config.SubagentStop) {
    enhanced.SubagentStop = config.SubagentStop.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }
  
  // Handle newly added events
  if (config.UserPromptSubmit) {
    enhanced.OnSessionStart = config.UserPromptSubmit.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }
  
  if (config.SessionStart) {
    enhanced.OnSessionStart = config.SessionStart.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }
  
  if (config.SessionEnd) {
    enhanced.OnSessionEnd = config.SessionEnd.flatMap(matcher =>
      matcher.hooks.map(hook => ({
        command: hook.command,
        timeout: hook.timeout || 60,
        retry: 1,
      }))
    );
  }

  return enhanced;
}

/**
 * Convert EnhancedHooksConfiguration to existing HooksConfiguration
 */
export function convertFromEnhanced(enhanced: EnhancedHooksConfiguration): HooksConfiguration {
  const config: HooksConfiguration = {};

  // Handle events with matcher - convert to default matcher
  if (enhanced.PreToolUse && enhanced.PreToolUse.length > 0) {
    config.PreToolUse = [{
      hooks: enhanced.PreToolUse.map(hook => ({
        type: 'command' as const,
        command: hook.command,
        timeout: hook.timeout,
      }))
    }];
  }

  if (enhanced.PostToolUse && enhanced.PostToolUse.length > 0) {
    config.PostToolUse = [{
      hooks: enhanced.PostToolUse.map(hook => ({
        type: 'command' as const,
        command: hook.command,
        timeout: hook.timeout,
      }))
    }];
  }

  // Handle simple command events - convert to HookMatcher[] format
  if (enhanced.Notification && enhanced.Notification.length > 0) {
    config.Notification = [{
      hooks: enhanced.Notification.map(hook => ({
        type: 'command' as const,
        command: hook.command,
        timeout: hook.timeout,
      }))
    }];
  }

  if (enhanced.Stop && enhanced.Stop.length > 0) {
    config.Stop = [{
      hooks: enhanced.Stop.map(hook => ({
        type: 'command' as const,
        command: hook.command,
        timeout: hook.timeout,
      }))
    }];
  }

  if (enhanced.SubagentStop && enhanced.SubagentStop.length > 0) {
    config.SubagentStop = [{
      hooks: enhanced.SubagentStop.map(hook => ({
        type: 'command' as const,
        command: hook.command,
        timeout: hook.timeout,
      }))
    }];
  }

  return config;
}

/**
 * Merge the two configuration formats, prioritizing new features of the Enhanced format
 */
export function mergeConfigurations(
  existing: HooksConfiguration,
  enhanced: EnhancedHooksConfiguration
): EnhancedHooksConfiguration {
  const converted = convertToEnhanced(existing);

  return {
    ...converted,
    ...enhanced,
    // If both have the same event, merge them
    PreToolUse: [
      ...(converted.PreToolUse || []),
      ...(enhanced.PreToolUse || [])
    ],
    PostToolUse: [
      ...(converted.PostToolUse || []),
      ...(enhanced.PostToolUse || [])
    ],
    Notification: [
      ...(converted.Notification || []),
      ...(enhanced.Notification || [])
    ],
    Stop: [
      ...(converted.Stop || []),
      ...(enhanced.Stop || [])
    ],
    SubagentStop: [
      ...(converted.SubagentStop || []),
      ...(enhanced.SubagentStop || [])
    ],
  };
}