import * as React from "react";
import { lazy, Suspense, useState } from "react";
import { Separator } from "@radix-ui/react-separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"; // Import resizable panels
import { ChatHeader } from "./components/chat-header";
// Remove React Router imports
// import { Link, Outlet, UIMatch, useMatches } from "react-router-dom";
// Import TanStack Router components and hooks
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { RouteMatch } from "@tanstack/react-router";
// Import ChatSection, ChatMessages, ChatInput and Message types
import {
  ChatInput,
  ChatMessages,
  ChatSection,
  Message,
  // Assuming these types exist or adapting based on actual API
  // If not, define simple types like { role: string, content: string }
} from "@llamaindex/chat-ui";
// Remove FileExplorer and related imports (useState, Button, icons)

// Use React.lazy for client-side only import
const TerminalView = lazy(() => import("./components/terminal-view")); // Import CodePanel

// --- Updated Types/Context Interfaces for TanStack Router ---
// Define the expected shape of the route context (as defined in our routes)
interface RouteContext {
  breadcrumb?: string;
  isAgentRoute?: boolean;
}

// Type guard to check if a match has breadcrumb context
function hasBreadcrumb(match: RouteMatch): match is RouteMatch & { context: RouteContext } {
  // Check if context exists and breadcrumb is a string
  return typeof match.context?.breadcrumb === "string";
}

// Type guard to check if a match represents an agent route via context
function isAgentRouteMatch(match: RouteMatch): match is RouteMatch & { context: RouteContext } {
  return match.context?.isAgentRoute === true;
}
// --- End Updated Types/Context Interfaces ---


