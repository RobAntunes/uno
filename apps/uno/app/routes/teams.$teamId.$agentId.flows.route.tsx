import { createFileRoute } from '@tanstack/react-router';
import AgentFlows from '../pages/agent-flows'; // Updated import path

export const Route = createFileRoute('/teams/$teamId/$agentId/flows')({
  component: AgentFlows,
}); 