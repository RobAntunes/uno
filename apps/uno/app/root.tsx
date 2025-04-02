import { AuthProvider } from "react-oidc-context";
import * as React from "react";
import { useState, useRef, useEffect } from "react";
import {
  Links,
  type LinksFunction,
  Meta,
  type MetaFunction,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router-dom";

import "../styles.css";
import { Toaster } from "sonner";
import { SidebarProvider } from "./components/ui/sidebar";
import AppSidebar from "./components/ui/app-sidebar";
import FileExplorer from "./components/file-explorer/FileExplorer";
import { Button } from "./components/ui/Button";
import { PanelLeftClose, PanelLeftOpen, Files, Lock, Unlock, PanelRightOpen } from "lucide-react";
import { AgentProvider } from "./context/agent-context";
import { CodePanelProvider, useCodePanel } from "./context/code-panel-context";
import { CodePanel } from "./components/code-panel/CodePanel";
import { WorkspaceProvider } from "./context/workspace-context";

export const meta: MetaFunction = () => [
  {
    title: "Uno",
  },
];

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href:
      "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

const cognitoAuthConfig = {
  authority: "https://cognito-idp.eu-west-3.amazonaws.com/eu-west-3_s4bfK6epz",
  client_id: "qb0migspdlsa87cqar363sbdb",
  redirect_uri: "https://d84l1y8p4kdic.cloudfront.net",
  response_type: "code",
  scope: "email openid phone",
};

const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MIN_WIDTH = 50;

function MainContentLayout({ 
  children, 
  isFileExplorerOpen, 
  setIsFileExplorerOpen 
}: {
  children: React.ReactNode;
  isFileExplorerOpen: boolean;
  setIsFileExplorerOpen: (open: boolean) => void;
}) {
  const { isSyncMode, setIsSyncMode, setIsOpen, setMainContentWidth } = useCodePanel();
  const mainContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mainContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
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
      <div ref={mainContainerRef} className="relative flex-1 h-full overflow-y-auto">
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
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
            {isSyncMode ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
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
        {children}
      </div>
    </AgentProvider>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [isAppSidebarCollapsed, setIsAppSidebarCollapsed] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);

  return (
    <AuthProvider {...cognitoAuthConfig}>
      <html lang="en" className="h-screen overflow-hidden">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta />
          <Links />
        </head>
        <body className="h-full bg-background text-foreground flex">
          <CodePanelProvider>
            <WorkspaceProvider>
              <SidebarProvider>
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
                  {children}
                </MainContentLayout>

                <CodePanel />
              </SidebarProvider>
            </WorkspaceProvider>
          </CodePanelProvider>
          <Toaster />
          <ScrollRestoration />
          <Scripts />
        </body>
      </html>
    </AuthProvider>
  );
}

export default function App() {
  return <Outlet />;
}
