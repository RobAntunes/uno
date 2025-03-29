import * as React from 'react';
import { NavLink } from 'react-router-dom';

export function AppNav() {
  return (
    <nav className="flex items-center space-x-4 py-2 px-4 bg-background border-b">
      <NavLink 
        to="/" 
        end
        className={({ isActive }) => 
          `px-3 py-2 rounded-md hover:bg-muted transition-colors ${isActive ? 'font-medium bg-muted' : ''}`
        }
      >
        Home
      </NavLink>
      <NavLink 
        to="/about" 
        end
        className={({ isActive }) => 
          `px-3 py-2 rounded-md hover:bg-muted transition-colors ${isActive ? 'font-medium bg-muted' : ''}`
        }
      >
        About
      </NavLink>
      <NavLink 
        to="/auth" 
        end
        className={({ isActive }) => 
          `px-3 py-2 rounded-md hover:bg-muted transition-colors ${isActive ? 'font-medium bg-muted' : ''}`
        }
      >
        Auth
      </NavLink>
      <NavLink 
        to="/dashboard" 
        end
        className={({ isActive }) => 
          `px-3 py-2 rounded-md hover:bg-muted transition-colors ${isActive ? 'font-medium bg-muted' : ''}`
        }
      >
        Dashboard
      </NavLink>
    </nav>
  );
}
