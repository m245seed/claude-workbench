import React, { useRef, useEffect, useCallback } from 'react';
import { ClaudeCodeSession } from './ClaudeCodeSession';
import { useTabSession } from '@/hooks/useTabs';
import type { Session } from '@/lib/api';

interface TabSessionWrapperProps {
  tabId: string;
  session?: Session;
  initialProjectPath?: string;
  onStreamingChange?: (isStreaming: boolean, sessionId: string | null) => void;
  isActive: boolean;
}

/**
 * TabSessionWrapper - Tab Session Wrapper
 * Provides independent session state management and lifecycle control for each tab
 * Optimized with React.memo to avoid unnecessary re-renders
 */
const TabSessionWrapperComponent: React.FC<TabSessionWrapperProps> = ({
  tabId,
  session,
  initialProjectPath,
  onStreamingChange,
  isActive,
}) => {
  const { tab, updateStreaming, setCleanup } = useTabSession(tabId);
  const sessionRef = useRef<{ hasChanges: boolean; sessionId: string | null }>({
    hasChanges: false,
    sessionId: null,
  });

  // 🔧 NEW: Register cleanup callback for proper resource management
  useEffect(() => {
    const cleanup = async () => {
      console.log(`[TabSessionWrapper] Cleaning up resources for tab ${tabId}`);
      // This will be called when the tab is closed
      // The ClaudeCodeSession cleanup is handled by its own useEffect
    };

    setCleanup(cleanup);
  }, [tabId, setCleanup]);

  // Wrap onStreamingChange to update tab state
  // 🔧 Performance fix: Use useCallback to avoid infinite render loops (from 1236 renders/s down to 1 render/s)
  const handleStreamingChange = useCallback((isStreaming: boolean, sessionId: string | null) => {
    sessionRef.current.sessionId = sessionId;
    updateStreaming(isStreaming, sessionId);
    onStreamingChange?.(isStreaming, sessionId);

    // 🔧 Remove automatic title update logic
    // Session ID is already displayed in Tooltip, no need to repeat in title
  }, [updateStreaming, onStreamingChange]);

  // Monitor session changes and mark as modified
  useEffect(() => {
    // Here we can monitor session content changes
    // Temporarily commented out, waiting for ClaudeCodeSession component to support change callbacks
  }, []);

  // When the tab becomes inactive, keep the session state in the background
  useEffect(() => {
    // Use tabId to get the latest tab information, avoid depending on tab object reference
    const currentTab = tab; // tab comes from useTabSession, but not as a dependency

    if (!isActive && currentTab) {
      console.log(`[TabSessionWrapper] Tab ${tabId} is now in background, preserving state`);
    } else if (isActive && currentTab) {
      console.log(`[TabSessionWrapper] Tab ${tabId} is now active`);
    }
  }, [isActive, tabId]); // Only depend on isActive and tabId, avoid infinite loops from object reference changes

  return (
    <div
      className="h-full w-full"
      // 🔧 REMOVED: display control CSS - now using conditional rendering
    >
      <ClaudeCodeSession
        session={session}
        initialProjectPath={initialProjectPath}
        onStreamingChange={handleStreamingChange}
        isActive={isActive}
      />
    </div>
  );
};

// Optimized with React.memo to avoid unnecessary re-renders
export const TabSessionWrapper = React.memo(TabSessionWrapperComponent, (prevProps, nextProps) => {
  // Custom comparison function, only re-render when these props change
  return (
    prevProps.tabId === nextProps.tabId &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.session?.id === nextProps.session?.id &&
    prevProps.initialProjectPath === nextProps.initialProjectPath
    // Function props like onStreamingChange are usually stable
  );
});