import * as React from "react";
import {
  BarChart,
  ChevronLeft,
  ChevronRight,
  File,
  FileText,
  Folder,
  GripVertical,
  Home,
  Layers,
  Search,
  Settings,
  Star,
  Users,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import { Button } from "../../components/ui/Button";
import {
  Sidebar,
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

// Define the directory structure data
const data = {
  tree: [
    ["Dashboard", []],
    ["Files", []],
    ["Teams", [
      ["Development", []],
      ["Design", []],
      ["Marketing", []],
      ["Sales", [
        ["Maverick", [
          ["Tasks", []],
          ["Tools", []],
          ["Flows", []],
          ["Memory", []],
        ]],
        ["Luna", [
          ["Tasks", []],
          ["Tools", []],
          ["Flows", []],
          ["Memory", []],
        ]],
        ["Felix", [
          ["Tasks", []],
          ["Tools", []],
          ["Flows", []],
          ["Memory", []],
        ]],
      ]],
      ["Product", []],
      ["Research", []],
    ]],
  ],
};

// Define the type for a tree item and its props
type TreeItem = [string, TreeItem[]];
interface TreeProps {
  item: TreeItem;
  depth?: number;
}

// Explicitly type keys for iconMap
const iconMap: { [key: string]: React.ReactNode } = {
  "Dashboard": <Home className="size-4 text-muted-foreground" />,
  "Files": <FileText className="size-4 text-muted-foreground" />,
  "Teams": <Users className="size-4 text-muted-foreground" />,
  "Sales": <BarChart className="size-4 text-muted-foreground" />,
  "Product": <Layers className="size-4 text-muted-foreground" />,
  "Research": <Search className="size-4 text-muted-foreground" />,
};

// Define props type for AppSidebar
interface AppSidebarProps {
  side?: "left" | "right";
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  defaultCollapsed?: boolean;
  // Include other props if necessary, e.g., from React.HTMLAttributes<HTMLDivElement>
  [key: string]: any; // Allow other props for simplicity
}

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export function AppSidebar({
  side = "left",
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
  defaultCollapsed = false,
  ...props
}: AppSidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const [sidebarWidth, setSidebarWidth] = React.useState(defaultWidth);
  const [isDragging, setIsDragging] = React.useState(false);
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    console.log("Sidebar Drag: Mouse Down");
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isDragging || !sidebarRef.current) return;
    console.log("Sidebar Drag: Mouse Move");
    let newWidth = side === "left"
      ? e.clientX - sidebarRef.current.getBoundingClientRect().left
      : sidebarRef.current.getBoundingClientRect().right - e.clientX;

    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth)); // Clamp width
    console.log("Sidebar Drag: New Width =", newWidth);
    setSidebarWidth(newWidth);
  }, [isDragging, minWidth, maxWidth, side]);

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
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    // Optionally reset width when collapsing/expanding
    // if (!isCollapsed) setSidebarWidth(defaultWidth);
  };

  return (
    // Apply dynamic width, transition, and ref. Hide overflow when dragging.
    <Sidebar
      ref={sidebarRef}
      side={side}
      className={`bg-background relative transition-all duration-300 ease-in-out !border-none shadow-lg ${
        isDragging ? "overflow-hidden select-none" : ""
      }`}
      style={{ width: isCollapsed ? "auto" : sidebarWidth }} // Width applied here
      {...props}
    >
      {/* Hide content when collapsed, make scrollable, ensure height constraint */}
      <SidebarContent className={`${isCollapsed ? "hidden" : "block"} h-full`}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="overflow-x-auto w-full py-2">
              {/* Wrapper div to enforce minimum width based on content */}
              <div style={{ minWidth: "max-content" }} className="h-full">
                {data.tree.map((item, index) => (
                  <Tree key={index} item={item as TreeItem} depth={0} />
                ))}
              </div>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Keep Rail visible, add collapse toggle */}
      <SidebarRail className="flex flex-col items-center justify-between py-4">
        {/* Example: Add other rail items if needed */}
        <div></div>
        {/* Collapse toggle - Use a styled div instead of nested Button */}
        <div
          role="button"
          aria-label="Toggle sidebar collapse"
          tabIndex={0} // Make it focusable
          onClick={toggleCollapse}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") toggleCollapse();
          }} // Handle keyboard activation
          className="mt-auto p-2 rounded-md hover:bg-muted cursor-pointer flex items-center justify-center"
        >
          {isCollapsed
            ? <ChevronRight className="size-4" />
            : <ChevronLeft className="size-4" />}
        </div>
      </SidebarRail>

      {/* Draggable Handle - only shown when not collapsed */}
      {!isCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 ${
            side === "left" ? "right-0" : "left-0"
          } w-2 h-full cursor-col-resize group flex items-center justify-center z-50`}
        >
          <div className="w-px h-1/6 bg-border group-hover:bg-primary transition-colors duration-200">
          </div>
          {/* Optional: Add visual indicator like GripVertical on hover */}
          {/* <GripVertical className="absolute text-border group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200" size={16} /> */}
        </div>
      )}
    </Sidebar>
  );
}

function Tree({ item, depth = 0 }: TreeProps) {
  const [name, ...items] = item;
  const subItems = items[0] || [];
  const isActive = name === "Sales";
  const icon = name in iconMap
    ? iconMap[name]
    : <Folder className="size-4 text-muted-foreground" />;
  const paddingLeft = `${depth * 1.5}rem`;

  if (!subItems.length) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          className="data-[active=true]:bg-muted data-[active=true]:font-medium text-sm"
          style={{ paddingLeft: paddingLeft }}
        >
          {icon}
          <span
            className={`${isActive ? "text-foreground" : "text-muted-foreground"} whitespace-nowrap`}
          >
            {name}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        defaultOpen={isActive || name === "Teams"}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className="text-sm"
            style={{ paddingLeft: paddingLeft }}
          >
            <ChevronRight className="size-4 text-muted-foreground transition-transform shrink-0" />
            {icon}
            <span className="text-foreground ml-2 whitespace-nowrap">{name}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {subItems.map((
              subItem: unknown,
              index: React.Key | null | undefined,
            ) => (
              <Tree key={index} item={subItem as TreeItem} depth={depth + 1} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

export default AppSidebar;
