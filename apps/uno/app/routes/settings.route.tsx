import { createFileRoute } from '@tanstack/react-router';
import SettingsRoute from '../pages/settings';

export const Route = createFileRoute('/settings')({
  component: SettingsRoute,
}); 