import React from "react";
import { User, Bot, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageHeaderProps {
  /** Message type */
  variant: "user" | "assistant";
  /** Timestamp */
  timestamp?: string;
  /** Whether to show avatar */
  showAvatar?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Format timestamp to HH:MM:SS
 */
const formatTimestamp = (timestamp: string | undefined): string => {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleTimeString('zh-CN', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  } catch {
    return '';
  }
};

/**
 * Message header component
 * Display sender information and timestamp
 */
export const MessageHeader: React.FC<MessageHeaderProps> = ({
  variant,
  timestamp,
  showAvatar = true,
  className
}) => {
  const isUser = variant === "user";
  const Icon = isUser ? User : Bot;
  const label = isUser ? "You" : "Claude";
  const formattedTime = formatTimestamp(timestamp);

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground mb-2",
        isUser && "justify-end",
        className
      )}
    >
      {showAvatar && (
        <div
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full",
            isUser ? "bg-primary/10" : "bg-blue-500/10"
          )}
        >
          <Icon className={cn(
            "w-4 h-4",
            isUser ? "text-primary" : "text-blue-500"
          )} />
        </div>
      )}
      <span className="font-medium">{label}</span>
      {formattedTime && (
        <>
          <span className="text-muted-foreground/50">•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formattedTime}
          </span>
        </>
      )}
    </div>
  );
};
