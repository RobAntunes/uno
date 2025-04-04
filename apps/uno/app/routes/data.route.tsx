import { createFileRoute } from '@tanstack/react-router';
import DataRoute from '../pages/data';

export const Route = createFileRoute('/data')({
  component: DataRoute,
}); 