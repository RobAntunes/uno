import { createFileRoute } from '@tanstack/react-router';
import FilesRoute from '../pages/files';

export const Route = createFileRoute('/files')({
  component: FilesRoute,
}); 