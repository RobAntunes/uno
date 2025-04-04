import * as React from 'react';
import { NavLink } from 'react-router';

// Define the type for the className function parameter
interface NavLinkRenderProps {
  isActive: boolean;
  isPending: boolean;
  isTransitioning: boolean; // Added in later versions
}

export function AppNav() {
  // Removed the helper function

  return (
    <nav className="flex items-center space-x-4 py-2 px-4 bg-background border-b">
      <NavLink 
        to="/" 
        end
        // Use inline function with explicit type annotation
        className={({ isActive }: NavLinkRenderProps) => 
          `px-3 py-2 rounded-md hover:bg-muted transition-colors ${isActive ? 'font-medium bg-muted' : ''}`
        }
      >
        Home
      </NavLink>
      <NavLink 
        to="/about" 
        end
        // Use inline function with explicit type annotation
        className={({ isActive }: NavLinkRenderProps) => 
          `px-3 py-2 rounded-md hover:bg-muted transition-colors ${isActive ? 'font-medium bg-muted' : ''}`
        }
      >
        About
      </NavLink>
      <NavLink 
        to="/auth" 
        end
        // Use inline function with explicit type annotation
        className={({ isActive }: NavLinkRenderProps) => 
          `px-3 py-2 rounded-md hover:bg-muted transition-colors ${isActive ? 'font-medium bg-muted' : ''}`
        }
      >
        Auth
      </NavLink>
      <NavLink 
        to="/dashboard" 
        end
        // Use inline function with explicit type annotation
        className={({ isActive }: NavLinkRenderProps) => 
          `px-3 py-2 rounded-md hover:bg-muted transition-colors ${isActive ? 'font-medium bg-muted' : ''}`
        }
      >
        Dashboard
      </NavLink>
    </nav>
  );
}
