import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./assets/shimmer.css";
import "./styles.css";
import "./i18n"; // ✅ i18n must be loaded synchronously (App needs it immediately)
import { getCurrentWindow } from '@tauri-apps/api/window';

// ⚡ Optimization: load toolRegistry asynchronously (can be delayed)
// import { initializeToolRegistry } from "./lib/toolRegistryInit"; // ❌ Changed to async

// React wrapper component to prevent window flicker
const AppWrapper: React.FC = () => {
  React.useEffect(() => {
    // ⚡ Performance optimization: asynchronously load toolRegistry (can be delayed, non‑blocking UI)
    const initializeToolRegistry = async () => {
      try {
        const { initializeToolRegistry: init } = await import('./lib/toolRegistryInit');
        init();
        console.log('[AppWrapper] ✅ ToolRegistry initialized asynchronously');
      } catch (error) {
        console.error('[AppWrapper] ToolRegistry initialization failed:', error);
      }
    };
    
    // Show the window after the React app is fully mounted
    const showWindow = async () => {
      try {
        const window = getCurrentWindow();
        await window.show();
        await window.setFocus();
      } catch (error) {
        console.error('Failed to show window:', error);
      }
    };
    
    // Background async initialization of toolRegistry (non‑blocking)
    initializeToolRegistry();
    
    // Immediately show the window (production mode already optimized, no long delay needed)
    const timer = setTimeout(showWindow, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
);
