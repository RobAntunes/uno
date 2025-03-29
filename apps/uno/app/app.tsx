import * as React from "react";
import { lazy, Suspense } from "react";
import { Separator } from "@radix-ui/react-separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb";
// Remove SidebarInset import
import { Outlet, useMatches, Link, UIMatch } from "react-router-dom";
// Import ChatSection, ChatMessages, ChatInput
import { ChatSection, ChatMessages, ChatInput } from "@llamaindex/chat-ui";
// Use React.lazy for client-side only import
const TerminalView = lazy(() => import("./components/terminal-view"));
// Remove FileExplorer and related imports (useState, Button, icons)

// Define the expected shape of the route handle
interface RouteHandle {
  breadcrumb?: string;
}

// Type guard to check if a match has a breadcrumb handle
function hasBreadcrumb(match: UIMatch): match is UIMatch<unknown, RouteHandle> {
  return typeof (match.handle as RouteHandle)?.breadcrumb === 'string';
}

// Removed findAgentData function

export default function App() {
  const matches = useMatches();
  // Remove file explorer state
  // const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);

  // Placeholder chat handler to satisfy ChatSection prop types
  const mockChatHandler = {
    input: "",
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setInput: () => {},
    isLoading: false,
    messages: [],
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    append: async () => null, // Return null to match type
  };

  const crumbs = matches
    .filter(hasBreadcrumb)
    .map((match, index, arr) => {
      const breadcrumbText = match.handle?.breadcrumb;
      const isLast = index === arr.length - 1;
      const path = match.pathname;
      return (
        <React.Fragment key={match.id}>
          <BreadcrumbItem className="hidden md:block">
            {isLast ? (
              <BreadcrumbPage className="font-medium">
                {breadcrumbText}
              </BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link to={path} className="text-muted-foreground hover:text-foreground">
                  {breadcrumbText}
                </Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
        </React.Fragment>
      );
    });

  return (
    // Removed outer layout div
    <>
      {/* Make header sticky, add background */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background sticky top-0 z-10">
        {/* Removed File Explorer Toggle Button */}
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.length > 0 && crumbs[0].key !== 'root' && <BreadcrumbSeparator className="hidden md:block" />}
            {crumbs}
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      {/* Adjust main section for chat UI */}
      <main className="flex flex-col h-[calc(100vh-4rem)]"> {/* Use flex column and calculate height */}
        <div className="flex-grow overflow-y-auto p-4"> {/* Container for scrollable route content */}
          <Outlet />
        </div>

        {/* Chat UI Area - Wrapped with ChatSection */} 
        <div className="flex flex-col border-t flex-grow"> {/* Make chat area grow */} 
          <ChatSection handler={mockChatHandler}> {/* ChatSection manages context */} 
            {/* Messages Area (Growable) */}
            <div className="flex-grow overflow-y-auto p-4"> 
              <ChatMessages />
            </div>
            {/* Terminal Area (Fixed Height) - Load lazily */} 
            <div className="h-40 flex-shrink-0 border-t border-b"> {/* Fixed height, shrink-0 prevents shrinking */}
              <Suspense fallback={<div className="w-full h-full bg-muted animate-pulse" />}> {/* Show placeholder during load */} 
                <TerminalView />
              </Suspense>
            </div>
            {/* Input Area (Fixed Height) */}
            <div className="p-4 flex-shrink-0"> {/* Keep input at bottom */}
              <ChatInput />
            </div>
          </ChatSection>
        </div>
      </main>
    </>
  );
}
