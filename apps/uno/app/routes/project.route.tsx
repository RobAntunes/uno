import { createFileRoute } from '@tanstack/react-router';
import ProjectRoute from '../pages/project';

export const Route = createFileRoute('/project')({
  component: ProjectRoute,
}); 