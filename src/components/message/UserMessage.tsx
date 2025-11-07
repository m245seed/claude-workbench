import React, { useState, useEffect } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageHeader } from "./MessageHeader";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { ClaudeStreamMessage } from '@/types/claude';
import type { RewindCapabilities, RewindMode } from '@/lib/api';
import { api } from '@/lib/api';

interface UserMessageProps {
  /** Message data */
  message: ClaudeStreamMessage;
  /** Custom class name */
  className?: string;
  /** Prompt index (only counts user prompts) */
  promptIndex?: number;
  /** Session ID */
  sessionId?: string;
  /** Project ID */
  projectId?: string;
  /** Revert callback */
  onRevert?: (promptIndex: number, mode: RewindMode) => void;
}

/**
 * Check if it's a Skills message
 */
const isSkillsMessage = (text: string): boolean => {
  return text.includes('<command-name>') 
    || text.includes('Launching skill:')
    || text.includes('skill is running');
};

/**
 * Format Skills message display
 */
const formatSkillsMessage = (text: string): React.ReactNode => {
  // Extract command-name and command-message
  const commandNameMatch = text.match(/<command-name>(.+?)<\/command-name>/);
  const commandMessageMatch = text.match(/<command-message>(.+?)<\/command-message>/);
  
  if (commandNameMatch || commandMessageMatch) {
    return (
      <div className="space-y-2">
        {commandMessageMatch && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">✓</span>
            <span>{commandMessageMatch[1]}</span>
          </div>
        )}
        {commandNameMatch && (
          <div className="text-xs text-muted-foreground font-mono">
            Skill: {commandNameMatch[1]}
          </div>
        )}
      </div>
    );
  }
  
  // Handle "Launching skill:" format
  if (text.includes('Launching skill:')) {
    const skillNameMatch = text.match(/Launching skill: (.+)/);
    if (skillNameMatch) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">✓</span>
            <span>Skill</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Launching skill: <span className="font-mono">{skillNameMatch[1]}</span>
          </div>
        </div>
      );
    }
  }
  
  return text;
};

/**
 * Extract plain text content from user message
 */
