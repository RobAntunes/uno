import type { RouteConfig } from '@react-router/dev/routes'; // Use the type expected by the plugin if available

// Import your route components
import App from './app'; // Main app layout
import AuthPage from './routes/auth/index';
import DashboardPage from './routes/dashboard';
import FilesPage from './routes/files';
import ProjectPage from './routes/project';
import DataPage from './routes/data';
import CodebasePage from './routes/codebase';
import SettingsPage from './routes/settings';

// Import Agent specific layouts and pages
import AgentSectionLayout from './layouts/agent-section-layout';
import AgentIndexPage from './routes/agent-index';
import AgentTasksPage from './routes/agent/tasks';
import AgentToolsPage from './routes/agent/tools';
import AgentFlowsPage from './routes/agent/flows';
import AgentMemoryPage from './routes/agent/memory';

// Define breadcrumb data type for route handles (optional but good practice)
// Re-enable this later if we find a way to add handles
// declare module 'react-router-dom' {
//   interface RouteHandles {
//     breadcrumb?: string;
//   }
// }

const routes: RouteConfig = [ // Use RouteConfig type if possible, otherwise adjust
  {
    path: "/",
    file: './app.tsx', // Path to the main layout component
    children: [
      // --- Top Level Routes ---
      {
        index: true,
        file: './routes/dashboard.tsx',
        // This is the index route, making dashboard the default for "/"
      },
      {
        path: "files",
        file: './routes/files.tsx',
      },
      {
        path: "project",
        file: './routes/project.tsx',
      },
      {
        path: "data",
        file: './routes/data.tsx',
      },
      {
        path: "codebase",
        file: './routes/codebase.tsx',
      },
      {
        path: "settings",
        file: './routes/settings.tsx',
      },

      // --- Teams/Agent Routes (Nested) ---
      {
        path: "teams/:teamId/:agentId",
        file: './layouts/agent-section-layout.tsx', // Path to the agent layout component
        children: [
          {
            index: true,
            file: './routes/agent-index.tsx', // Path to agent index page
          },
          {
            path: "tasks",
            file: './routes/agent/tasks.tsx', // Path to agent tasks page
          },
          {
            path: "tools",
            file: './routes/agent/tools.tsx', // Path to agent tools page
          },
          {
            path: "flows",
            file: './routes/agent/flows.tsx', // Path to agent flows page
          },
          {
            path: "memory",
            file: './routes/agent/memory.tsx', // Path to agent memory page
          },
        ]
      },
    ]
  },
  {
    path: "/auth",
    file: './routes/auth/index.tsx', // Path to auth page
  },
  // You might add a catch-all 404 route here later
  // { path: "*", element: <NotFoundPage /> }
];

export default routes;
