import { createFileRoute, Outlet } from "@tanstack/react-router";

// Create the route, matching the path structure
export const Route = createFileRoute("/teams/$teamId/$agentId")({
  // Use Outlet to render child routes
  component: Outlet,
}); 