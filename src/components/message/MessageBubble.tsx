import React, { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  /** Message type: user or assistant */
  variant: "user" | "assistant";
  /** Child content */
  children: React.ReactNode;
  /** Custom class name */
  className?: string;
  /** Whether it is streaming output */
  isStreaming?: boolean;
}

/**
 * Message bubble container component
 * 
 * User message: right-aligned bubble style
 * Assistant message: left-aligned card style
 */
const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  variant,
  children,
  className,
  isStreaming = false
}) => {
  const isUser = variant === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex w-full mb-6", // Restore mb-6 to ensure spacing between messages
        isUser ? "justify-end" : "justify-start",
        className
      )}
    >
      {isUser ? (
        // User message: compact bubble style
        <div className="flex flex-col items-end max-w-[85%] sm:max-w-[70%]">
          <div
            className={cn(
              "rounded-2xl px-4 py-3",
              "bg-primary text-primary-foreground",
              "shadow-sm",
              "break-words"
            )}
          >
            {children}
          </div>
        </div>
      ) : (
        // AI message: full-width card style
        <div className="flex flex-col w-full max-w-full">
          <div
            className={cn(
              "rounded-lg border",
              "bg-card text-card-foreground border-border",
              "shadow-md",
              "overflow-hidden",
              isStreaming && "ring-2 ring-primary/20 animate-pulse-subtle"
            )}
          >
            {children}
          </div>
        </div>
      )}
    </motion.div>
  );
};

MessageBubbleComponent.displayName = "MessageBubble";

export const MessageBubble = memo(MessageBubbleComponent);
