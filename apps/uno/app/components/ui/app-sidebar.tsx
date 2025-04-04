import * as React from "react";
import {
  BarChart,
  ChevronLeft,
  ChevronRight,
  CodeSquare,
  Database,
  FileText,
  FolderKanban,
  GripVertical,
  Home,
  LayoutDashboard,
  Lightbulb,
  LogIn,
  List,
  ArrowRightLeft,
  Search,
  Settings,
  Sidebar,
  Users,
  User,
  Wrench,
  Server,
} from "lucide-react";
import { Link } from '@tanstack/react-router';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import { Button } from "../../components/ui/Button";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarRail,
} from "../../components/ui/sidebar";
import { Separator } from "./separator";

// --- START: Added for Recursive Team Structure ---

// Move definitions to module scope
const linkBaseClass = "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary";
const activeLinkStyle = {
  className: "bg-muted text-primary font-semibold", // Added font-semibold for active state
};

// Define the types for our hierarchical data
export interface TeamStructureItem {
  name: string;
  path: string; // URL path for NavLink
  icon: React.ElementType; // Lucide icon component
  children?: TeamStructureItem[];
}

// Define the actual team structure data (Hardcoded for now, replace with dynamic data later)
export const teamData: TeamStructureItem[] = [
  {
    name: "Teams", // This top-level item might be handled slightly differently or skipped in rendering loop if needed
    path: "/teams",
    icon: Users,
    children: [
      {
        name: "Sales",
        path: "/teams/sales",
        icon: BarChart,
        children: [
          {
            name: "Maverick",
            path: "/teams/sales/maverick", // Base path for agent
            icon: User,
            children: [
              { name: "Tasks", path: "/teams/sales/maverick/tasks", icon: List },
              { name: "Tools", path: "/teams/sales/maverick/tools", icon: Wrench },
              { name: "Flows", path: "/teams/sales/maverick/flows", icon: ArrowRightLeft },
              { name: "Memory", path: "/teams/sales/maverick/memory", icon: Lightbulb },
            ],
          },
          {
            name: "Luna",
            path: "/teams/sales/luna",
            icon: User,
            children: [
              { name: "Tasks", path: "/teams/sales/luna/tasks", icon: List },
              { name: "Tools", path: "/teams/sales/luna/tools", icon: Wrench },
              { name: "Flows", path: "/teams/sales/luna/flows", icon: ArrowRightLeft },
              { name: "Memory", path: "/teams/sales/luna/memory", icon: Lightbulb },
            ],
          },
          {
            name: "Felix",
            path: "/teams/sales/felix",
            icon: User,
            children: [
              { name: "Tasks", path: "/teams/sales/felix/tasks", icon: List },
              { name: "Tools", path: "/teams/sales/felix/tools", icon: Wrench },
              { name: "Flows", path: "/teams/sales/felix/flows", icon: ArrowRightLeft },
              { name: "Memory", path: "/teams/sales/felix/memory", icon: Lightbulb },
            ],
          },
        ],
      },
      // Add other teams like Development, Design etc. here following the same structure
    ],
  }
];

// Simplified isAgent check for now (assumes agents are depth 2 in current data)
// A more robust check (e.g., based on children names or an explicit type) is better long-term
const isAgentNode = (item: TeamStructureItem, depth: number) => {
  // Check if it has children AND those children look like agent sub-pages (e.g., 'Tasks')
  return depth >= 1 && item.children && item.children.length > 0 && item.children.some(child => ['Tasks', 'Tools', 'Flows', 'Memory'].includes(child.name));
};

// Recursive component to render the team structure
interface TeamTreeItemProps {
  item: TeamStructureItem;
  depth?: number;
  isCollapsed?: boolean; // Pass collapsed state down
}

