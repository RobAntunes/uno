import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useCodePanel } from '../../context/code-panel-context';
import { cn } from '../../../lib/utils';

export function CodePanel() {
  const { isOpen, setIsOpen, currentFile } = useCodePanel();

  return (
    <div
      className={cn(
        'fixed top-0 right-0 w-[600px] h-full bg-background border-l transform transition-transform duration-200 ease-in-out z-50',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-sm font-medium">
            {currentFile ? currentFile.split('/').pop() : 'Code View'}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {/* Code content will go here */}
          {currentFile ? (
            <pre className="text-sm">
              <code>
                {/* We'll add code content and syntax highlighting later */}
                Loading {currentFile}...
              </code>
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No file selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}