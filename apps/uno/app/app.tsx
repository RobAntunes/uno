import * as React from "react";
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

  const crumbs = matches
    .filter(hasBreadcrumb)
    .map((match, index, arr) => {
      const breadcrumbText = match.handle!.breadcrumb;
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

      {/* Removed flex-1, parent div handles sizing */}
      <main className="overflow-auto p-4">
        <Outlet />
      </main>
    </>
  );
}
