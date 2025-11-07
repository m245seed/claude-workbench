/**
 * Tool registration initialization module
 *
 * Register all tool Widget components to toolRegistry
 * Call initializeToolRegistry() at application startup to complete registration
 */

import { toolRegistry, ToolRenderer, ToolRenderProps } from './toolRegistry';
import {
  TodoWidget,
  LSWidget,
  ReadWidget,
  EditWidget,
  MultiEditWidget,
  BashWidget,
  GrepWidget,
  GlobWidget,
  WriteWidget,
  WebSearchWidget,
  WebFetchWidget,
  BashOutputWidget,
  MCPWidget,
  TaskWidget,
  CommandWidget,
  CommandOutputWidget,
  SummaryWidget,
  SystemReminderWidget,
  SystemInitializedWidget,
  ThinkingWidget,
} from '@/components/ToolWidgets';

/**
 * Tool adapter factory
 * Adapts old Widget components to the new ToolRenderProps interface
 */
function createToolAdapter<T extends Record<string, any>>(
  WidgetComponent: React.FC<T>,
  propsMapper: (renderProps: ToolRenderProps) => T
): React.FC<ToolRenderProps> {
  return (renderProps: ToolRenderProps) => {
    const widgetProps = propsMapper(renderProps);
    return <WidgetComponent {...widgetProps} />;
  };
}

/**
 * Register all built-in tools
 */
