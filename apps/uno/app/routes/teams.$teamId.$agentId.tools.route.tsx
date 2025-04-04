import { createFileRoute } from '@tanstack/react-router';
import AgentTools from '../pages/agent-tools'; // Updated import path

export const Route = createFileRoute('/teams/$teamId/$agentId/tools')({
  component: AgentTools,
}); 