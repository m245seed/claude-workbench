/**
 * Message content extraction utility library
 *
 * Extracted from ClaudeCodeSession (originally scattered content extraction logic)
 * Unified handling of various message formats returned by Claude API
 */

import type { ClaudeStreamMessage } from '@/types/claude';

/**
 * Content source identifier
 */
export type ContentSource =
  | 'direct_content'          // message.content (string)
  | 'array_content'           // message.content (array)
  | 'content_text'            // message.content.text
  | 'message_content_string'  // message.message.content (string)
  | 'message_content_array'   // message.message.content (array)
  | 'direct_text'             // message.text
  | 'result_field'            // message.result
  | 'error_field'             // message.error
  | 'summary_field';          // message.summary

/**
 * Content extraction result
 */
export interface ExtractedContent {
  /** Extracted text content */
  text: string;
  /** List of content sources (sorted by priority) */
  sources: ContentSource[];
  /** Whether content was successfully extracted */
  hasContent: boolean;
}

/**
 * Extract text content from Claude message
 *
 * Supports 8 content formats, tries in order of priority:
 * 1. message.content (string)
 * 2. message.content (array with text items)
 * 3. message.content.text
 * 4. message.message.content (string)
 * 5. message.message.content (array)
 * 6. message.text
 * 7. message.result
 * 8. message.error
 * 9. message.summary
 *
 * @param message - Claude stream message object
 * @returns Extracted content object
 *
 * @example
 * const extracted = extractMessageContent(message);
 * if (extracted.hasContent) {
 *   console.log('Content:', extracted.text);
 *   console.log('Source:', extracted.sources[0]);
 * }
 */
export function extractMessageContent(message: ClaudeStreamMessage): ExtractedContent {
  let textContent = '';
  const contentSources: ContentSource[] = [];

  // Method 1: Direct content string
  if (typeof message.content === 'string' && message.content.trim()) {
    textContent = message.content;
    contentSources.push('direct_content');
  }

  // Method 2: Array content (Claude API format)
  if (!textContent && Array.isArray(message.content)) {
    const arrayContent = message.content
      .filter((item: any) => item && (item.type === 'text' || typeof item === 'string'))
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item.type === 'text') return item.text || '';
        return item.content || item.text || '';
      })
      .join('\n');
    if (arrayContent.trim()) {
      textContent = arrayContent;
      contentSources.push('array_content');
    }
  }

  // Method 3: Object with text property
  if (!textContent && message.content?.text && typeof message.content.text === 'string') {
    textContent = message.content.text;
    contentSources.push('content_text');
  }

  // Method 4: Nested in message.content (Claude Code SDK primary format)
  if (!textContent && message.message?.content) {
    const messageContent: any = message.message.content;
    if (typeof messageContent === 'string' && messageContent.trim()) {
      textContent = messageContent;
      contentSources.push('message_content_string');
    } else if (Array.isArray(messageContent)) {
      const nestedContent = messageContent
        .filter((item: any) => item && (item.type === 'text' || typeof item === 'string'))
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text || '';
          return item.content || item.text || '';
        })
        .join('\n');
      if (nestedContent.trim()) {
        textContent = nestedContent;
        contentSources.push('message_content_array');
      }
    }
  }

  // Method 5: Direct text property
  if (!textContent && (message as any).text && typeof (message as any).text === 'string') {
    textContent = (message as any).text;
    contentSources.push('direct_text');
  }

  // Method 6: Result field (for result-type messages)
  if (!textContent && (message as any).result && typeof (message as any).result === 'string') {
    textContent = (message as any).result;
    contentSources.push('result_field');
  }

  // Method 7: Error field (for error messages)
  if (!textContent && (message as any).error && typeof (message as any).error === 'string') {
    textContent = (message as any).error;
    contentSources.push('error_field');
  }

  // Method 8: Summary field (for summary messages)
  if (!textContent && (message as any).summary && typeof (message as any).summary === 'string') {
    textContent = (message as any).summary;
    contentSources.push('summary_field');
  }

  return {
    text: textContent,
    sources: contentSources,
    hasContent: textContent.trim().length > 0
  };
}

/**
 * Determine whether the message is a Claude response message
 *
 * @param message - Message object
 * @returns Whether it is a Claude response
 */
export function isClaudeResponse(message: ClaudeStreamMessage): boolean {
  return (
    message.type === 'assistant' ||
    message.type === 'result' ||
    (message.type === 'system' && message.subtype !== 'init') ||
    // Any message with actual content may be a Claude response
    !!(
      message.content ||
      message.message?.content ||
      (message as any).text ||
      (message as any).result ||
      (message as any).summary ||
      (message as any).error
    )
  );
}

/**
 * Extract thinking block content
 *
 * @param message - Claude message object
 * @returns Thinking block text, or empty string if none
 */
export function extractThinkingContent(message: ClaudeStreamMessage): string {
  if (!message.message?.content) return '';

  const content = message.message.content;
  if (!Array.isArray(content)) return '';

  const thinkingBlocks = content.filter((item: any) => item.type === 'thinking');
  return thinkingBlocks.map((item: any) => item.thinking || '').join('\n\n');
}

/**
 * Check whether the message contains a thinking block
 *
 * @param message - Claude message object
 * @returns Whether it contains a thinking block
 */
export function hasThinkingBlock(message: ClaudeStreamMessage): boolean {
  if (!message.message?.content) return false;
  const content = message.message.content;
  if (!Array.isArray(content)) return false;
  return content.some((item: any) => item.type === 'thinking');
}
