import { AuthProvider } from "react-oidc-context";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router"; // Updated import
import { TanStackRouterDevtools } from "@tanstack/router-devtools"; // Added for devtools

import "../../styles.css"; // Adjusted path potentially
import { Toaster } from "sonner";
import { SidebarProvider } from "../components/ui/sidebar"; // Adjusted path
import AppSidebar from "../components/ui/app-sidebar"; // Adjusted path
import FileExplorer from "../components/file-explorer/FileExplorer"; // Adjusted path
import { Button } from "../components/ui/Button"; // Adjusted path
import {
  Files,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Unlock,
} from "lucide-react";
import { AgentProvider } from "../context/agent-context"; // Adjusted path
import { CodePanelProvider, useCodePanel } from "../context/code-panel-context"; // Adjusted path
import { CodePanel } from "../components/code-panel/CodePanel"; // Adjusted path
import { WorkspaceProvider } from "../context/workspace-context"; // Adjusted path

// --- Meta and Links (Consider moving to individual routes or a central config) ---
// export const meta: MetaFunction = () => [ ... ];
// export const links: LinksFunction = () => [ ... ];

const cognitoAuthConfig = {
  authority: "https://cognito-idp.eu-west-3.amazonaws.com/eu-west-3_s4bfK6epz",
  client_id: "qb0migspdlsa87cqar363sbdb",
  redirect_uri: "https://d84l1y8p4kdic.cloudfront.net", // TODO: Update this for local dev/prod?
  response_type: "code",
  scope: "email openid phone",
};

// --- Reusable Main Content Layout (Moved from root.tsx) ---
function MainContentLayout({
  children,
  isFileExplorerOpen,
  setIsFileExplorerOpen,
}: {
  children: React.ReactNode;
  isFileExplorerOpen: boolean;
  setIsFileExplorerOpen: (open: boolean) => void;
}) {
  const { isSyncMode, setIsSyncMode, setIsOpen, setMainContentWidth } =
    useCodePanel();
  const mainContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mainContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect?.width;
        if (width) {
          setMainContentWidth(width);
        }
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [setMainContentWidth]);

  return (
    <AgentProvider>
      <div ref={mainContainerRef} className="relative flex-1">
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2 w-full">
          <div className="flex items-center gap-2 w-full justify-end">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
              className="h-8 w-8 shrink-0"
              title={isFileExplorerOpen ? "Hide Files" : "Show Files"}
            >
              <Files className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setIsSyncMode(!isSyncMode)}
              title={isSyncMode ? "Disable Sync Mode" : "Enable Sync Mode"}
            >
              {isSyncMode
                ? <Lock className="h-4 w-4" />
                : <Unlock className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setIsOpen(true)}
              title="Open Code Panel"
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {children}
      </div>
    </AgentProvider>
  );
}

// --- Root Component for TanStack Router ---
function RootComponent() {
  const [isAppSidebarCollapsed, setIsAppSidebarCollapsed] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);

  // We render providers here, wrapping the Outlet
  return (
    <AuthProvider {...cognitoAuthConfig}>
      {/* Removed <html>, <head>, <body> - TanStack Router expects this at a higher level (index.html or server entry) */}
      {/* We manage head tags via route definitions now */}
      <CodePanelProvider>
        <WorkspaceProvider>
          <SidebarProvider>
            <div className="flex h-full">
              {/* Added flex container */}
              <AppSidebar
                isCollapsed={isAppSidebarCollapsed}
                setIsCollapsed={setIsAppSidebarCollapsed}
              />

              {isFileExplorerOpen && (
                <div className="w-72 border-r bg-muted/40 overflow-y-auto flex-shrink-0">
                  <FileExplorer />
                </div>
              )}

              <MainContentLayout
                isFileExplorerOpen={isFileExplorerOpen}
                setIsFileExplorerOpen={setIsFileExplorerOpen}
              >
                <Outlet /> {/* TanStack Router Outlet */}
              </MainContentLayout>

              <CodePanel />
            </div>
          </SidebarProvider>
        </WorkspaceProvider>
      </CodePanelProvider>
      <Toaster />
      {/* ScrollRestoration might be handled differently or automatically */}
      {/* Scripts are usually handled by the bundler/HTML template */}
      <TanStackRouterDevtools /> {/* Add the dev tools */}
    </AuthProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
