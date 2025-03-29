import * as React from 'react';

interface AgentContextProps {
  agentName: string | null;
  setAgentName: (name: string | null) => void;
}

const AgentContext = React.createContext<AgentContextProps | undefined>(undefined);

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agentName, setAgentName] = React.useState<string | null>(null);

  return (
    <AgentContext.Provider value={{ agentName, setAgentName }}>
      {children}
    </AgentContext.Provider>
  );
};

export const useAgent = (): AgentContextProps => {
  const context = React.useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
}; 