import * as React from "react";
import { Separator } from "@radix-ui/react-separator";
// Remove AppNav import if no longer used
// import { AppNav } from "./app-nav";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./components/ui/breadcrumb";
import { SidebarInset } from "./components/ui/sidebar"; // Assuming SidebarInset handles the main sidebar space
import {
  Outlet,
  useMatches,
  Link,
  UIMatch,
  // useLocation, // Removed
} from "react-router-dom";

// Removed AgentSidebar import
// Removed teamData and TeamStructureItem imports

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
  // Removed location and agent data calculation

  // Generate breadcrumbs (existing logic remains)
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
    // SidebarInset likely manages the space for the main AppSidebar
    <SidebarInset className="flex flex-col h-screen overflow-hidden"> {/* Ensure flex-col and height */}
      {/* Header remains the same */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-white dark:bg-gray-950">
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {/* Add separator logic if needed */}
            {crumbs.length > 0 && crumbs[0].key !== 'root' && <BreadcrumbSeparator className="hidden md:block" />}
            {crumbs}
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      {/* Main content area wrapper - Now just contains the main Outlet */}
      <div className="flex flex-1 overflow-hidden">
        {/* AgentSidebar rendering removed from here */}

        {/* Main content outlet - Takes remaining space */}
        {/* Child routes defined in routes.tsx will render here */}
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </SidebarInset>
  );
}
