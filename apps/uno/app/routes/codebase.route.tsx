import { createFileRoute } from '@tanstack/react-router';
import CodebaseRoute from '../pages/codebase';

export const Route = createFileRoute('/codebase')({
  component: CodebaseRoute,
}); 