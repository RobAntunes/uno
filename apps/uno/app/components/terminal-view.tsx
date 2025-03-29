import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css'; // Import xterm css

const TerminalView: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (terminalRef.current && !xtermRef.current) {
      // Initialize xterm.js
      const term = new Terminal({
        cursorBlink: true,
        // Use CSS variables for theme to adapt to light/dark mode
        theme: {
          background: 'hsl(var(--background))',
          foreground: 'hsl(var(--foreground))',
          cursor: 'hsl(var(--foreground))',
          selectionBackground: 'hsl(var(--accent))', 
          selectionForeground: 'hsl(var(--accent-foreground))',
        },
        rows: 10, // Start with a moderate number of rows
        fontSize: 13, // Optional: Adjust font size
        fontFamily: 'monospace', // Optional: Set font family
      });
      xtermRef.current = term;

      // Initialize and load FitAddon
      const fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      term.loadAddon(fitAddon);

      // Attach the terminal to the DOM element
      term.open(terminalRef.current);

      // Fit the terminal initially - will adjust based on container
      fitAddon.fit();

      // --- TODO: Set up IPC communication ---
      // Example: Listen for data from main process
      // window.electronAPI?.onTerminalData((_event, data) => {
      //   term.write(data);
      // });

      // Example: Send data (user input) to main process
      // term.onData((data) => {
      //   window.electronAPI?.sendTerminalData(data);
      // });

      // --- Resize Handling ---
      const handleResize = () => {
        fitAddon.fit();
        // Example: Notify main process of new dimensions
        // if (term && window.electronAPI) {
        //    window.electronAPI.resizeTerminal({ cols: term.cols, rows: term.rows });
        // }
      };

      // Use ResizeObserver for robust resize detection
      const resizeObserver = new ResizeObserver(handleResize);
      if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current);
      }

      // Initial prompt or message
      term.writeln('Welcome to the integrated terminal!');
      term.writeln('');

      // Cleanup on unmount
      return () => {
        resizeObserver.disconnect();
        term.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      };
    }
  }, []);

  // Ensure the container allows the terminal to fill it
  return (
    <div 
      ref={terminalRef} 
      style={{ height: '100%', width: '100%', overflow: 'hidden' }} // Prevent scrollbars on the container itself
    >
      {/* The terminal will be rendered here by xterm.js */}
    </div>
  );
};

export default TerminalView; 