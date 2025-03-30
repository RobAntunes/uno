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
// Remove SidebarInset import
import { Link, Outlet, UIMatch, useMatches } from "react-router-dom";
// Import ChatSection, ChatMessages, ChatInput and Message types
import {
  ChatInput,
  ChatMessages,
  ChatSection,
  Message,
  // Assuming these types exist or adapting based on actual API
  // If not, define simple types like { role: string, content: string }
} from "@llamaindex/chat-ui";
// Use React.lazy for client-side only import
const TerminalView = lazy(() => import("./components/terminal-view"));
// Remove FileExplorer and related imports (useState, Button, icons)

// Define the expected shape of the route handle
interface RouteHandle {
  breadcrumb?: string;
  isAgentRoute?: boolean;
}

// Type guard to check if a match has a breadcrumb handle
function hasBreadcrumb(match: UIMatch): match is UIMatch<unknown, RouteHandle> {
  return typeof (match.handle as RouteHandle)?.breadcrumb === "string";
}

// Type guard to check if a match represents an agent route
function isAgentRouteMatch(
  match: UIMatch,
): match is UIMatch<unknown, RouteHandle> {
  return (match.handle as RouteHandle)?.isAgentRoute === true;
}

// Removed findAgentData function

export default function App() {
  const matches = useMatches();
  // Remove file explorer state
  // const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);

  // --- Real Chat State ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Function to handle sending message and receiving response
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
        content: `Error: ${(error as Error).message || "Unknown error"}`,
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
    return null; // append function in chat-ui might expect null
  };

  // Real chat handler conforming to chat-ui expectations
  const chatHandler = {
    messages,
    input,
    setInput, // Pass the state setter
    append,
    isLoading,
    // Add other methods/props if the handler interface requires them
  };
  // --- End Real Chat State ---

  const crumbs = matches
    .filter(hasBreadcrumb)
    .map((match, index, arr) => {
      const breadcrumbText = match.handle?.breadcrumb;
      const isLast = index === arr.length - 1;
      const path = match.pathname;
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
                <BreadcrumbLink asChild>
                  <Link
                    to={path}
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
    });

  // Determine if the current route is an agent route
  const isAgentSelected = matches.some(isAgentRouteMatch);

  // --- DEBUGGING START ---
  /* React.useEffect(() => {
    console.log("Current Route Matches:", matches);
    console.log("Route Handles:", matches.map(m => m.handle));
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
            {crumbs.length > 0 && crumbs[0].key !== "root" && (
              <BreadcrumbSeparator className="hidden md:block" />
            )}
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
                  {/* Terminal Panel */}
                  <Panel
                    defaultSize={25}
                    minSize={10}
                    maxSize={50}
                    className="flex flex-col overflow-hidden"
                  >
                    {/* Make panel flex column */}
                    {/* Fixed height, shrink-0 prevents shrinking - remove fixed height */}
                    <Suspense
                      fallback={
                        <div className="w-full h-full bg-muted animate-pulse" />
                      }
                    >
                      {/* Show placeholder during load */}
                      <TerminalView /> {/* Let TerminalView fill the panel */}
                    </Suspense>
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
            // Render the route's Outlet content when no agent is selected
            <div className="flex-grow overflow-y-auto p-4">
              {/* Container for scrollable route content */}
              <Outlet />
            </div>
          )}
      </main>
    </>
  );
}
