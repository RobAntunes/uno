import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('./app.tsx'),
  route('about', './routes/about.tsx'),
  route('auth', './routes/auth/index.tsx'),
  route('dashboard', './routes/dashboard/page.tsx'),
] satisfies RouteConfig;
