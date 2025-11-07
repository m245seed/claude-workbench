import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Settings, BarChart3, Network, Eye, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ClaudeStatusIndicator } from "@/components/ClaudeStatusIndicator";
import { UpdateBadge } from "@/components/UpdateBadge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

import type { ClaudeStreamMessage } from '@/types/claude';

interface TopbarProps {
  /**
   * Callback when CLAUDE.md is clicked
   */
  onClaudeClick: () => void;
  /**
   * Callback when Settings is clicked
   */
  onSettingsClick: () => void;
  /**
   * Callback when Usage Dashboard is clicked
   */
  onUsageClick: () => void;
  /**
   * Callback when MCP is clicked
   */
  onMCPClick: () => void;
  /**
   * Callback when Extensions is clicked
   */
  onExtensionsClick?: () => void;
  /**
   * Callback when Tabs is clicked
   */
  onTabsClick?: () => void;
  /**
   * Callback when Update badge is clicked
   */
  onUpdateClick?: () => void;
  /**
   * Number of open tabs
   */
  tabsCount?: number;
  /**
   * Optional messages for cost calculation
   */
  messages?: ClaudeStreamMessage[];
  /**
   * Optional session ID
   */
  sessionId?: string;
  /**
   * Optional className for styling
   */
  className?: string;
}

/**
 * 🎨 Modern Topbar Component - Material 3 Inspired
 * Features: Gradient background, glassmorphism, smooth animations
 * 
 * @example
 * <Topbar
 *   onClaudeClick={() => setView('editor')}
 *   onSettingsClick={() => setView('settings')}
 *   onMCPClick={() => setView('mcp')}
 * />
 */
export const Topbar: React.FC<TopbarProps> = ({
  onClaudeClick,
  onSettingsClick,
  onUsageClick,
  onMCPClick,
  onExtensionsClick,
  onTabsClick,
  onUpdateClick,
  tabsCount = 0,
  messages,
  sessionId,
  className,
}) => {
  const { t } = useTranslation();
  
  // Memoize the status indicator to prevent recreation on every render
  const statusIndicator = useMemo(
    () => <ClaudeStatusIndicator
      onSettingsClick={onSettingsClick}
      messages={messages}
      sessionId={sessionId}
    />,
    [onSettingsClick, messages, sessionId]
  );
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={cn(
        "flex items-center justify-between px-4 py-2",
        "border-b border-border/60",
        "bg-gradient-to-b from-background via-background to-muted/20",
        "backdrop-blur-lg supports-[backdrop-filter]:bg-background/80",
        "shadow-sm",
        className
      )}
    >
      {/* Status Indicator */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {statusIndicator}
      </motion.div>
      
      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="flex items-center gap-1"
      >
        {/* 主题切换按钮 - 移到最前面 */}
        <ThemeToggle variant="with-text" size="sm" className="hover:bg-muted/70 h-7 px-2 py-1 text-xs font-medium rounded-md gap-0 border border-border/40 shadow-sm hover:shadow" />

        {/* 分隔线 */}
        <div className="h-5 w-px bg-border/50 mx-0.5" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onUsageClick}
          className="text-xs font-medium px-2 py-1 h-7 hover:bg-muted/70 transition-all rounded-md gap-0 border border-border/40 shadow-sm hover:shadow"
        >
          <BarChart3 className="h-3.5 w-3.5" strokeWidth={2} />
          {t('navigation.usage')}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onClaudeClick}
          className="text-xs font-medium px-2 py-1 h-7 hover:bg-muted/70 transition-all rounded-md gap-0 border border-border/40 shadow-sm hover:shadow"
        >
          <FileText className="h-3.5 w-3.5" strokeWidth={2} />
          CLAUDE.md
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onMCPClick}
          className="text-xs font-medium px-2 py-1 h-7 hover:bg-muted/70 transition-all rounded-md gap-0 border border-border/40 shadow-sm hover:shadow"
        >
          <Network className="h-3.5 w-3.5" strokeWidth={2} />
          {t('navigation.mcpManager')}
        </Button>
        
        {/* 扩展管理器 */}
        {onExtensionsClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExtensionsClick}
            className="text-xs font-medium px-2 py-1 h-7 hover:bg-muted/70 transition-all rounded-md gap-0 border border-border/40 shadow-sm hover:shadow"
          >
            <Package className="h-3.5 w-3.5" strokeWidth={2} />
            {t('navigation.extensions')}
          </Button>
        )}

        {/* 分隔线 */}
        <div className="h-5 w-px bg-border/50 mx-0.5" />

        {/* 会话状态指示器 */}
        {onTabsClick && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onTabsClick}
              className="text-xs font-medium px-2 py-1 h-7 hover:bg-muted/70 transition-all rounded-md gap-0 border border-border/40 shadow-sm hover:shadow"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={2} />
              {t('navigation.viewSession')}
              {tabsCount > 0 && <span className="ml-1 text-xs">({tabsCount})</span>}
            </Button>

            {/* 分隔线 */}
            <div className="h-5 w-px bg-border/50 mx-0.5" />
          </>
        )}

        {/* Update Badge */}
        {onUpdateClick && (
          <UpdateBadge onClick={onUpdateClick} />
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={onSettingsClick}
          className="text-xs font-medium px-2 py-1 h-7 shadow-sm hover:shadow-md transition-all rounded-md gap-0"
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={2} />
          {t('navigation.settings')}
        </Button>
      </motion.div>
    </motion.div>
  );
}; 