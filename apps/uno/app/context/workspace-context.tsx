import React, { createContext, useContext, useState, ReactNode } from 'react';

interface WorkspaceContextType {
  projectRoot: string | null;
  setProjectRoot: (path: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [projectRoot, setProjectRoot] = useState<string | null>(null);

  return (
    <WorkspaceContext.Provider value={{ projectRoot, setProjectRoot }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
} 