export function initializeToolRegistry(): void {
  const extractStringContent = (value: unknown): string => {
    if (typeof value === 'string') {
      return value;
    }

    if (value == null) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.map(extractStringContent).filter(Boolean).join('\n');
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;

      if (typeof record.text === 'string') {
        return record.text;
      }

      if (typeof record.message === 'string') {
        return record.message;
      }

      if (typeof record.content === 'string') {
        return record.content;
      }

      try {
        return JSON.stringify(record, null, 2);
      } catch {
        return String(record);
      }
    }

    return String(value);
  };

  const extractTaggedValue = (content: string, tag: string): string | undefined => {
    if (!content) {
      return undefined;
    }

    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = content.match(regex);
    return match?.[1]?.trim() || undefined;
  };

  const tools: ToolRenderer[] = [
    // TodoWrite / TodoRead
    {
      name: 'todowrite',
      render: createToolAdapter(TodoWidget, (props) => ({
        todos: props.input?.todos || [],
        result: props.result,
      })),
      description: 'Todo list management tool',
    },
    {
      name: 'todoread',
      render: createToolAdapter(TodoWidget, (props) => ({
        todos: props.input?.todos || props.result?.content || [],
        result: props.result,
      })),
      description: 'Todo list reading tool',
    },

    // LS - 列出目录
    {
      name: 'ls',
      render: createToolAdapter(LSWidget, (props) => ({
        path: props.input?.path || '.',
        result: props.result,
      })),
      description: 'Directory listing tool',
    },

    // Read - 读取文件
    {
      name: 'read',
      render: createToolAdapter(ReadWidget, (props) => ({
        filePath: props.input?.file_path || props.input?.path || '',
        result: props.result,
      })),
      description: 'File reading tool',
    },

    // Edit - 编辑文件
    {
      name: 'edit',
      render: createToolAdapter(EditWidget, (props) => ({
        file_path: props.input?.file_path || '',
        old_string: props.input?.old_string || '',
        new_string: props.input?.new_string || '',
        result: props.result,
      })),
      description: 'File editing tool (search and replace)',
    },

    // MultiEdit - 批量编辑
    {
      name: 'multiedit',
      render: createToolAdapter(MultiEditWidget, (props) => ({
        file_path: props.input?.file_path || '',
        edits: props.input?.edits || [],
        result: props.result,
      })),
      description: 'Batch file editing tool',
    },

    // Bash - 执行命令
    {
      name: 'bash',
      render: createToolAdapter(BashWidget, (props) => ({
        command: props.input?.command || '',
        description: props.input?.description,
        result: props.result,
      })),
      description: 'Bash command execution tool',
    },

    // Grep - 搜索内容
    {
      name: 'grep',
      render: createToolAdapter(GrepWidget, (props) => ({
        pattern: props.input?.pattern || '',
        path: props.input?.path,
        include: props.input?.include,
        exclude: props.input?.exclude,
        result: props.result,
      })),
      description: 'Code search tool',
    },

    // Glob - 查找文件
    {
      name: 'glob',
      render: createToolAdapter(GlobWidget, (props) => ({
        pattern: props.input?.pattern || '',
        path: props.input?.path,
        result: props.result,
      })),
      description: 'File matching search tool',
    },

    // Write - 写入文件
    {
      name: 'write',
      render: createToolAdapter(WriteWidget, (props) => ({
        filePath: props.input?.file_path || '',
        content: props.input?.content || '',
        result: props.result,
      })),
      description: 'File writing tool',
    },

    // WebSearch - 网络搜索
    {
      name: 'websearch',
      render: createToolAdapter(WebSearchWidget, (props) => ({
        query: props.input?.query || '',
        result: props.result,
      })),
      description: 'Web search tool',
    },

    // WebFetch - 获取网页
    {
      name: 'webfetch',
      render: createToolAdapter(WebFetchWidget, (props) => ({
        url: props.input?.url || '',
        prompt: props.input?.prompt,
        result: props.result,
      })),
      description: 'Web page fetch tool',
    },

    // BashOutput - 后台命令输出
    {
      name: 'bashoutput',
      render: createToolAdapter(BashOutputWidget, (props) => ({
        bash_id: props.input?.bash_id || '',
        result: props.result,
      })),
      description: 'Background command output viewing tool',
    },

    // MCP 工具（正则匹配）
    {
      name: 'mcp',
      pattern: /^mcp__/,
      priority: 10,
      render: createToolAdapter(MCPWidget, (props) => ({
        toolName: props.toolName,
        input: props.input,
        result: props.result,
      })),
      description: 'Model Context Protocol tool (general)',
    },

    // Task - 子代理工具（Claude Code 特有）
    {
      name: 'task',
      render: createToolAdapter(TaskWidget, (props) => ({
        description: props.input?.description ?? props.result?.content?.description,
        prompt: props.input?.prompt ?? props.result?.content?.prompt,
        result: props.result,
      })),
      description: 'Claude Code sub-agent tool',
    },

    // System Reminder - 系统提醒信息
    {
      name: 'system_reminder',
      pattern: /^system[-_]reminder$/,
      render: createToolAdapter(SystemReminderWidget, (props) => {
        const raw = extractStringContent(props.input?.message ?? props.result?.content ?? '');
        const message = extractTaggedValue(raw, 'system-reminder') ?? raw.trim();

        return {
          message: message || '系统提醒',
        };
      }),
      description: 'System reminder display',
    },

    // Command - 命令信息展示
    {
      name: 'command',
      render: createToolAdapter(CommandWidget, (props) => {
        const raw = extractStringContent(props.input?.raw ?? props.result?.content ?? '');
        const commandName = props.input?.commandName
          ?? props.input?.command_name
          ?? extractTaggedValue(raw, 'command-name')
          ?? props.toolName;
        const commandMessage = props.input?.commandMessage
          ?? props.input?.command_message
          ?? extractTaggedValue(raw, 'command-message')
          ?? raw;
        const commandArgs = props.input?.commandArgs
          ?? props.input?.command_args
          ?? extractTaggedValue(raw, 'command-args');

        return {
          commandName: commandName || props.toolName,
          commandMessage,
          commandArgs,
        };
      }),
      description: 'Slash command display',
    },

    // Command Output - 命令输出展示
    {
      name: 'command_output',
      pattern: /^command[-_]?(output|result)$/,
      render: createToolAdapter(CommandOutputWidget, (props) => ({
        output: extractStringContent(props.result?.content ?? props.input?.output ?? ''),
        onLinkDetected: props.onLinkDetected,
      })),
      description: 'Command execution output',
    },

    // Summary - 会话总结展示
    {
      name: 'summary',
      render: createToolAdapter(SummaryWidget, (props) => ({
        summary: extractStringContent(props.input?.summary ?? props.result?.content ?? ''),
        leafUuid: props.input?.leafUuid ?? props.input?.leaf_uuid ?? props.result?.content?.leafUuid,
        usage: props.input?.usage ?? (props.result as any)?.usage,
      })),
      description: 'Session summary display',
    },

    // System Initialized - 系统初始化信息
    {
      name: 'system_initialized',
      pattern: /^system[_-]?init(?:ialized)?$/,
      render: createToolAdapter(SystemInitializedWidget, (props) => ({
        sessionId: props.input?.sessionId ?? props.input?.session_id ?? props.result?.content?.sessionId,
        model: props.input?.model ?? props.result?.content?.model,
        cwd: props.input?.cwd ?? props.result?.content?.cwd,
        tools: props.input?.tools ?? props.result?.content?.tools,
        timestamp: props.input?.timestamp ?? props.result?.content?.timestamp,
      })),
      description: 'System initialization info display',
    },

    // Thinking - 思考过程展示
    {
      name: 'thinking',
      render: createToolAdapter(ThinkingWidget, (props) => ({
        thinking: extractStringContent(props.input?.thinking ?? props.result?.content ?? ''),
        signature: props.input?.signature ?? props.result?.content?.signature,
        usage: props.input?.usage ?? (props.result as any)?.usage,
      })),
      description: 'AI thinking process display',
    },
  ];

  // Batch register all tools
  toolRegistry.registerBatch(tools);

  // Output registration statistics
  const stats = toolRegistry.getStats();
  console.log(`[ToolRegistry] Tool registration complete: ${stats.total} tools, ${stats.withPattern} pattern-matching tools`);
}

/**
 * Register custom tool (for external extension use)
 */
export function registerCustomTool(tool: ToolRenderer): void {
  toolRegistry.register(tool);
  console.log(`[ToolRegistry] Custom tool registered: ${tool.name}`);
}

/**
 * Get the list of all registered tools (for debugging)
 */
export function getRegisteredTools(): ToolRenderer[] {
  return toolRegistry.getAllRenderers();
}
