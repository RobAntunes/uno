import * as React from 'react';
import { useParams } from 'react-router-dom';

export default function AgentIndexPage() {
    const { teamId, agentId } = useParams<{ teamId: string; agentId: string }>();

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Agent Overview: {agentId}</h2>
            <p>This is the main page for agent '{agentId}' in team '{teamId}'.</p>
            <p>Agent details and summary would go here.</p>
            {/* You might fetch and display specific agent data here based on params */}
        </div>
    );
}
