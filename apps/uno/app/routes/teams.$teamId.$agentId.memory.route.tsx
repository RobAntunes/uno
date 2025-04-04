import { createFileRoute } from '@tanstack/react-router';
import AgentMemory from '../pages/agent-memory'; // Updated import path

export const Route = createFileRoute('/teams/$teamId/$agentId/memory')({
  component: AgentMemory,
}); 