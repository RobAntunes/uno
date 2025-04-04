import * as React from 'react';
// Import useParams from the generated route definition
import { Route } from '../routes/teams.$teamId.$agentId.index';

export default function AgentIndexPage() {
    // Use the type-safe params from the route
    const { teamId, agentId } = Route.useParams();

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Agent Overview: {agentId}</h2>
            <p>This is the main page for agent '{agentId}' in team '{teamId}'.</p>
            <p>Agent details and summary would go here.</p>
            {/* You might fetch and display specific agent data here based on params */}
        </div>
    );
}
