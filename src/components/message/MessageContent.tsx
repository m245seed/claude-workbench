import React, { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { getClaudeSyntaxTheme } from "@/lib/claudeSyntaxTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";

interface CodeBlockRendererProps {
  language: string;
  code: string;
  syntaxTheme: any;
}

const CodeBlockRenderer: React.FC<CodeBlockRendererProps> = ({ language, code, syntaxTheme }) => {
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!code) {
      return;
    }

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }

    try {
      await copyTextToClipboard(code);
      console.log('[CodeBlock] Copied to clipboard:', code.substring(0, 50) + '...');
      setCopyState('success');
    } catch (error) {
      console.error('[CodeBlock] Copy failed:', error);
      setCopyState('error');
    } finally {
      resetTimerRef.current = window.setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  const buttonLabel =
    copyState === 'success' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy';

  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border rounded-t-lg">
        <span className="text-xs font-mono text-muted-foreground">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            "text-xs px-2 py-1 rounded bg-background transition-colors opacity-0 group-hover:opacity-100",
            copyState === 'success' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            copyState === 'error' && "bg-destructive/10 text-destructive"
          )}
        >
          {buttonLabel}
        </button>
      </div>

      <div className="rounded-b-lg overflow-hidden">
        <SyntaxHighlighter
          style={syntaxTheme}
          language={language}
          PreTag="div"
          showLineNumbers={true}
          customStyle={{
            margin: 0,
            background: 'transparent',
            lineHeight: '1.6'
          }}
          codeTagProps={{
            style: {
              fontSize: '0.875rem',
              userSelect: 'text',
              WebkitUserSelect: 'text',
              cursor: 'text'
            }
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

interface MessageContentProps {
  /** Markdown content */
  content: string;
  /** Custom class name */
  className?: string;
  /** Whether it is streaming output */
  isStreaming?: boolean;
}

/**
 * Message content rendering component
 * Supports Markdown + code highlighting
 */
const MessageContentComponent: React.FC<MessageContentProps> = ({
  content,
  className,
  isStreaming = false
}) => {
  const { theme } = useTheme();
  const syntaxTheme = getClaudeSyntaxTheme(theme === 'dark');

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code block rendering
          code(props: any) {
            const { inline, className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            if (inline || !language) {
              return (
                <code className={cn("px-1.5 py-0.5 rounded bg-muted text-xs", className)} {...rest}>
                  {children}
                </code>
              );
            }

            const code = String(children).replace(/\n$/, '');
            return (
              <CodeBlockRenderer
                language={language}
                code={code}
                syntaxTheme={syntaxTheme}
              />
            );
          },
          
          // Link rendering
          a({ node, children, href, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          
          // Table rendering
          table({ node, children, ...props }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full divide-y divide-border" {...props}>
                  {children}
                </table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      
      {/* Streaming output indicator */}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
      )}
    </div>
  );
};

MessageContentComponent.displayName = "MessageContent";

export const MessageContent = memo(MessageContentComponent);
