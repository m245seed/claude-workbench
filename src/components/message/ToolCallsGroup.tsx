/**
 * ToolCallsGroup - Tool Calls Group Component (Refactored Version)
 *
 * Based on plugin architecture of tool registry
 * Supports batch management of tool calls, provides collapse/expand functionality
 * When tool count >= 3, collapse by default, display summary information
 */

import React, { memo, useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Wrench, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toolRegistry } from '@/lib/toolRegistry';
import { useToolResults } from '@/hooks/useToolResults';
import type { ClaudeStreamMessage } from '@/types/claude';
import type { ToolResultEntry } from '@/contexts/MessagesContext';

interface ToolCall {
  id: string;
  type: 'tool_use';
  name: string;
  input?: Record<string, any>;
}

export interface ToolCallsGroupProps {
  /** Message data */
  message: ClaudeStreamMessage;

  /** Default collapsed state */
  defaultCollapsed?: boolean;

  /** Collapse threshold (when tool count >= this value, collapse by default) */
  collapseThreshold?: number;

  /** Collapse state change callback */
  onToggle?: (collapsed: boolean) => void;

  /** Link detection callback */
  onLinkDetected?: (url: string) => void;

  /** Custom class name */
  className?: string;
}

export const ToolCallsGroup: React.FC<ToolCallsGroupProps> = ({
  message,
  defaultCollapsed,
  collapseThreshold = 3,
  onToggle,
  onLinkDetected,
  className,
}) => {
  // 提取工具调用
  const toolCalls = useMemo((): ToolCall[] => {
    if (!message.message?.content || !Array.isArray(message.message.content)) {
      return [];
    }
    return message.message.content.filter((item: any) => item.type === 'tool_use') as ToolCall[];
  }, [message]);

  const { getResultById, getStatusById } = useToolResults();

  // 自动判断是否应该折叠
  const shouldCollapse = defaultCollapsed ?? toolCalls.length >= collapseThreshold;
  const [isCollapsed, setIsCollapsed] = useState(shouldCollapse);

  // 计算工具执行统计
  const stats = useMemo(() => {
    let successCount = 0;
    let errorCount = 0;
    let pendingCount = 0;

    toolCalls.forEach(tool => {
      const status = getStatusById(tool.id);
      if (status === 'pending') {
        pendingCount++;
      } else if (status === 'error') {
        errorCount++;
      } else {
        successCount++;
      }
    });

    return { successCount, errorCount, pendingCount, total: toolCalls.length };
  }, [toolCalls, getStatusById]);

  // 切换折叠状态
  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onToggle?.(newState);
  };

  // 获取工具类型摘要
  const toolTypesSummary = useMemo(() => {
    const types = new Set(toolCalls.map(t => t.name));
    const typeArray = Array.from(types);
    if (typeArray.length <= 3) {
      return typeArray.join(', ');
    }
    return `${typeArray.slice(0, 3).join(', ')} +${typeArray.length - 3}`;
  }, [toolCalls]);

  if (toolCalls.length === 0) return null;

  // 只有一个工具时，直接渲染不提供折叠功能
  if (toolCalls.length === 1) {
    const tool = toolCalls[0];
    return (
      <div className={cn('tool-single-call my-2', className)}>
        <SingleToolCall
          tool={tool}
          result={getResultById(tool.id)}
          status={getStatusById(tool.id)}
          onLinkDetected={onLinkDetected}
        />
      </div>
    );
  }

  return (
    <div className={cn('tool-calls-group my-2 border border-border rounded-lg overflow-hidden', className)}>
      {/* 折叠/展开头部 */}
      <button
        onClick={toggleCollapse}
        className="flex items-center gap-2 w-full px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
        <Wrench className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="font-medium text-sm">Tool Calls ({stats.total})</span>

        {/* 状态徽章 */}
        <div className="flex items-center gap-2 ml-auto">
          {stats.successCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded">
              <CheckCircle className="w-3 h-3" />
              {stats.successCount}
            </span>
          )}
          {stats.errorCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-500/10 px-2 py-1 rounded">
              <AlertCircle className="w-3 h-3" />
              {stats.errorCount}
            </span>
          )}
          {stats.pendingCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-500/10 px-2 py-1 rounded">
              <Loader2 className="w-3 h-3 animate-spin" />
              {stats.pendingCount}
            </span>
          )}
        </div>

        <span className="text-xs text-muted-foreground ml-2 truncate max-w-[200px]">{toolTypesSummary}</span>
      </button>

      {/* 折叠摘要或完整内容 */}
      {isCollapsed ? (
        <CollapsedSummary
          toolCalls={toolCalls}
          getStatusById={getStatusById}
        />
      ) : (
        <div className="space-y-2 p-4 bg-background">
          {toolCalls.map((tool, index) => (
            <SingleToolCall
              key={tool.id}
              tool={tool}
              result={getResultById(tool.id)}
              status={getStatusById(tool.id)}
              onLinkDetected={onLinkDetected}
              index={index + 1}
              total={toolCalls.length}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Summary display when collapsed
 */
interface CollapsedSummaryProps {
  toolCalls: ToolCall[];
  getStatusById: (toolUseId?: string | null) => 'pending' | 'success' | 'error';
}

const CollapsedSummary: React.FC<CollapsedSummaryProps> = ({ toolCalls, getStatusById }) => {
  return (
    <div className="px-4 py-3 bg-background/50 border-t border-border space-y-2">
      {/* 显示前3个工具 */}
      {toolCalls.slice(0, 3).map((tool, idx) => {
        const status = getStatusById(tool.id);
        const hasResult = status !== 'pending';
        const isError = status === 'error';

        let StatusIcon = Loader2;
        let statusColor = 'text-blue-600';

        if (hasResult) {
          if (isError) {
            StatusIcon = AlertCircle;
            statusColor = 'text-red-600';
          } else {
            StatusIcon = CheckCircle;
            statusColor = 'text-green-600';
          }
        }

        return (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <StatusIcon className={cn('w-3 h-3', statusColor, !hasResult && 'animate-spin')} />
            <span className="font-mono font-medium">{tool.name}</span>
            {tool.input?.path && <span className="text-muted-foreground truncate">: {tool.input.path}</span>}
          </div>
        );
      })}

      {toolCalls.length > 3 && (
        <div className="text-xs text-muted-foreground pl-5">There are {toolCalls.length - 3} more tools...</div>
      )}

      <div className="text-[10px] text-muted-foreground/70 pt-1">Click to expand and view details</div>
    </div>
  );
};

/**
 * Single tool call rendering
 */
interface SingleToolCallProps {
  tool: ToolCall;
  result?: ToolResultEntry;
  status: 'pending' | 'success' | 'error';
  onLinkDetected?: (url: string) => void;
  index?: number;
  total?: number;
}

const SingleToolCallComponent: React.FC<SingleToolCallProps> = ({ tool, result, status, onLinkDetected, index, total }) => {
  const renderer = toolRegistry.getRenderer(tool.name);

  const normalizedResult = result
    ? {
        content: result.content,
        is_error: result.isError,
      }
    : undefined;

  // 构建渲染 props
  const renderProps = {
    toolName: tool.name,
    input: tool.input,
    result: normalizedResult,
    toolId: tool.id,
    onLinkDetected,
  };

  // 判断状态
  const hasResult = status !== 'pending';
  const isError = status === 'error';

  let StatusIcon = Loader2;
  let statusColor = 'text-blue-600';
  let statusBg = 'bg-blue-500/10';
  let borderColor = 'border-blue-500/20';

  if (hasResult) {
    if (isError) {
      StatusIcon = AlertCircle;
      statusColor = 'text-red-600';
      statusBg = 'bg-red-500/10';
      borderColor = 'border-red-500/20';
    } else {
      StatusIcon = CheckCircle;
      statusColor = 'text-green-600';
      statusBg = 'bg-green-500/10';
      borderColor = 'border-green-500/20';
    }
  }

  return (
    <div className={cn('tool-call-item bg-card border rounded-lg p-3', borderColor)}>
      {/* 工具头部 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn('w-4 h-4', statusColor, !hasResult && 'animate-spin')} />
          <span className="font-mono text-sm font-medium">{tool.name}</span>
          {index && total && (
            <span className="text-xs text-muted-foreground">
              ({index}/{total})
            </span>
          )}
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded', statusBg, statusColor)}>
          {hasResult ? (isError ? 'Failed' : 'Success') : 'Executing'}
        </span>
      </div>

      {/* 使用注册的工具渲染器 */}
      {renderer ? (
        <div className="tool-widget-container">
          <renderer.render {...renderProps} />
        </div>
      ) : (
        <FallbackToolRender tool={tool} result={normalizedResult} />
      )}
    </div>
  );
};

SingleToolCallComponent.displayName = "SingleToolCall";

const SingleToolCall = memo(SingleToolCallComponent);

/**
 * Fallback rendering for unregistered tools
 */
interface FallbackToolRenderProps {
  tool: ToolCall;
  result?: {
    content?: any;
    is_error?: boolean;
  };
}

const FallbackToolRender: React.FC<FallbackToolRenderProps> = ({ tool, result }) => {
  return (
    <div className="fallback-tool-render space-y-2 text-xs">
      <div className="text-muted-foreground">This tool has not registered a dedicated renderer, displaying raw data:</div>

      {tool.input && Object.keys(tool.input).length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            Input Parameters
          </summary>
          <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(tool.input, null, 2)}
          </pre>
        </details>
      )}

      {result && (
        <div className={cn('p-2 rounded', result.is_error ? 'bg-red-500/10' : 'bg-muted')}>
          <div className="font-medium mb-1 text-xs">{result.is_error ? 'Execution Failed' : 'Execution Result'}:</div>
          <pre className="text-[10px] overflow-x-auto whitespace-pre-wrap">
            {typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ToolCallsGroup;
