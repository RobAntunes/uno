import { createFileRoute } from '@tanstack/react-router';
import AgentIndexPage from '../pages/agent-index'; // Updated import path

// Index route for the agent section
export const Route = createFileRoute('/teams/$teamId/$agentId/')({
  component: AgentIndexPage,
}); 