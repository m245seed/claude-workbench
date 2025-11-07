import React from "react";
import { UserMessage } from "./UserMessage";
import { AIMessage } from "./AIMessage";
import { SystemMessage } from "./SystemMessage";
import { ResultMessage } from "./ResultMessage";
import { SummaryMessage } from "./SummaryMessage";
import type { ClaudeStreamMessage } from '@/types/claude';
import type { RewindMode } from '@/lib/api';

interface StreamMessageV2Props {
  message: ClaudeStreamMessage;
  className?: string;
  onLinkDetected?: (url: string) => void;
  claudeSettings?: { showSystemInitialization?: boolean };
  isStreaming?: boolean;
  promptIndex?: number;
  sessionId?: string;
  projectId?: string;
  onRevert?: (promptIndex: number, mode: RewindMode) => void;
}

/**
 * StreamMessage V2 - Refactored message rendering component
 *
 * Using new bubble-style layout and component architecture
 * Phase 1: Basic message display ✓
 * Phase 2: Tool call folding ✓ (already implemented in ToolCallsGroup)
 * Phase 3: Tool registry center integration ✓ (already integrated toolRegistry)
 *
 * Architecture description:
 * - user message → UserMessage component
 * - assistant message → AIMessage component (integrated ToolCallsGroup + thinking blocks)
 * - system / result / summary → corresponding message components
 * - Other message types (meta, etc.) are ignored by default
 */
export const StreamMessageV2: React.FC<StreamMessageV2Props> = ({
  message,
  className,
  onLinkDetected,
  claudeSettings,
  isStreaming = false,
  promptIndex,
  sessionId,
  projectId,
  onRevert
}) => {
  const messageType = (message as ClaudeStreamMessage & { type?: string }).type ?? (message as any).type;

  switch (messageType) {
    case 'user':
      return (
        <UserMessage
          message={message}
          className={className}
          promptIndex={promptIndex}
          sessionId={sessionId}
          projectId={projectId}
          onRevert={onRevert}
        />
      );

    case 'assistant':
      return (
        <AIMessage
          message={message}
          isStreaming={isStreaming}
          onLinkDetected={onLinkDetected}
          className={className}
        />
      );

    case 'system':
      return (
        <SystemMessage
          message={message}
          className={className}
          claudeSettings={claudeSettings}
        />
      );

    case 'result':
      return (
        <ResultMessage
          message={message}
          className={className}
        />
      );

    case 'summary':
      return (
        <SummaryMessage
          message={message}
          className={className}
        />
      );

    // Silently ignore queue-operation messages (internal operations)
    case 'queue-operation':
      return null;

    default:
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[StreamMessageV2] Unhandled message type:', (message as any).type, message);
      }

      return null;
  }
};
