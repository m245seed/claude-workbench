import { useState, useEffect } from "react";
import { Download, X, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { useUpdate } from "../contexts/UpdateContext";
import { relaunchApp } from "../lib/updater";
import { open as openUrl } from "@tauri-apps/plugin-shell";

interface UpdateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UpdateDialog({ open, onClose }: UpdateDialogProps) {
  const { updateInfo, updateHandle, dismissUpdate } = useUpdate();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isPortable, setIsPortable] = useState(false);

  // Detect if portable version (no auto update)
  useEffect(() => {
    const checkPortable = async () => {
      try {
        // Try to download update, if fails, likely portable version
        // Portable version usually cannot use auto update
        const portable = !updateHandle;
        setIsPortable(portable);
      } catch {
        setIsPortable(true);
      }
    };

    if (open) {
      checkPortable();
    }
  }, [open, updateHandle]);

  if (!open || !updateInfo) {
    return null;
  }

  const handleOpenDownloadPage = async () => {
    try {
      const releaseUrl = `https://github.com/anyme123/claude-workbench/releases/tag/v${updateInfo.availableVersion}`;
      await openUrl(releaseUrl);
      handleDismissAndClose();
    } catch (err) {
      console.error("Failed to open download page:", err);
      setError("Unable to open download page, please visit GitHub Releases manually");
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!updateHandle) {
      setError("Auto update is not available, please use manual download");
      return;
    }

    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      let totalBytes = 0;
      let downloadedBytes = 0;

      await updateHandle.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalBytes = event.total || 0;
          downloadedBytes = 0;
        } else if (event.event === "Progress") {
          downloadedBytes += event.downloaded || 0;
          if (totalBytes > 0) {
            setDownloadProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        } else if (event.event === "Finished") {
          setDownloadProgress(100);
          setIsInstalled(true);
        }
      });
    } catch (err) {
      console.error("Download and install failed:", err);
      setError(err instanceof Error ? err.message : "Download and install failed, please try manual download");
      setIsPortable(true); // If auto update fails, may be portable version
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRestart = async () => {
    try {
      await relaunchApp();
    } catch (err) {
      console.error("Restart failed:", err);
      setError("Restart failed, please restart the app manually");
    }
  };

  const handleDismissAndClose = () => {
    dismissUpdate();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              New version found
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-4">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm text-muted-foreground">
                Current version:
              </span>
              <span className="text-sm font-mono text-foreground">
                v{updateInfo.currentVersion}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">
                Latest version:
              </span>
              <span className="text-base font-mono font-semibold text-primary">
                v{updateInfo.availableVersion}
              </span>
            </div>
          </div>

          {/* Portable Version Notice */}
          {isPortable && (
            <div className="mb-4 p-3 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                ℹ️ Detected portable version, auto update is not supported. Please click the button below to go to the download page and download the latest version manually.
              </p>
            </div>
          )}

          {/* Release Notes */}
          {updateInfo.notes && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-foreground mb-2">
                Release notes:
              </h3>
              <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">
                  {updateInfo.notes}
                </pre>
              </div>
            </div>
          )}

          {/* Progress */}
          {isDownloading && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Downloading...
                </span>
                <span className="text-sm font-medium text-primary">
                  {downloadProgress}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Success */}
          {isInstalled && (
            <div className="mb-4 p-3 bg-green-500/10 dark:bg-green-500/20 border border-green-500/20 dark:border-green-500/30 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400">
                ✓ Update installed, please restart the app to use the new version
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 bg-muted/50 border-t border-border">
          <button
            onClick={handleDismissAndClose}
            className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
            disabled={isDownloading}
          >
            Remind me later
          </button>
          {isPortable ? (
            <button
              onClick={handleOpenDownloadPage}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Go to Download
            </button>
          ) : isInstalled ? (
            <button
              onClick={handleRestart}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Restart Now
            </button>
          ) : (
            <button
              onClick={handleDownloadAndInstall}
              disabled={isDownloading}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Update Now
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}



