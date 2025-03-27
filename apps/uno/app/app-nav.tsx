import * as React from 'react';
import { NavLink } from 'react-router';

export function AppNav() {
  return (
    <nav>
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/about" end>
        About
      </NavLink>
      <NavLink to="/auth" end>
        Auth
      </NavLink>
    </nav>
  );
}
