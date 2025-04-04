import { createFileRoute } from '@tanstack/react-router';
import DashboardRoute from '../pages/dashboard'; // Updated import path

export const Route = createFileRoute('/')({
  component: DashboardRoute, // Use the imported component
}); 