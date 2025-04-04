import { createFileRoute } from '@tanstack/react-router';
import ServersPage from '../pages/servers';

export const Route = createFileRoute('/servers')({
  component: ServersPage,
}); 