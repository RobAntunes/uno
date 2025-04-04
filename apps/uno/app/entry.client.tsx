/**
 * By default, React Router will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx react-router reveal` ✨
 * For more information, see https://reactrouter.com/explanation/special-files#entryclienttsx
 */

import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { createRouter, RouterProvider } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

startTransition(() => {
  hydrateRoot(
    document.getElementById('root')!,
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});
