import React, { useEffect, useRef, useState } from 'react';

// This component safely loads xterm only on the client side
const TerminalView: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  // We don't initialize these refs until we're in the browser
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null); // Ref for WebSocket
  
  // Track if we're running in the browser
  const [isClient, setIsClient] = useState(false);

  // This effect runs once on component mount and sets isClient to true
  useEffect(() => {
    setIsClient(true);
  }, []);

  // This effect initializes xterm.js and WebSocket only when we're on the client
  useEffect(() => {
    if (!isClient || !terminalRef.current) return;

    let term: any; // Declare term here to access in cleanup

    // Dynamically import xterm and the fit addon
    const setupTerminal = async () => {
      try {
        // Import the modules only on the client side
        const { Terminal } = await import('xterm');
        const { FitAddon } = await import('xterm-addon-fit');
        
        // Import the CSS, which should only happen on the client
        await import('xterm/css/xterm.css');

        // Initialize the terminal
        term = new Terminal({
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
          allowProposedApi: true, // Might be needed for some addon interactions or future features
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

        // --- WebSocket Connection ---
        const wsUrl = 'ws://localhost:8081'; // Define WebSocket URL
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('Terminal WebSocket Connected');
          // Send initial size on connection
          const initialSize = { cols: term.cols, rows: term.rows };
           ws.send(JSON.stringify({ type: 'resize', ...initialSize }));
          term.writeln('\x1b[32mConnected to shell.\x1b[0m'); // Green text
          term.writeln('');
        };

        ws.onmessage = (event) => {
          // Assuming backend sends plain text output
          term.write(event.data);
        };

        ws.onerror = (error) => {
          console.error('Terminal WebSocket Error:', error);
          term.writeln('\x1b[31mWebSocket connection error.\x1b[0m'); // Red text
        };

        ws.onclose = () => {
          console.log('Terminal WebSocket Disconnected');
          term.writeln('\x1b[31mDisconnected from shell.\x1b[0m'); // Red text
           xtermRef.current = null; // Ensure we don't try to use disposed term
          fitAddonRef.current = null;
          wsRef.current = null;
        };

        // Send data from xterm to WebSocket
        term.onData((data: string) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data }));
          }
        });
         // --- End WebSocket Connection ---

        // Remove initial prompt, backend will provide it
        // term.writeln('Welcome to the integrated terminal!');
        // term.writeln('');

        // Set up resize handling
        const handleResize = () => {
          if (!fitAddonRef.current || !xtermRef.current) return;
          fitAddonRef.current.fit();
           // Send new size to backend via WebSocket
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const newSize = { cols: xtermRef.current.cols, rows: xtermRef.current.rows };
            wsRef.current.send(JSON.stringify({ type: 'resize', ...newSize }));
          }
        };

        // Use ResizeObserver for robust resize detection
        const resizeObserver = new ResizeObserver(handleResize);
        if (terminalRef.current) {
          resizeObserver.observe(terminalRef.current);
        }

        // Cleanup on unmount
        return () => {
          resizeObserver.disconnect();
          // Close WebSocket connection if open
          if (wsRef.current) {
             wsRef.current.close();
             wsRef.current = null;
          }
           // Dispose terminal if it exists
          if (xtermRef.current) {
            xtermRef.current.dispose();
            xtermRef.current = null;
          }
          fitAddonRef.current = null; // Clear fit addon ref
        };
      } catch (error) {
        console.error('Failed to initialize terminal:', error);
        // Display error in the placeholder div if terminal init fails
        if (terminalRef.current) {
           terminalRef.current.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-destructive text-destructive-foreground">Failed to load terminal. Check console.</div>';
        }
      }
    };

    setupTerminal();

     // Ensure cleanup runs when the component unmounts or dependencies change
     return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
      // No need to call resizeObserver.disconnect() here as it's handled in setupTerminal's return
    };
  }, [isClient]); // Dependency array ensures this runs only when isClient changes

  // Ensure the container allows the terminal to fill it
  return (
    <div 
      ref={terminalRef} 
      style={{ height: '100%', width: '100%', overflow: 'hidden', padding: '10px', backgroundColor: "black" }}
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