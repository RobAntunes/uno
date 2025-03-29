import { NavLink, useParams } from 'react-router-dom';
import { TeamStructureItem } from './app-sidebar'; // Import the type
import { cn } from '../../../lib/utils/cn'; // Setting the correct relative path to cn.ts

interface AgentSidebarProps {
  agentChildren: TeamStructureItem[]; // Array of Tasks, Tools, etc.
  basePath: string; // Base path of the agent e.g., /teams/sales/maverick
}

// Reusable NavLink className function (similar to app-sidebar)
const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary ${
    isActive ? 'bg-muted text-primary font-semibold' : 'text-muted-foreground'
  }`;

export function AgentSidebar({ agentChildren, basePath }: AgentSidebarProps) {

  if (!agentChildren || agentChildren.length === 0) {
    return null; // Or some placeholder if no sub-items
  }

  return (
    <div className="flex flex-col h-full w-64 bg-background border-r p-4 pt-6">
      {/* Optional: Add Agent Name or Header here */}
      {/* You could potentially fetch agent details based on basePath or pass agent name as prop */}
      <h3 className="mb-4 px-3 text-lg font-semibold tracking-tight">Agent Menu</h3>
      <nav className="flex-1 space-y-1">
        {agentChildren.map((item) => {
          const { name, path, icon: Icon } = item;
          return (
            <NavLink
              key={path}
              to={path} // Use the full path from data
              className={getNavLinkClass}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span>{name}</span>
            </NavLink>
          );
        })}
      </nav>
      {/* Optional Footer for Agent Sidebar */}
    </div>
  );
}

export default AgentSidebar; 