import React, { useEffect, useRef, useState } from 'react';

// This component safely loads xterm only on the client side
const TerminalView: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  // We don't initialize these refs until we're in the browser
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  
  // Track if we're running in the browser
  const [isClient, setIsClient] = useState(false);

  // This effect runs once on component mount and sets isClient to true
  useEffect(() => {
    setIsClient(true);
  }, []);

  // This effect initializes xterm.js only when we're on the client
  useEffect(() => {
    if (!isClient || !terminalRef.current) return;

    // Dynamically import xterm and the fit addon
    const setupTerminal = async () => {
      try {
        // Import the modules only on the client side
        const { Terminal } = await import('xterm');
        const { FitAddon } = await import('xterm-addon-fit');
        
        // Import the CSS, which should only happen on the client
        await import('xterm/css/xterm.css');

        // Initialize the terminal
        const term = new Terminal({
          cursorBlink: true,
          theme: {
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            cursor: 'hsl(var(--foreground))',
            selectionBackground: 'hsl(var(--accent))', 
            selectionForeground: 'hsl(var(--accent-foreground))',
          },
          rows: 10,
          fontSize: 13,
          fontFamily: 'monospace',
        });
        xtermRef.current = term;

        // Initialize and load FitAddon
        const fitAddon = new FitAddon();
        fitAddonRef.current = fitAddon;
        term.loadAddon(fitAddon);

        // Attach the terminal to the DOM element
        term.open(terminalRef.current as HTMLElement);

        // Fit the terminal initially
        fitAddon.fit();

        // Initial prompt or message
        term.writeln('Welcome to the integrated terminal!');
        term.writeln('');

        // Set up resize handling
        const handleResize = () => {
          fitAddon.fit();
        };

        // Use ResizeObserver for robust resize detection
        const resizeObserver = new ResizeObserver(handleResize);
        if (terminalRef.current) {
          resizeObserver.observe(terminalRef.current);
        }

        // Cleanup on unmount
        return () => {
          resizeObserver.disconnect();
          term.dispose();
          xtermRef.current = null;
          fitAddonRef.current = null;
        };
      } catch (error) {
        console.error('Failed to initialize terminal:', error);
      }
    };

    setupTerminal();
  }, [isClient]);

  // Ensure the container allows the terminal to fill it
  return (
    <div 
      ref={terminalRef} 
      style={{ height: '100%', width: '100%', overflow: 'hidden' }}
    >
      {!isClient && (
        <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
          Loading terminal...
        </div>
      )}
    </div>
  );
};

export default TerminalView;