import React from "react";
import { Bot, Clock } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageContent } from "./MessageContent";
import { ToolCallsGroup } from "./ToolCallsGroup";
import { cn } from "@/lib/utils";
import { tokenExtractor } from "@/lib/tokenExtractor";
import type { ClaudeStreamMessage } from '@/types/claude';

interface AIMessageProps {
  /** Message data */
  message: ClaudeStreamMessage;
  /** Whether it is streaming output */
  isStreaming?: boolean;
  /** Custom class name */
  className?: string;
  /** Link detection callback */
  onLinkDetected?: (url: string) => void;
}

/**
 * Extract the text content of AI message
 */
const extractAIText = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';
  
  const content = message.message.content;
  
  // If it's a string, return directly
  if (typeof content === 'string') return content;
  
  // If it's an array, extract all text type content
  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n\n');
  }
  
  return '';
};

/**
 * Detect if there are tool calls in the message
 */
const hasToolCalls = (message: ClaudeStreamMessage): boolean => {
  if (!message.message?.content) return false;
  
  const content = message.message.content;
  if (!Array.isArray(content)) return false;
  
  return content.some((item: any) => 
    item.type === 'tool_use' || item.type === 'tool_result'
  );
};

/**
 * Detect if there is a thinking block in the message
 */
const hasThinkingBlock = (message: ClaudeStreamMessage): boolean => {
  if (!message.message?.content) return false;

  const content = message.message.content;
  if (!Array.isArray(content)) return false;

  return content.some((item: any) => item.type === 'thinking');
};

/**
 * Extract thinking block content
 */
const extractThinkingContent = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';

  const content = message.message.content;
  if (!Array.isArray(content)) return '';

  const thinkingBlocks = content.filter((item: any) => item.type === 'thinking');
  return thinkingBlocks.map((item: any) => item.thinking || '').join('\n\n');
};

/**
 * AI Message Component (Refactored)
 * Left-aligned card style, supports tool call display and thinking block
 */
export const AIMessage: React.FC<AIMessageProps> = ({
  message,
  isStreaming = false,
  className,
  onLinkDetected
}) => {
  const text = extractAIText(message);
  const hasTools = hasToolCalls(message);
  const hasThinking = hasThinkingBlock(message);
  const thinkingContent = hasThinking ? extractThinkingContent(message) : '';

  // If there is neither text nor tool calls nor thinking block, do not render
  if (!text && !hasTools && !hasThinking) return null;

  // Format timestamp
  const formatTimestamp = (timestamp: string | undefined): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    } catch {
      return '';
    }
  };

  // Extract token statistics
  const tokenStats = message.message?.usage ? (() => {
    const extractedTokens = tokenExtractor.extract({
      type: 'assistant',
      message: { usage: message.message.usage }
    });
    const parts = [`${extractedTokens.input_tokens}/${extractedTokens.output_tokens}`];
    if (extractedTokens.cache_creation_tokens > 0) {
      parts.push(`Created ${extractedTokens.cache_creation_tokens}`);
    }
    if (extractedTokens.cache_read_tokens > 0) {
      parts.push(`Cached ${extractedTokens.cache_read_tokens}`);
    }
    return parts.join(' | ');
  })() : null;

  return (
    <div className={cn("relative", className)}>
      <MessageBubble variant="assistant" isStreaming={isStreaming}>
        {/* Message header: Integrate header and token statistics */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
            {/* Left: Avatar + Name + Time */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10 flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-500" />
              </div>
              <span className="font-medium">Claude</span>
              {formatTimestamp(message.timestamp) && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(message.timestamp)}
                  </span>
                </>
              )}
            </div>
            
            {/* Right: Token statistics */}
            {tokenStats && (
              <div className="text-foreground/60 font-mono flex-shrink-0">
                Tokens: {tokenStats}
              </div>
            )}
          </div>
        </div>

        {/* Message content */}
        {text && (
          <div className="px-4 pb-3">
            <MessageContent
              content={text}
              isStreaming={isStreaming && !hasTools && !hasThinking}
            />
          </div>
        )}

        {/* Thinking block area */}
        {hasThinking && thinkingContent && (
          <div className="mx-4 mb-3 border-l-2 border-purple-500/30 bg-purple-500/5 rounded">
            <details className="group">
              <summary className="cursor-pointer px-3 py-2 text-xs text-purple-700 dark:text-purple-300 font-medium hover:bg-purple-500/10 transition-colors select-none flex items-center gap-2">
                <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                <span>Thinking Process</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {thinkingContent.length} characters
                </span>
              </summary>
              <div className="px-3 pb-3 pt-1">
                <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                  {thinkingContent}
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Tool calls area */}
        {hasTools && (
          <ToolCallsGroup
            message={message}
            onLinkDetected={onLinkDetected}
          />
        )}
      </MessageBubble>
    </div>
  );
};