// Component to render the main App content
function AppContent() {
  // Use TanStack Router hook to get router state
  const routerState = useRouterState();
  const matches = routerState.matches;
  // Remove file explorer state
  // const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);

  // --- Real Chat State (unchanged) ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Function to handle sending message and receiving response (unchanged)
  const append = async (message: Message | null) => {
    if (!message || message.role !== "user") return null; // Only handle user messages

    const userInput = message.content;
    if (!userInput) return null;

    console.log("[App] Sending user message:", userInput);
    setMessages((prevMessages) => [...prevMessages, message]);
    setIsLoading(true);

    try {
      // Call the main process agent via the exposed IPC method
      console.log(`[App] Requesting agent execution via IPC: ${userInput}`);
      const agentResponseContent: string = await window.electron.ipcInvoke(
        "run-agent", // Use the IPC channel name again
        userInput
      );
      console.log("[App] Received agent response via IPC:", agentResponseContent);

      // agentResponseContent is expected to be a string here

      const agentMessage: Message = {
        role: "assistant",
        content: agentResponseContent,
        // Add id or other fields if required by ChatMessages
      };

      setMessages((prevMessages) => [...prevMessages, agentMessage]);
    } catch (error) {
      console.error("[App] Error invoking agent:", error);
      // Add an error message to the chat
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${(error as Error).message || "Unknown error"}`,\
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
    return null; // append function in chat-ui might expect null
  };

  // Real chat handler conforming to chat-ui expectations (unchanged)
  const chatHandler = {
    messages,
    input,
    setInput, // Pass the state setter
    append,
    isLoading,
    // Add other methods/props if the handler interface requires them
  };
  // --- End Real Chat State ---

  // Updated breadcrumb logic using TanStack Router matches and context
  const crumbs = matches
    .filter(hasBreadcrumb) // Use updated type guard
    .map((match, index, arr) => {
      // Access breadcrumb from context
      const breadcrumbText = match.context?.breadcrumb;
      const isLast = index === arr.length - 1;
      // Get path from the match object (TanStack Router provides this)
      const path = match.pathname;

      // Check if breadcrumbText exists before rendering
      if (!breadcrumbText) return null;

      return (
        <React.Fragment key={match.id}>
          <BreadcrumbItem className="hidden md:block">
            {isLast
              ? (
                <BreadcrumbPage className="font-medium">
                  {breadcrumbText}
                </BreadcrumbPage>
              )
              : (
                // Use TanStack Router's Link component
                <BreadcrumbLink asChild>
                  <Link
                    to={path}
                    params={match.params} // Pass params if needed by the link
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {breadcrumbText}
                  </Link>
                </BreadcrumbLink>
              )}
          </BreadcrumbItem>
          {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
        </React.Fragment>
      );
    })
    .filter(Boolean); // Filter out any null entries if breadcrumbText was missing

  // Determine if the current route is an agent route using updated guard
  const isAgentSelected = matches.some(isAgentRouteMatch);

  // --- DEBUGGING START ---
  /* React.useEffect(() => {
    console.log("Current Route Matches:", matches);
    console.log("Route Contexts:", matches.map(m => m.context)); // Log context instead of handle
    console.log("Is Agent Selected:", isAgentSelected);
  }, [matches, isAgentSelected]); */
  // --- DEBUGGING END ---

  return (
    // Removed outer layout div
    <>
      {/* Make header sticky, add background */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background sticky top-0 z-10">
        {/* Removed File Explorer Toggle Button */}
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs}
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      {/* Adjust main section: Render Outlet or Chat UI based on agent selection */}
      <main className="flex flex-col h-[calc(100vh-4rem)]">
        {isAgentSelected
          ? (
            // Render Resizable Chat UI when an agent is selected
            <div className="flex flex-col flex-grow overflow-hidden">
              {/* Main container for chat */}
              <ChatHeader /> {/* Add the Chat Header */}
              <ChatSection
                handler={chatHandler}
                className="flex flex-col flex-grow overflow-hidden"
              >
                {/* ChatSection manages context, ensure it allows flex styling */}
                <PanelGroup direction="vertical">
                  {/* Messages Panel */}
                  <Panel
                    defaultSize={60}
                    minSize={20}
                    className="flex flex-col overflow-hidden"
                  >
                    {/* Make panel flex column */}
                    <div className="flex-grow overflow-y-auto p-4">
                      {/* Scrollable content */}
                      <ChatMessages />
                    </div>
                  </Panel>
                  <PanelResizeHandle className="h-2 bg-border hover:bg-muted-foreground/20 transition-colors" />
                  {/* Input Panel */}
                  <Panel
                    defaultSize={15}
                    minSize={10}
                    maxSize={25}
                    className="flex items-center p-4"
                  >
                    {/* Keep input vertically centered if needed */}
                    <ChatSection
                      handler={chatHandler}
                      className="max-h-[72vh] w-full"
                    >
                      <ChatInput className="rounded-xl w-full">
                        <ChatInput.Form>
                          <ChatInput.Field />
                          <ChatInput.Upload
                            onUpload={() => Promise.resolve()}
                          />
                          <ChatInput.Submit />
                        </ChatInput.Form>
                      </ChatInput>
                    </ChatSection>
                  </Panel>
                </PanelGroup>
              </ChatSection>
            </div>
          )
          : (
            // Render Outlet and TerminalView in a resizable panel otherwise
            <PanelGroup direction="horizontal" className="flex-grow">
              {/* Main Content Panel (Outlet) */}
              <Panel defaultSize={75} minSize={30}>
                <div className="h-full overflow-auto p-4">
                  <Outlet /> {/* Use TanStack Router Outlet */}
                </div>
              </Panel>
              <PanelResizeHandle className="w-2 bg-border hover:bg-muted-foreground/20 transition-colors" />
              {/* Terminal Panel */}
              <Panel defaultSize={25} minSize={20}>
                <Suspense fallback={<div>Loading Terminal...</div>}>
                  <TerminalView />
                </Suspense>
              </Panel>
            </PanelGroup>
          )}
      </main>
    </>
  );
}

// Main App component (unchanged structure, renders AppContent)
export default function App() {
  return <AppContent />;
}

// Remember to also import CodePanel component itself somewhere, 
// perhaps alongside AppContent or inside it if it makes sense.
// For now, assuming CodePanel is rendered elsewhere or will be added.
