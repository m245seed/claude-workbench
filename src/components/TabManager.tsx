import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, MoreHorizontal, MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TabSessionWrapper } from './TabSessionWrapper';
import { useTabs } from '@/hooks/useTabs';
import { useSessionSync } from '@/hooks/useSessionSync'; // 🔧 NEW: Session state sync
import type { Session } from '@/lib/api';

interface TabManagerProps {
  onBack: () => void;
  className?: string;
  /**
   * Initial session info – used when navigating from SessionList
   */
  initialSession?: Session;
  /**
   * Initial project path – used when creating a new session
   */
  initialProjectPath?: string;
}

/**
 * TabManager – multi‑tab session manager
 * Supports multiple Claude Code sessions running concurrently, keeping state in the background
 */
export const TabManager: React.FC<TabManagerProps> = ({
  onBack,
  className,
  initialSession,
  initialProjectPath,
}) => {
  const {
    tabs,
    createNewTab,
    switchToTab,
    closeTab,
    updateTabStreamingStatus,
    reorderTabs, // 🔧 NEW: drag‑and‑drop reorder
  } = useTabs();

  // 🔧 NEW: enable session state sync
  useSessionSync();

  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null); // 🔧 NEW: drag‑over position
  const [tabToClose, setTabToClose] = useState<string | null>(null); // 🔧 NEW: tab ID awaiting confirmation
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // ✨ Phase 3: Simple initialization flag (no complex state machine)
  const initializedRef = useRef(false);

  // Drag handling
  const handleTabDragStart = useCallback((tabId: string) => {
    setDraggedTab(tabId);
  }, []);

  const handleTabDragEnd = useCallback(() => {
    setDraggedTab(null);
    setDragOverIndex(null); // 🔧 NEW: clear drag‑over state
  }, []);

  // 🔧 NEW: drag‑over handling – calculate drop position
  const handleTabDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault(); // must prevent default to allow drop
    setDragOverIndex(index);
  }, []);

  // 🔧 NEW: drop handling – perform reorder
  const handleTabDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    if (!draggedTab) return;

    // Find the index of the dragged tab
    const fromIndex = tabs.findIndex(t => t.id === draggedTab);
    if (fromIndex === -1 || fromIndex === targetIndex) {
      setDraggedTab(null);
      setDragOverIndex(null);
      return;
    }

    // Perform reorder
    reorderTabs(fromIndex, targetIndex);
    setDraggedTab(null);
    setDragOverIndex(null);
  }, [draggedTab, tabs, reorderTabs]);

  // 🔧 NEW: handle tab close (supports confirmation dialog)
  const handleCloseTab = useCallback(async (tabId: string, force = false) => {
    const result = await closeTab(tabId, force);

    // If confirmation is needed, show dialog
    if (result && typeof result === 'object' && 'needsConfirmation' in result && result.needsConfirmation) {
      setTabToClose(result.tabId || null);
    }
  }, [closeTab]);

  // 🔧 NEW: confirm tab close
  const confirmCloseTab = useCallback(async () => {
    if (tabToClose) {
      await closeTab(tabToClose, true); // force close
      setTabToClose(null);
    }
  }, [tabToClose, closeTab]);

  // ✨ Phase 3: Simplified initialization (single responsibility, no race conditions)
  useEffect(() => {
    // Only run once
    if (initializedRef.current) return;
    initializedRef.current = true;

    // 🔧 Fix: new operation should overwrite any saved tabs
    const isNewOperation = initialSession || initialProjectPath;

    // Priority 1: Initial session provided (highest priority)
    if (initialSession) {
      console.log('[TabManager] Creating tab for initial session:', initialSession.id);
      createNewTab(initialSession);
      return;
    }

    // Priority 2: Initial project path provided
    if (initialProjectPath) {
      console.log('[TabManager] Creating tab for initial project:', initialProjectPath);
      createNewTab(undefined, initialProjectPath);
      return;
    }

    // Priority 3: Tabs restored from localStorage (only if no new operation)
    if (tabs.length > 0 && !isNewOperation) {
      console.log('[TabManager] Tabs restored from localStorage');
      return;
    }

    // Priority 4: No initial data – show empty state
    console.log('[TabManager] No initial data, showing empty state');
  }, []); // Empty deps – only run once on mount

  return (
    <TooltipProvider>
      <div className={cn("h-full flex flex-col bg-background", className)}>
        {/* 🎨 Minimal tab bar */}
        <div className="flex-shrink-0 border-b border-border bg-background">
          <div className="flex items-center h-12 px-4 gap-2">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="px-3"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span>Back</span>
            </Button>

            {/* Separator */}
            <div className="h-4 w-px bg-border" />

            {/* Tab container */}
            <div
              ref={tabsContainerRef}
              className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-thin"
            >
              <AnimatePresence mode="popLayout">
                {tabs.map((tab, index) => (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                          "group relative flex items-center gap-2 px-3 py-1.5 rounded-lg min-w-0 max-w-[200px] cursor-pointer",
                          "transition-colors",
                          tab.isActive
                            ? "bg-muted border border-border text-foreground"
                            : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
                          draggedTab === tab.id && "ring-2 ring-primary",
                          dragOverIndex === index && draggedTab !== tab.id && "border-primary"
                        )}
                        onClick={() => switchToTab(tab.id)}
                        draggable
                        onDragStart={() => handleTabDragStart(tab.id)}
                        onDragEnd={handleTabDragEnd}
                        onDragOver={(e) => handleTabDragOver(e, index)}
                        onDrop={(e) => handleTabDrop(e, index)}
                      >
                        {/* Session status indicator – minimal */}
                        <div className="flex-shrink-0">
                          {tab.state === 'streaming' ? (
                            <motion.div
                              animate={{ opacity: [1, 0.4, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                              className="h-1.5 w-1.5 bg-success rounded-full"
                            />
                          ) : tab.hasUnsavedChanges ? (
                            <div className="h-1.5 w-1.5 bg-warning rounded-full" />
                          ) : null}
                        </div>

                        {/* Tab title */}
                        <span className="flex-1 truncate text-sm">
                          {tab.title}
                        </span>

                        {/* Close button – visible on hover */}
                        <button
                          className={cn(
                            "flex-shrink-0 h-5 w-5 rounded flex items-center justify-center",
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                            "hover:bg-muted-foreground/20"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseTab(tab.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-sm">
                      <div className="space-y-1 text-xs">
                        <div className="font-medium">{tab.title}</div>
                        {tab.session && (
                          <>
                            <div className="text-muted-foreground">
                              Session ID: {tab.session.id}
                            </div>
                            <div className="text-muted-foreground">
                              Project: {tab.projectPath || tab.session.project_path}
                            </div>
                            <div className="text-muted-foreground">
                              Created At: {new Date(tab.session.created_at * 1000).toLocaleString('en-US')}
                            </div>
                          </>
                        )}
                        {!tab.session && tab.projectPath && (
                          <div className="text-muted-foreground">
                            Project: {tab.projectPath}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </AnimatePresence>

              {/* New tab button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex-shrink-0 h-7 w-7 rounded flex items-center justify-center hover:bg-muted transition-colors"
                    onClick={() => createNewTab()}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>New Session</TooltipContent>
              </Tooltip>
            </div>

            {/* Separator */}
            <div className="h-4 w-px bg-border" />

            {/* Tab menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-7 w-7 rounded flex items-center justify-center hover:bg-muted transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => createNewTab()}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Session
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => tabs.forEach(tab => closeTab(tab.id, true))}
                  disabled={tabs.length === 0}
                >
                  Close All Tabs
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => tabs.filter(tab => !tab.isActive).forEach(tab => closeTab(tab.id, true))}
                  disabled={tabs.length <= 1}
                >
                  Close Other Tabs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tab content area */}
        <div className="flex-1 relative overflow-hidden">
          {/* 🔧 STATE PRESERVATION: render all tabs but hide inactive ones */}
          {/* This keeps component state (including input values) when switching tabs */}
          {tabs.map((tab) => {
            return (
              <div
                key={tab.id}
                className={cn(
                  "absolute inset-0",
                  !tab.isActive && "hidden"
                )}
              >
                <TabSessionWrapper
                  tabId={tab.id}
                  session={tab.session}
                  initialProjectPath={tab.projectPath}
                  isActive={tab.isActive}
                  onStreamingChange={(isStreaming, sessionId) =>
                    updateTabStreamingStatus(tab.id, isStreaming, sessionId)
                  }
                />
              </div>
            );
          })}

          {/* 🎨 Modern empty state design */}
          {tabs.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center h-full"
            >
              <div className="text-center max-w-md px-8">
                {/* Icon */}
                <motion.div
                  initial={{ y: -20 }}
                  animate={{ y: 0 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                    delay: 0.1
                  }}
                  className="mb-6"
                >
                  <div className="inline-flex p-6 rounded-2xl bg-muted/50 border border-border/50">
                    <MessageSquare className="h-16 w-16 text-muted-foreground/70" strokeWidth={1.5} />
                  </div>
                </motion.div>

                {/* Title and description */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  <h3 className="text-2xl font-bold mb-3 text-foreground">
                    No Active Sessions
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    All tabs are closed. Create a new session to start working, or return to the main interface to view projects.
                  </p>
                </motion.div>

                {/* Action buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col gap-3"
                >
                  <Button
                    size="lg"
                    onClick={() => createNewTab()}
                    className="w-full shadow-md hover:shadow-lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Create New Session
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={onBack}
                    className="w-full"
                  >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Return to Main Interface
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>

        {/* 🔧 NEW: custom close‑confirmation dialog */}
        <Dialog open={tabToClose !== null} onOpenChange={(open) => !open && setTabToClose(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Close Tab</DialogTitle>
              <DialogDescription>
                This session has unsaved changes. Are you sure you want to close? Changes will be lost after closing.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTabToClose(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmCloseTab}>
                Confirm Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};