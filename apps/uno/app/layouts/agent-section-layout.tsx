import * as React from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
// Adjust paths relative to layouts/
import AgentSidebar from '../components/ui/agent-sidebar';
import { TeamStructureItem, teamData } from '../components/ui/app-sidebar'; // Ensure teamData is exported

// Helper function to find agent data - adjust logic as needed for your data structure/fetching
function findAgentData(teamId: string | undefined, agentId: string | undefined, data: TeamStructureItem[]): { agentChildren: TeamStructureItem[] | null, basePath: string | null, agentName: string | null } {
    if (!teamId || !agentId) return { agentChildren: null, basePath: null, agentName: null };

    const team = data[0]?.children?.find(t => t.path.split('/').pop() === teamId);
    if (!team?.children) return { agentChildren: null, basePath: null, agentName: null };

    const agent = team.children.find(a => a.path.split('/').pop() === agentId);
    if (!agent) return { agentChildren: null, basePath: null, agentName: null };

    return {
        agentChildren: agent.children || null, // Tasks, Tools, etc.
        basePath: agent.path,               // e.g., /teams/sales/maverick
        agentName: agent.name
    };
}

export default function AgentSectionLayout() {
    const { teamId, agentId } = useParams<{ teamId: string; agentId: string }>();
    const location = useLocation(); // Keep location if needed for sidebar active state

    const { agentChildren, basePath, agentName } = findAgentData(teamId, agentId, teamData);

    if (!agentChildren || !basePath) {
        console.warn(`AgentSectionLayout: Could not find agent data for teamId: ${teamId}, agentId: ${agentId}`);
        return <div className="p-4 text-red-600">Error: Agent details not found for {teamId}/{agentId}.</div>;
    }

    return (
        // This layout contains the AgentSidebar and the Outlet for specific agent content
        <div className="flex flex-1 overflow-hidden h-full">
            <AgentSidebar agentChildren={agentChildren} basePath={basePath} />
            <main className="flex-1 overflow-auto p-4">
                {/* Child routes (tasks, tools, index) render here */}
                <Outlet />
            </main>
        </div>
    );
}
