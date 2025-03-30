import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../app/app';

test('renders loader data', async () => {
  const routes = [
    {
      path: '/',
      Component: App,
    },
  ];

  const router = createMemoryRouter(routes, {
  });

  render(<RouterProvider router={router} />);

  await waitFor(() => screen.findByRole('main'));
});
