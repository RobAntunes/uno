import * as React from 'react';
import { useAgent } from '../context/agent-context';
import { Button } from './ui/Button'; // Assuming Button component exists
import { PlusCircle } from 'lucide-react'; // Example icon

export function ChatHeader() {
  const { agentName } = useAgent();

  return (
    <div className="flex h-16 items-center justify-between border-b bg-muted/10 px-4 py-2 shrink-0">
      <h2 className="text-lg font-semibold">
        {agentName ? `Chat with ${agentName}` : 'Chat'}
      </h2>
      <div className="flex items-center gap-2">
        {/* Add other controls here as needed */}
        <Button variant="outline" size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
    </div>
  );
} 