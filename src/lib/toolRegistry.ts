/**
 * Tool Registry Center - Plugin-based Tool Rendering System
 *
 * Provides a dynamic tool registration mechanism to avoid hard-coded conditional judgments
 * Supports regex matching and priority resolution for MCP tools
 */

import { FC } from 'react';

/**
 * Unified interface for tool rendering props
 */
export interface ToolRenderProps {
  /** Tool name (lowercase, normalized) */
  toolName: string;

  /** Tool input object */
  input?: Record<string, any>;

  /** Tool result object */
  result?: {
    content?: any;
    is_error?: boolean;
  };

  /** Unique tool ID */
  toolId?: string;

  /** Optional callback function */
  onLinkDetected?: (url: string) => void;
}

/**
 * Tool renderer definition
 */
export interface ToolRenderer {
  /** Tool name (for exact match) */
  name: string;

  /** Optional: regex match pattern (for MCP tools, etc.) */
  pattern?: RegExp;

  /** Render function */
  render: FC<ToolRenderProps>;

  /** Priority (higher number = higher priority, used to resolve conflicts) */
  priority?: number;

  /** Description */
  description?: string;
}

/**
 * Tool registry center class
 */
class ToolRegistryClass {
  private renderers: Map<string, ToolRenderer> = new Map();
  private patternRenderers: ToolRenderer[] = [];

  /**
   * Register a tool renderer
   */
  register(renderer: ToolRenderer): void {
    // Exact name registration
    this.renderers.set(renderer.name.toLowerCase(), renderer);

    // If there is a regex pattern, also add to pattern list
    if (renderer.pattern) {
      this.patternRenderers.push(renderer);
      // Sort by priority (descending)
      this.patternRenderers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
  }

  /**
   * Batch register tools
   */
  registerBatch(renderers: ToolRenderer[]): void {
    renderers.forEach(renderer => this.register(renderer));
  }

  /**
   * Unregister a tool renderer
   */
  unregister(name: string): void {
    const normalizedName = name.toLowerCase();
    const renderer = this.renderers.get(normalizedName);

    this.renderers.delete(normalizedName);

    // Remove from pattern list
    if (renderer?.pattern) {
      this.patternRenderers = this.patternRenderers.filter(r => r.name !== name);
    }
  }

  /**
   * Get tool renderer
   * @param toolName Tool name
   * @returns Renderer or null
   */
  getRenderer(toolName: string): ToolRenderer | null {
    const normalizedName = toolName.toLowerCase();

    // 1. Exact match
    const exactMatch = this.renderers.get(normalizedName);
    if (exactMatch) {
      return exactMatch;
    }

    // 2. Regex pattern match (in priority order)
    for (const renderer of this.patternRenderers) {
      if (renderer.pattern && renderer.pattern.test(toolName)) {
        return renderer;
      }
    }

    return null;
  }

  /**
   * Check if a tool is registered
   */
  hasRenderer(toolName: string): boolean {
    return this.getRenderer(toolName) !== null;
  }

  /**
   * Get all registered tool renderers
   */
  getAllRenderers(): ToolRenderer[] {
    return Array.from(this.renderers.values());
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.renderers.clear();
    this.patternRenderers = [];
  }

  /**
   * Get registration statistics
   */
  getStats(): { total: number; withPattern: number } {
    return {
      total: this.renderers.size,
      withPattern: this.patternRenderers.length,
    };
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistryClass();

// Export type (for testing, etc.)
export type ToolRegistry = ToolRegistryClass;
