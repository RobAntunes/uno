import { AuthProvider } from "react-oidc-context";
import * as React from "react";
import { useState } from "react";
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
import { AppNav } from "./app-nav";
import { Toaster } from "sonner";
import { SidebarProvider } from "./components/ui/sidebar";
import AppSidebar from "./components/ui/app-sidebar";
import FileExplorer from "./components/file-explorer/FileExplorer";
import { Button } from "./components/ui/Button";
import { PanelLeftClose, PanelLeftOpen, Files } from "lucide-react";
import { AgentProvider } from "./context/agent-context";

export const meta: MetaFunction = () => [
  {
    title: "New Nx React Router App",
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

            <AgentProvider>
              <div className="flex-1 h-full overflow-y-auto">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
                  className="absolute top-2 right-2 z-20 h-8 w-8"
                  title={isFileExplorerOpen ? "Hide Files" : "Show Files"}
                >
                  <Files className="h-4 w-4" />
                </Button>

                {children}
              </div>
            </AgentProvider>

          </SidebarProvider>
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