const extractUserText = (message: ClaudeStreamMessage): string => {
  if (!message.message?.content) return '';
  
  const content = message.message.content;
  
  let text = '';
  
  // If it's a string, use directly
  if (typeof content === 'string') {
    text = content;
  } 
  // If it's an array, extract all text type content
  else if (Array.isArray(content)) {
    text = content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text || '')
      .join('\n');
  }
  
  // ⚡ Key fix: JSONL saved as \\n (double backslash), needs to be replaced with real newline
  // Regex /\\\\n/ matches two backslashes+n
  if (text.includes('\\')) {
    text = text
      .replace(/\\\\n/g, '\n')      // \\n (double backslash+n) → newline
      .replace(/\\\\r/g, '\r')      // \\r → carriage return
      .replace(/\\\\t/g, '\t')      // \\t → tab
      .replace(/\\\\"/g, '"')       // \\" → double quote
      .replace(/\\\\'/g, "'")       // \\' → single quote
      .replace(/\\\\\\\\/g, '\\');  // \\\\ → single backslash (last)
  }
  
  return text;
};

/**
 * User message component
 * Right-aligned bubble style, concise display
 */
export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  className,
  promptIndex,
  sessionId,
  projectId,
  onRevert
}) => {
  const text = extractUserText(message);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [capabilities, setCapabilities] = useState<RewindCapabilities | null>(null);
  const [isLoadingCapabilities, setIsLoadingCapabilities] = useState(false);

  // If no text content, do not render
  if (!text) return null;

  // ⚡ Check if it's a Skills message
  const isSkills = isSkillsMessage(text);
  const displayContent = isSkills ? formatSkillsMessage(text) : text;

  // Check revert capabilities
  useEffect(() => {
    const loadCapabilities = async () => {
      if (promptIndex === undefined || !sessionId || !projectId) return;

      setIsLoadingCapabilities(true);
      try {
        const caps = await api.checkRewindCapabilities(sessionId, projectId, promptIndex);
        setCapabilities(caps);
      } catch (error) {
        console.error('Failed to check rewind capabilities:', error);
      } finally {
        setIsLoadingCapabilities(false);
      }
    };

    if (showConfirmDialog) {
      loadCapabilities();
    }
  }, [showConfirmDialog, promptIndex, sessionId, projectId]);

  const handleRevertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (promptIndex === undefined || !onRevert) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmRevert = (mode: RewindMode) => {
    if (promptIndex !== undefined && onRevert) {
      setShowConfirmDialog(false);
      onRevert(promptIndex, mode);
    }
  };

  const showRevertButton = promptIndex !== undefined && promptIndex >= 0 && onRevert;
  const hasWarning = capabilities && !capabilities.code;

  return (
    <>
    <div className={cn("group relative", className)}>
      <MessageBubble variant="user">
          <div className="relative">
        {/* Message header */}
        <MessageHeader
          variant="user"
          timestamp={message.timestamp}
          showAvatar={false}
        />

        {/* Message content and revert button - display in one row */}
        <div className="flex items-start gap-2">
        {/* Message content */}
          <div className={cn(
            "text-sm leading-relaxed flex-1",
            isSkills ? "" : "whitespace-pre-wrap"
          )}>
            {displayContent}
            </div>

          {/* Revert button and warning icon - do not show revert button for Skills messages */}
            {showRevertButton && !isSkills && (
            <div className="flex-shrink-0 flex items-center gap-1">
              {/* CLI prompt warning icon */}
              {hasWarning && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center h-7 w-7">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-sm">
                        {capabilities?.warning || "This prompt cannot rollback code"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Revert button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                      variant="outline"
                        size="sm"
                      className="h-7 w-7 p-0 rounded-full border-primary-foreground/20 text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 hover:border-primary-foreground/40 transition-all"
                        onClick={handleRevertClick}
                      >
                      <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                  <TooltipContent side="top">
                    Revert to this message
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
        </div>
        </div>
      </MessageBubble>
    </div>

      {/* Revert confirmation dialog - three mode selection */}
      {showConfirmDialog && (
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Select revert mode
              </DialogTitle>
              <DialogDescription>
                Will revert to prompt #{(promptIndex ?? 0) + 1}, please select a revert mode
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* CLI prompt warning */}
              {capabilities?.warning && (
                <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800 dark:text-orange-200">
                    {capabilities.warning}
                  </AlertDescription>
                </Alert>
              )}

              {/* Loading state */}
              {isLoadingCapabilities && (
                <div className="flex items-center justify-center py-4">
                  <div className="text-sm text-muted-foreground">Checking revert capabilities...</div>
                </div>
              )}

              {/* Three mode selection */}
              {!isLoadingCapabilities && capabilities && (
                <div className="space-y-3">
                  <div className="text-sm font-medium">Select revert content:</div>

                  {/* Mode 1: Conversation only */}
                  <div className={cn(
                    "p-4 rounded-lg border-2 cursor-pointer transition-all duration-200",
                    "hover:border-primary hover:bg-accent/50 hover:shadow-md hover:scale-[1.02]",
                    "active:scale-[0.98]"
                  )}
                    onClick={() => handleConfirmRevert("conversation_only")}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">Delete conversation only</div>
                        <div className="text-sm text-muted-foreground">
                          Delete this message and all following conversations, code remains unchanged
                        </div>
                      </div>
                      <div className="text-xs text-green-600 font-medium bg-green-50 dark:bg-green-950 px-2 py-1 rounded">
                        Always available
                      </div>
                    </div>
                  </div>

                  {/* Mode 2: Code only */}
                  <div className={cn(
                    "p-4 rounded-lg border-2 transition-all duration-200",
                    capabilities.code
                      ? "cursor-pointer hover:border-primary hover:bg-accent/50 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                      : "opacity-50 cursor-not-allowed bg-muted"
                  )}
                    onClick={() => capabilities.code && handleConfirmRevert("code_only")}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">Rollback code only</div>
                        <div className="text-sm text-muted-foreground">
                          Code will rollback to the state before this message, conversation history will be kept
                        </div>
                      </div>
                      <div className={cn(
                        "text-xs font-medium px-2 py-1 rounded",
                        capabilities.code
                          ? "text-green-600 bg-green-50 dark:bg-green-950"
                          : "text-muted-foreground bg-muted"
                      )}>
                        {capabilities.code ? "Available" : "Unavailable"}
                      </div>
                    </div>
                  </div>

                  {/* Mode 3: Both */}
                  <div className={cn(
                    "p-4 rounded-lg border-2 transition-all duration-200",
                    capabilities.both
                      ? "cursor-pointer hover:border-primary hover:bg-accent/50 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                      : "opacity-50 cursor-not-allowed bg-muted"
                  )}
                    onClick={() => capabilities.both && handleConfirmRevert("both")}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">Full revert</div>
                        <div className="text-sm text-muted-foreground">
                          Delete conversation and rollback code, restore to the complete state before this message
                        </div>
                      </div>
                      <div className={cn(
                        "text-xs font-medium px-2 py-1 rounded",
                        capabilities.both
                          ? "text-green-600 bg-green-50 dark:bg-green-950"
                          : "text-muted-foreground bg-muted"
                      )}>
                        {capabilities.both ? "Available" : "Unavailable"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This action is irreversible. Deleted conversations cannot be recovered.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
