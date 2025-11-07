import { useState, useEffect, useRef } from "react";
import { Plus, Loader2 } from "lucide-react";
import { api, type Project, type Session, type ClaudeMdFile } from "@/lib/api";
import { OutputCacheProvider } from "@/lib/outputCache";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/ProjectList";
import { SessionList } from "@/components/SessionList";
import { RunningClaudeSessions } from "@/components/RunningClaudeSessions";
import { Topbar } from "@/components/Topbar";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { ClaudeFileEditor } from "@/components/ClaudeFileEditor";
import { Settings } from "@/components/Settings";
import { ClaudeCodeSession } from "@/components/ClaudeCodeSession";
import { TabManager } from "@/components/TabManager";
import { TabProvider, useTabs } from "@/hooks/useTabs";
import { UsageDashboard } from "@/components/UsageDashboard";
import { MCPManager } from "@/components/MCPManager";
import { ClaudeBinaryDialog } from "@/components/ClaudeBinaryDialog";
import { Toast, ToastContainer } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectSettings } from '@/components/ProjectSettings';
import { EnhancedHooksManager } from '@/components/EnhancedHooksManager';
import { ClaudeExtensionsManager } from '@/components/ClaudeExtensionsManager';
import { useTranslation } from '@/hooks/useTranslation';
import { UpdateProvider } from '@/contexts/UpdateContext';
import { UpdateDialog } from '@/components/UpdateDialog';

type View =
  | "projects"
  | "editor"
  | "claude-file-editor"
  | "claude-code-session"
  | "claude-tab-manager"
  | "settings"
  | "mcp"
  | "usage-dashboard"
  | "project-settings"
  | "enhanced-hooks-manager"
  | "claude-extensions";

/**
 * Main App component - Manages the Claude directory browser UI
 */
function App() {
  return (
    <UpdateProvider>
      <TabProvider>
        <AppContent />
      </TabProvider>
    </UpdateProvider>
  );
}

/**
 * Application content component - Accesses tab state within TabProvider
 */
