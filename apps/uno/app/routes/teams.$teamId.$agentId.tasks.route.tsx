import { createFileRoute } from '@tanstack/react-router';
import AgentTasks from '../pages/agent-tasks'; // Updated import path

export const Route = createFileRoute('/teams/$teamId/$agentId/tasks')({
  component: AgentTasks,
}); 