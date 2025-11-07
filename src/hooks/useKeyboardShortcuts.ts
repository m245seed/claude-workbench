/**
 * Keyboard shortcut hook
 *
 * Extracted from ClaudeCodeSession (original lines 405-462)
 * Handles double ESC and Shift+Tab shortcut detection
 */

import { useEffect, useState } from 'react';

interface KeyboardShortcutsConfig {
  /** 是否激活（用于多标签管理） */
  isActive: boolean;
  /** 切换 Plan Mode */
  onTogglePlanMode: () => void;
}

/**
 * 键盘快捷键 Hook
 *
 * @param config - 配置对象
 *
 * @example
 * useKeyboardShortcuts({
 *   isActive: true,
 *   onTogglePlanMode: () => setIsPlanMode(prev => !prev)
 * });
 */
export function useKeyboardShortcuts(config: KeyboardShortcutsConfig): void {
  const { isActive, onTogglePlanMode } = config;

  const [lastEscapeTime, setLastEscapeTime] = useState(0);

  // Double ESC key detection for future rewind dialog
  // NOTE: Currently placeholder - rewind dialog UI not implemented yet
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isActive) {
        const now = Date.now();

        // Check if this is a double ESC within 300ms
        if (now - lastEscapeTime < 300) {
          event.preventDefault();
          event.stopPropagation();

          // TODO: Show rewind dialog when UI is implemented
          console.log('[KeyboardShortcuts] Double ESC detected - rewind dialog placeholder');
        }

        setLastEscapeTime(now);
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handleEscapeKey, { capture: true });
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey, { capture: true });
    };
  }, [lastEscapeTime, isActive]);

  // Shift+Tab for Plan Mode toggle (single press, consistent with Claude Code official)
  useEffect(() => {
    const handlePlanModeToggle = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && event.shiftKey && isActive) {
          event.preventDefault();
          event.stopPropagation();

        // Toggle Plan Mode (single press, as per official Claude Code)
          onTogglePlanMode();
          console.log('[KeyboardShortcuts] Shift+Tab detected - toggling Plan Mode');
      }
    };

    if (isActive) {
      document.addEventListener('keydown', handlePlanModeToggle, { capture: true });
    }

    return () => {
      document.removeEventListener('keydown', handlePlanModeToggle, { capture: true });
    };
  }, [isActive, onTogglePlanMode]);
}