function AppContent() {
  const { t } = useTranslation();
  const { openSessionInBackground, switchToTab, getTabStats } = useTabs();
  const [view, setView] = useState<View>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editingClaudeFile, setEditingClaudeFile] = useState<ClaudeMdFile | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClaudeBinaryDialog, setShowClaudeBinaryDialog] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [activeClaudeSessionId, setActiveClaudeSessionId] = useState<string | null>(null);
  const [isClaudeStreaming, setIsClaudeStreaming] = useState(false);
  const [projectForSettings, setProjectForSettings] = useState<Project | null>(null);
  const [previousView, setPreviousView] = useState<View>("projects");
  const [showNavigationConfirm, setShowNavigationConfirm] = useState(false);
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [newSessionProjectPath, setNewSessionProjectPath] = useState<string>("");
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  // 🔧 NEW: Navigation history stack for smart back functionality
  const [navigationHistory, setNavigationHistory] = useState<View[]>(["projects"]);

  // Load projects when mounting in the projects view (only on first entry)
  const hasLoadedProjectsRef = useRef(false);

  // ⚡ Listen for open-prompt-api-settings event and switch to settings page
  useEffect(() => {
    const handleOpenPromptAPISettings = () => {
      // ⚡ Fix: only switch when not already on settings page to avoid infinite loop
      if (view !== "settings") {
        console.log('[App] Switching to settings view for prompt API settings');
        handleViewChange("settings");
        // Delay triggering internal event to let Settings component switch tabs
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('switch-to-prompt-api-tab'));
        }, 100);
      }
    };

    window.addEventListener('open-prompt-api-settings', handleOpenPromptAPISettings as EventListener);
    return () => window.removeEventListener('open-prompt-api-settings', handleOpenPromptAPISettings as EventListener);
  }, [view]);  // ⚡ Add view dependency

  useEffect(() => {
    console.log('[App] useEffect triggered, view:', view, 'hasLoaded:', hasLoadedProjectsRef.current);
    if (view === "projects" && !hasLoadedProjectsRef.current) {
      console.log('[App] Loading projects...');
      loadProjects();
      hasLoadedProjectsRef.current = true;
    }
  }, [view]);

  // Listen for Claude session selection events
  useEffect(() => {
    const handleSessionSelected = (event: CustomEvent) => {
      const { session } = event.detail;
      // Open session in background and automatically switch to its tab
      const result = openSessionInBackground(session);
      switchToTab(result.tabId);
      // Switch to tab manager view
      handleViewChange("claude-tab-manager");
      // Show different notifications depending on whether a new tab was created
      if (result.isNew) {
        setToast({
          message: `Session ${session.id.slice(-8)} opened`,
          type: "success"
        });
      } else {
        setToast({
          message: `Switched to session ${session.id.slice(-8)}`,
          type: "info"
        });
      }
    };

    const handleClaudeNotFound = () => {
      setShowClaudeBinaryDialog(true);
    };

    window.addEventListener('claude-session-selected', handleSessionSelected as EventListener);
    window.addEventListener('claude-not-found', handleClaudeNotFound as EventListener);
    return () => {
      window.removeEventListener('claude-session-selected', handleSessionSelected as EventListener);
      window.removeEventListener('claude-not-found', handleClaudeNotFound as EventListener);
    };
  }, []);

  /**
   * Loads all projects from the ~/.claude/projects directory
   */
  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await api.listProjects();
      setProjects(projectList);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError(t('common.loadingProjects'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles project selection and loads its sessions
   */
  const handleProjectClick = async (project: Project) => {
    try {
      setLoading(true);
      setError(null);
      const sessionList = await api.getProjectSessions(project.id);
      setSessions(sessionList);
      setSelectedProject(project);
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError(t('common.loadingSessions'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Opens a new project session from home page (requires project path selection)
   */
  const handleNewProject = async () => {
    setSelectedSession(null);
    setNewSessionProjectPath("__NEW_PROJECT__"); // Use special marker to indicate "new project"
    handleViewChange("claude-tab-manager");
  };

  /**
   * Returns to project list view
   */
  const handleBack = () => {
    setSelectedProject(null);
    setSessions([]);
  };

  /**
   * Handles editing a CLAUDE.md file from a project
   */
  const handleEditClaudeFile = (file: ClaudeMdFile) => {
    setEditingClaudeFile(file);
    handleViewChange("claude-file-editor");
  };

  /**
   * Returns from CLAUDE.md file editor to projects view
   */
  const handleBackFromClaudeFileEditor = () => {
    setEditingClaudeFile(null);
    handleViewChange("projects");
  };

  /**
   * 🔧 IMPROVED: Smart navigation with history tracking
   * Handles view changes with navigation protection and history management
   */
  const handleViewChange = (newView: View) => {
    console.log('[App] handleViewChange called:', { from: view, to: newView });

    // Check if we're navigating away from an active Claude session
    if (view === "claude-code-session" && isClaudeStreaming && activeClaudeSessionId) {
      // Show in-app confirmation dialog instead of system confirm
      setPendingView(newView);
      setShowNavigationConfirm(true);
      return;
    }

    // 🔧 NEW: Add current view to history before navigating
    setNavigationHistory(prev => {
      // Avoid duplicate consecutive entries
      if (prev[prev.length - 1] !== view) {
        return [...prev, view];
      }
      return prev;
    });

    setPreviousView(view);
    setView(newView);
  };

  /**
   * 🔧 NEW: Smart back function that uses navigation history
   */
  const handleSmartBack = () => {
    if (navigationHistory.length > 1) {
      // Remove current view and get previous one
      const newHistory = [...navigationHistory];
      newHistory.pop(); // Remove current
      const previousView = newHistory[newHistory.length - 1];

      setNavigationHistory(newHistory);
      setView(previousView);
      return previousView;
    }
    // Fallback to projects if no history
    setView("projects");
    return "projects";
  };

  /**
   * Handles navigation confirmation
   */
  const handleNavigationConfirm = () => {
    if (pendingView) {
      setView(pendingView);
      setPendingView(null);
    }
    setShowNavigationConfirm(false);
  };

  /**
   * Handles navigation cancellation
   */
  const handleNavigationCancel = () => {
    setPendingView(null);
    setShowNavigationConfirm(false);
  };

  /**
   * Handles navigating to hooks configuration
   */
  const handleProjectSettings = (project: Project) => {
    setProjectForSettings(project);
    handleViewChange("project-settings");
  };

  /**
   * Handles project deletion
   */
  const handleProjectDelete = async (project: Project) => {
    try {
      setLoading(true);
      await api.deleteProject(project.id);
      setToast({
        message: `Project "${project.path.split('/').pop()}" deleted successfully`,
        type: "success"
      });
      // Reload project list
      await loadProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
      setToast({
        message: `Failed to delete project: ${err}`,
        type: "error"
      });
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (view) {
      case "enhanced-hooks-manager":
        return (
          <EnhancedHooksManager
            onBack={handleSmartBack}
            projectPath={projectForSettings?.path}
          />
        );

      case "claude-extensions":
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">
              <ClaudeExtensionsManager
                projectPath={projectForSettings?.path}
                onBack={handleSmartBack}
              />
            </div>
          </div>
        );

      case "editor":
        return (
          <div className="flex-1 overflow-hidden">
            <MarkdownEditor onBack={handleSmartBack} />
          </div>
        );

      case "settings":
        return (
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            <Settings onBack={handleSmartBack} />
          </div>
        );

      case "projects":
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-6">
              {/* Header - remove animation to avoid duplicate triggers */}
              <div className="mb-6">
                <div className="mb-4">
                  <h1 className="text-3xl font-bold tracking-tight">{t('common.ccProjectsTitle')}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('common.browseClaudeSessions')}
                  </p>
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive max-w-2xl">
                  {error}
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Content - remove animation to avoid duplicate triggers */}
              {!loading && (
                <>
                  {selectedProject ? (
                    <div>
                      <SessionList
                        sessions={sessions}
                        projectPath={selectedProject.path}
                        onBack={handleBack}
                        onEditClaudeFile={handleEditClaudeFile}
                        onSessionClick={(session) => {
                          const result = openSessionInBackground(session);
                          switchToTab(result.tabId);
                          handleViewChange("claude-tab-manager");
                          if (result.isNew) {
                            setToast({
                              message: `Session ${session.id.slice(-8)} opened`,
                              type: "success"
                            });
                          } else {
                            setToast({
                              message: `Switched to session ${session.id.slice(-8)}`,
                              type: "info"
                            });
                          }
                        }}
                        onNewSession={(projectPath) => {
                          setSelectedSession(null);
                          setNewSessionProjectPath(projectPath);
                          handleViewChange("claude-tab-manager");
                        }}
                      />
                    </div>
                  ) : (
                    <div>
                      {/* New session button at the top */}
                      <div className="mb-4">
                        <Button
                          onClick={handleNewProject}
                          size="default"
                          className="w-full max-w-md"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {t('common.newProject')}
                        </Button>
                      </div>

                      {/* Running Claude Sessions */}
                      <RunningClaudeSessions
                        onSessionClick={(session) => {
                          const result = openSessionInBackground(session);
                          switchToTab(result.tabId);
                          handleViewChange("claude-tab-manager");
                          if (result.isNew) {
                            setToast({
                              message: `Session ${session.id.slice(-8)} opened`,
                              type: "success"
                            });
                          } else {
                            setToast({
                              message: `Switched to session ${session.id.slice(-8)}`,
                              type: "info"
                            });
                          }
                        }}
                      />

                      {/* Project list */}
                      {projects.length > 0 ? (
                        <ProjectList
                          projects={projects}
                          onProjectClick={handleProjectClick}
                          onProjectSettings={handleProjectSettings}
                          onProjectDelete={handleProjectDelete}
                          onProjectsChanged={loadProjects}
                          loading={loading}
                        />
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-sm text-muted-foreground">
                            {t('common.noProjectsFound')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );

      case "claude-file-editor":
        return editingClaudeFile ? (
          <ClaudeFileEditor
            file={editingClaudeFile}
            onBack={handleBackFromClaudeFileEditor}
          />
        ) : null;

      case "claude-code-session":
        return (
          <ClaudeCodeSession
            session={selectedSession || undefined}
            initialProjectPath={newSessionProjectPath}
            onStreamingChange={(isStreaming, sessionId) => {
              setIsClaudeStreaming(isStreaming);
              setActiveClaudeSessionId(sessionId);
            }}
          />
        );

      case "claude-tab-manager":
        return (
          <TabManager
            initialSession={selectedSession || undefined}
            initialProjectPath={newSessionProjectPath}
            onBack={() => {
              setSelectedSession(null);
              setNewSessionProjectPath("");
              handleViewChange("projects");
            }}
          />
        );

      case "usage-dashboard":
        return (
          <UsageDashboard onBack={handleSmartBack} />
        );

      case "mcp":
        return (
          <MCPManager onBack={handleSmartBack} />
        );

      case "project-settings":
        if (projectForSettings) {
          return (
            <ProjectSettings
              project={projectForSettings}
              onBack={() => {
                setProjectForSettings(null);
                handleViewChange(previousView || "projects");
              }}
            />
          );
        }
        break;

      default:
        return null;
    }
  };

  return (
    <OutputCacheProvider>
      <div className="h-screen bg-background flex flex-col">
        {/* Topbar - hide in tab manager for immersive experience */}
        {view !== "claude-tab-manager" && (
          <Topbar
            onClaudeClick={() => handleViewChange("editor")}
            onSettingsClick={() => handleViewChange("settings")}
            onUsageClick={() => handleViewChange("usage-dashboard")}
            onMCPClick={() => handleViewChange("mcp")}
            onExtensionsClick={() => handleViewChange("claude-extensions")}
            onTabsClick={() => handleViewChange("claude-tab-manager")}
            onUpdateClick={() => setShowUpdateDialog(true)}
            tabsCount={getTabStats().total}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>

        {/* Claude Binary Dialog */}
        <ClaudeBinaryDialog
          open={showClaudeBinaryDialog}
          onOpenChange={setShowClaudeBinaryDialog}
          onSuccess={() => {
            setToast({ message: t('messages.saved'), type: "success" });
            // Trigger a refresh of the Claude version check
            window.location.reload();
          }}
          onError={(message) => setToast({ message, type: "error" })}
        />

        {/* Navigation Confirmation Dialog */}
        <Dialog open={showNavigationConfirm} onOpenChange={setShowNavigationConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Navigation</DialogTitle>
              <DialogDescription>
                Claude is processing your request. Are you sure you want to leave the current session? This will interrupt the ongoing conversation.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleNavigationCancel}>
                Cancel
              </Button>
              <Button onClick={handleNavigationConfirm}>
                Confirm Leave
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Toast Container */}
        <ToastContainer>
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(null)}
            />
          )}
        </ToastContainer>

        {/* Update Dialog */}
        <UpdateDialog
          open={showUpdateDialog}
          onClose={() => setShowUpdateDialog(false)}
        />
      </div>
    </OutputCacheProvider>
  );
}
export default App;