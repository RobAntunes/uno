import React, { createContext, useContext, useState } from 'react';

interface CodePanelContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentFile: string | null;
  setCurrentFile: (file: string | null) => void;
}

const CodePanelContext = createContext<CodePanelContextType | undefined>(undefined);

export function CodePanelProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  return (
    <CodePanelContext.Provider value={{ isOpen, setIsOpen, currentFile, setCurrentFile }}>
      {children}
    </CodePanelContext.Provider>
  );
}

export function useCodePanel() {
  const context = useContext(CodePanelContext);
  if (context === undefined) {
    throw new Error('useCodePanel must be used within a CodePanelProvider');
  }
  return context;
}