function TeamTreeItem({ item, depth = 0, isCollapsed }: TeamTreeItemProps) {
  const { name, path, icon: Icon, children } = item;
  const hasChildren = children && children.length > 0;
  const isAgent = isAgentNode(item, depth); // Check if it's an agent node

  const paddingLeft = isCollapsed || depth === 0 ? undefined : `${depth * 1.25}rem`;

  if (hasChildren) {
    if (isAgent) {
      return (
        <SidebarMenuItem className={`w-full ${isCollapsed ? 'justify-center' : ''}`} style={{ paddingLeft }}>
          {/* Use Link, apply active styles via activeProps */}
          <Link to={path} end className={`${linkBaseClass} w-full ${isCollapsed ? 'justify-center' : ''}`} activeProps={activeLinkStyle}>
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-2">{name}</span>}
          </Link>
        </SidebarMenuItem>
      );
    }

    return (
      <Collapsible defaultOpen={depth < 2} className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuItem className={`w-full ${isCollapsed ? 'justify-center' : ''}`} style={{ paddingLeft }}>
            {/* Use Link, apply active styles via activeProps */}
            <Link to={path} end={depth === 0} className={`${linkBaseClass} w-full ${isCollapsed ? 'justify-center' : ''}`} activeProps={activeLinkStyle}>
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="flex-1 ml-2">{name}</span>}
              {!isCollapsed && <ChevronRight className="ml-auto h-4 w-4 flex-shrink-0 transition-transform duration-200 group-[&[data-state=open]]:rotate-90" />}
            </Link>
          </SidebarMenuItem>
        </CollapsibleTrigger>
        <CollapsibleContent className={`overflow-hidden transition-all duration-300 ease-in-out data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down ${isCollapsed ? 'hidden' : ''}`}>
          {children.map((child, index) => (
            <TeamTreeItem
              key={`${path}-${child.name}-${index}`}
              item={child}
              depth={depth + 1}
              isCollapsed={isCollapsed}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  } else {
    return (
      <SidebarMenuItem className={isCollapsed ? 'my-1 justify-center' : ''} style={{ paddingLeft }}>
        {/* Use Link, apply active styles via activeProps */}
        <Link to={path} className={linkBaseClass} activeProps={activeLinkStyle}>
          <Icon className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span className="ml-2">{name}</span>}
        </Link>
      </SidebarMenuItem>
    );
  }
}

// --- END: Added for Recursive Team Structure ---

// Define props type for AppSidebar, adding props for state control
interface AppSidebarProps {
  side?: "left" | "right";
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  // Remove defaultCollapsed, state is controlled from parent now
  isCollapsed: boolean;                 // Accept state from parent
  setIsCollapsed: (value: boolean | ((prevState: boolean) => boolean)) => void; // Accept setter from parent
  [key: string]: any;
}

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 50;
const MAX_WIDTH = 400;

export function AppSidebar({
  side = "left",
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
  // Receive state and setter from props
  isCollapsed,
  setIsCollapsed,
  ...props
}: AppSidebarProps) {
  // Remove internal state for isCollapsed
  // const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  // State for dynamic width during resize still needed
  const [sidebarWidth, setSidebarWidth] = React.useState(isCollapsed ? MIN_WIDTH : defaultWidth);
  const [isDragging, setIsDragging] = React.useState(false);
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCollapsed) return;
    console.log("Sidebar Drag: Mouse Down");
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isDragging || !sidebarRef.current || isCollapsed) return;
    console.log("Sidebar Drag: Mouse Move");
    let newWidth = side === "left"
      ? e.clientX - sidebarRef.current.getBoundingClientRect().left
      : sidebarRef.current.getBoundingClientRect().right - e.clientX;

    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    console.log("Sidebar Drag: New Width =", newWidth);
    setSidebarWidth(newWidth);
  }, [isDragging, minWidth, maxWidth, side, isCollapsed]);

  const handleMouseUp = React.useCallback(() => {
    if (isDragging) {
      console.log("Sidebar Drag: Mouse Up");
      setIsDragging(false);
    }
  }, [isDragging]);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // Add cursor style
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Remove cursor style
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Ensure cursor style is removed on unmount
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Effect to update sidebarWidth when isCollapsed prop changes from parent
  React.useEffect(() => {
    // When collapsing, set to MIN_WIDTH.
    // When expanding, reset to defaultWidth.
    setSidebarWidth(isCollapsed ? MIN_WIDTH : defaultWidth);
  }, [isCollapsed, minWidth, maxWidth, defaultWidth]); // Update dependencies

  // Use the passed-in setIsCollapsed for the toggle button
  const toggleCollapse = () => {
    // Use the function form of the setter if needed, or just toggle
    setIsCollapsed(prevCollapsed => !prevCollapsed);
  };

  return (
    <div
      ref={sidebarRef}
      // Use the sidebarWidth state for dynamic width
      style={{ width: `${sidebarWidth}px` }}
      className={`relative flex flex-col h-screen bg-background border-r transition-width duration-300 ease-in-out group ${isCollapsed ? 'items-center' : ''}`}
      {...props}
    >
      {/* Collapse/Expand button now uses toggleCollapse which uses the passed-in setter */}
      <Button
        variant="ghost"
        size="icon"
        className={`absolute top-4 ${side === 'left' ? (isCollapsed ? 'left-1/2 -translate-x-1/2' : 'right-2') : (isCollapsed ? 'right-1/2 translate-x-1/2' : 'left-2')} h-8 w-8 z-20 transition-all duration-300`}
        onClick={toggleCollapse}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </Button>

      {/* Resizer handle - remains the same */}
      {!isCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 ${
            side === "left" ? "right-0" : "left-0"
          } w-2 h-full cursor-col-resize group flex items-center justify-center z-10`}
        >
          <div className="w-px h-1/6 bg-border group-hover:bg-primary transition-colors duration-200">
          </div>
        </div>
      )}

      {/* Sidebar content - pass isCollapsed down */}
      <div className={`flex flex-col h-full overflow-hidden pt-16 ${isCollapsed ? 'items-center w-full' : 'p-4'}`}>
        {!isCollapsed && (
          <div className={`flex items-center mb-4 justify-start`}>
            <img src="/assets/logo.svg" alt="Company Logo" className="h-10 w-auto mr-2" />
            <span className="font-semibold text-lg">Uno</span>
          </div>
        )}
        {isCollapsed && (
          <div className={`flex items-center mb-4 justify-center pt-2`}>
            <img src="/assets/logo.svg" alt="Company Logo" className="h-8 w-auto" />
          </div>
        )}

        <nav className={`flex-1 overflow-y-auto overflow-x-hidden list-none ${isCollapsed ? 'px-1' : ''}`}>
          <SidebarGroup className={isCollapsed ? 'flex flex-col items-center' : ''}>
            {!isCollapsed && <SidebarGroupLabel>Navigation</SidebarGroupLabel>}
            <SidebarMenuItem className={isCollapsed ? 'my-1' : ''}>
              <Link to="/dashboard" className={`${linkBaseClass} w-full ${isCollapsed ? 'justify-center' : ''}`} activeProps={activeLinkStyle}>
                <LayoutDashboard className="h-5 w-5" />
                {!isCollapsed && <span>Dashboard</span>}
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem className={isCollapsed ? 'my-1' : ''}>
              <Link to="/files" className={`${linkBaseClass} w-full ${isCollapsed ? 'justify-center' : ''}`} activeProps={activeLinkStyle}>
                <FileText className="h-5 w-5" />
                {!isCollapsed && <span>Files</span>}
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem className={isCollapsed ? 'my-1' : ''}>
              <Link to="/project" className={`${linkBaseClass} w-full ${isCollapsed ? 'justify-center' : ''}`} activeProps={activeLinkStyle}>
                <FolderKanban className="h-5 w-5" />
                {!isCollapsed && <span>Project</span>}
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem className={isCollapsed ? 'my-1' : ''}>
              <Link to="/data" className={`${linkBaseClass} w-full ${isCollapsed ? 'justify-center' : ''}`} activeProps={activeLinkStyle}>
                <Database className="h-5 w-5" />
                {!isCollapsed && <span>Data</span>}
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem className={isCollapsed ? 'my-1' : ''}>
              <Link to="/codebase" className={`${linkBaseClass} w-full ${isCollapsed ? 'justify-center' : ''}`} activeProps={activeLinkStyle}>
                <CodeSquare className="h-5 w-5" />
                {!isCollapsed && <span>Codebase</span>}
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem className={isCollapsed ? 'my-1' : ''}>
              <Link to="/servers" className={`${linkBaseClass} w-full ${isCollapsed ? 'justify-center' : ''}`} activeProps={activeLinkStyle}>
                <Server className="h-5 w-5" />
                {!isCollapsed && <span>Servers</span>}
              </Link>
            </SidebarMenuItem>
          </SidebarGroup>

          {!isCollapsed && <Separator className="my-4" />}

          {/* Teams Group - pass isCollapsed down */}
          <SidebarGroup className={isCollapsed ? 'flex flex-col items-center' : ''}>
            {!isCollapsed && <SidebarGroupLabel>Teams</SidebarGroupLabel>}
            {teamData[0]?.children?.map((team, index) => (
              <TeamTreeItem
                key={`${team.path}-${index}`}
                item={team}
                depth={1}
                isCollapsed={isCollapsed} // Pass down
              />
            ))}
          </SidebarGroup>
        </nav>

        {/* Footer/Settings Link - based on isCollapsed */}
        {!isCollapsed && (
          <div className="mt-auto p-4 border-t">
            <Link to="/settings" className={`${linkBaseClass} w-full`} activeProps={activeLinkStyle}>
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </Link>
          </div>
        )}
        {isCollapsed && (
          <div className="mt-auto py-2 border-t w-full flex justify-center">
            <Link to="/settings" className={`${linkBaseClass} justify-center`} activeProps={activeLinkStyle}>
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppSidebar;
