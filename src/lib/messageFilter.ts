/**
 * Message filtering module - unified message filtering logic
 *
 * Centralizes the scattered message filtering rules in ClaudeCodeSession
 * Provides configurable filtering options, easy to test and maintain
 */

import type { ClaudeStreamMessage } from '@/types/claude';

/**
 * Filter options configuration
 */
export interface FilterOptions {
  /** Whether to hide meta messages (messages without leafUuid and summary) */
  hideMeta?: boolean;

  /** Whether to hide user messages with empty content */
  hideEmptyUser?: boolean;

  /** Whether to deduplicate tool results (avoid displaying tool results that already have widgets) */
  deduplicateToolResults?: boolean;

  /** List of tools that already have widgets (for deduplication) */
  toolsWithWidgets?: string[];

  /** Custom filter function */
  customFilter?: (message: ClaudeStreamMessage) => boolean;
}

/**
 * Check if the message is a meta message
 */
export function isMeta(message: ClaudeStreamMessage): boolean {
  return !!(message as any).isMeta;
}

/**
 * Check if the message has leafUuid
 */
export function hasLeafUuid(message: ClaudeStreamMessage): boolean {
  return !!(message as any).leafUuid;
}

/**
 * Check if the message has summary
 */
export function hasSummary(message: ClaudeStreamMessage): boolean {
  return !!(message as any).summary;
}

/**
 * Check if the user message is empty
 */
export function isEmptyUserMessage(message: ClaudeStreamMessage): boolean {
  if (message.type !== 'user') {
    return false;
  }

  const content = message.message?.content;

  // No content
  if (!content) {
    return true;
  }

  // Array content is empty
  if (Array.isArray(content)) {
    return content.length === 0;
  }

  // String content is empty or only whitespace
  if (typeof content === 'string') {
    const strContent = content as string;
    return strContent.trim() === '';
  }

  return false;
}

/**
 * Check if the message is a tool result
 */
export function isToolResultMessage(message: ClaudeStreamMessage): boolean {
  if (message.type !== 'user') {
    return false;
  }

  const content = message.message?.content;
  if (!Array.isArray(content)) {
    return false;
  }

  // Check if it contains content of type tool_result
  return content.some((item: any) => item.type === 'tool_result');
}

/**
 * Extract the list of tool_use_id from tool result messages
 */
export function extractToolUseIds(message: ClaudeStreamMessage): string[] {
  if (!isToolResultMessage(message)) {
    return [];
  }

  const content = message.message?.content as any[];
  return content
    .filter((item: any) => item.type === 'tool_result' && item.tool_use_id)
    .map((item: any) => item.tool_use_id);
}

/**
 * Check if the tool result should be deduplicated
 * @param message Message object
 * @param toolsWithWidgets List of tool IDs that already have widgets
 */
export function shouldDeduplicateToolResult(message: ClaudeStreamMessage, toolsWithWidgets: string[]): boolean {
  if (!isToolResultMessage(message)) {
    return false;
  }

  const toolUseIds = extractToolUseIds(message);

  // Deduplicate if all tool results in the message already have widgets
  return toolUseIds.length > 0 && toolUseIds.every(id => toolsWithWidgets.includes(id));
}

/**
 * Filter displayable messages
 * @param messages Original message list
 * @param options Filter options
 * @returns Filtered message list
 */
export function filterDisplayableMessages(
  messages: ClaudeStreamMessage[],
  options: FilterOptions = {}
): ClaudeStreamMessage[] {
  const {
    hideMeta = true,
    hideEmptyUser = true,
    deduplicateToolResults = true,
    toolsWithWidgets = [],
    customFilter,
  } = options;

  return messages.filter(message => {
    // 1. Filter meta messages (without leafUuid and summary)
    if (hideMeta && isMeta(message) && !hasLeafUuid(message) && !hasSummary(message)) {
      return false;
    }

    // 2. Filter user messages with empty content
    if (hideEmptyUser && isEmptyUserMessage(message)) {
      return false;
    }

    // 3. Deduplicate tool result messages
    if (deduplicateToolResults && shouldDeduplicateToolResult(message, toolsWithWidgets)) {
      return false;
    }

    // 4. Custom filter function
    if (customFilter && !customFilter(message)) {
      return false;
    }

    return true;
  });
}

/**
 * Extract all tool IDs with widgets from the message list
 * (for tool result deduplication)
 */
export function extractToolsWithWidgets(messages: ClaudeStreamMessage[]): string[] {
  const toolIds: string[] = [];

  messages.forEach(message => {
    if (message.type !== 'assistant') {
      return;
    }

    const content = message.message?.content;
    if (!Array.isArray(content)) {
      return;
    }

    content.forEach((item: any) => {
      if (item.type === 'tool_use' && item.id) {
        toolIds.push(item.id);
      }
    });
  });

  return toolIds;
}

/**
 * Smart filtering pipeline (automatically extracts toolsWithWidgets)
 * @param messages Original message list
 * @param options Filter options (toolsWithWidgets will be automatically filled)
 * @returns Filtered message list
 */
export function smartFilterMessages(
  messages: ClaudeStreamMessage[],
  options: Omit<FilterOptions, 'toolsWithWidgets'> = {}
): ClaudeStreamMessage[] {
  // Automatically extract the list of tools that already have widgets
  const toolsWithWidgets = extractToolsWithWidgets(messages);

  return filterDisplayableMessages(messages, {
    ...options,
    toolsWithWidgets,
  });
}

/**
 * Filter statistics
 */
export interface FilterStats {
  /** Total number of original messages */
  total: number;

  /** Number of displayed messages after filtering */
  displayed: number;

  /** Number of filtered messages */
  filtered: number;

  /** Number of filtered messages grouped by type */
  filteredByType: {
    meta: number;
    emptyUser: number;
    duplicateToolResult: number;
    custom: number;
  };
}

/**
 * Get filter statistics
 */
export function getFilterStats(
  messages: ClaudeStreamMessage[],
  displayedMessages: ClaudeStreamMessage[],
  options: FilterOptions = {}
): FilterStats {
  const {
    hideMeta = true,
    hideEmptyUser = true,
    deduplicateToolResults = true,
    toolsWithWidgets = [],
    customFilter,
  } = options;

  const stats: FilterStats = {
    total: messages.length,
    displayed: displayedMessages.length,
    filtered: messages.length - displayedMessages.length,
    filteredByType: {
      meta: 0,
      emptyUser: 0,
      duplicateToolResult: 0,
      custom: 0,
    },
  };

  messages.forEach(message => {
    const isDisplayed = displayedMessages.includes(message);
    if (isDisplayed) {
      return;
    }

    // Count filtering reasons
    if (hideMeta && isMeta(message) && !hasLeafUuid(message) && !hasSummary(message)) {
      stats.filteredByType.meta++;
    } else if (hideEmptyUser && isEmptyUserMessage(message)) {
      stats.filteredByType.emptyUser++;
    } else if (deduplicateToolResults && shouldDeduplicateToolResult(message, toolsWithWidgets)) {
      stats.filteredByType.duplicateToolResult++;
    } else if (customFilter && !customFilter(message)) {
      stats.filteredByType.custom++;
    }
  });

  return stats;
}
