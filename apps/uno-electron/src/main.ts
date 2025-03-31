import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from the root directory's .env file first
// Adjust the path relative to the compiled main.js in dist/
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); 

// Load environment variables from apps/uno/.env, potentially overriding root
// Adjust the path relative to the compiled main.js in dist/
dotenv.config({ path: path.resolve(__dirname, '../../uno/.env'), override: true });

// Add a check to see if the key is loaded
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("WARN: ANTHROPIC_API_KEY not found after loading .env files. Check paths in main.ts and ensure the key exists.");
} else {
  console.log("INFO: ANTHROPIC_API_KEY loaded successfully.");
}

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import SquirrelEvents from './app/events/squirrel.events';
import ElectronEvents from './app/events/electron.events';
import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import App from './app/app';
import * as fs from 'fs/promises';
import { WebSocketServer, WebSocket } from 'ws'; // Import WebSocket server
import * as pty from 'node-pty'; // Import node-pty
import * as os from 'os'; // Import os module
// import * as chokidar from 'chokidar'; // Removed

// --- Define the structure for MCP Server config (matching mcp.json)
// Note: This is simplified; add other fields like transport, url etc. if needed by the handler
interface McpServerConfig {
  description?: string;
  active: boolean;
  command?: string;
  args?: string[];
  transport?: 'stdio' | 'sse';
  url?: string;
  // Add other potential fields from your mcp.json schema
}

interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

// --- Path to mcp.json (relative to project root, assuming CWD is project root)
const MCP_CONFIG_PATH = path.resolve(process.cwd(), 'mcp.json');

// --- IPC Handlers for MCP Config ---

// Handler to read and return the MCP server configuration
ipcMain.handle('get-mcp-servers', async (): Promise<McpConfig> => {
  console.log(`[Main Process] Reading MCP config from: ${MCP_CONFIG_PATH}`);
  try {
    const fileContent = await fs.readFile(MCP_CONFIG_PATH, 'utf-8');
    const config = JSON.parse(fileContent) as McpConfig;
    // Basic validation
    if (!config || typeof config.servers !== 'object') {
      throw new Error('Invalid MCP configuration format: missing or invalid \'servers\' property.');
    }
    console.log("[Main Process] Successfully read and parsed MCP config.");
    return config;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`[Main Process] MCP config file not found at ${MCP_CONFIG_PATH}. Returning default empty structure.`);
      // Return a default empty structure if the file doesn't exist
      return { servers: {} };
    } else {
      console.error('[Main Process] Error reading or parsing MCP config:', error);
      throw new Error(`Failed to read/parse MCP configuration: ${error.message}`);
    }
  }
});

// Handler to save the updated MCP server configuration
ipcMain.handle('save-mcp-servers', async (event: IpcMainInvokeEvent, updatedConfig: McpConfig): Promise<void> => {
  console.log(`[Main Process] Saving updated MCP config to: ${MCP_CONFIG_PATH}`);
  try {
    // Basic validation of incoming data
    if (!updatedConfig || typeof updatedConfig.servers !== 'object') {
      throw new Error('Invalid configuration format provided for saving.');
    }
    const jsonString = JSON.stringify(updatedConfig, null, 2); // Pretty print JSON
    await fs.writeFile(MCP_CONFIG_PATH, jsonString, 'utf-8');
    console.log("[Main Process] Successfully saved MCP config.");
  } catch (error: any) {
    console.error('[Main Process] Error saving MCP config:', error);
    throw new Error(`Failed to save MCP configuration: ${error.message}`);
  }
});

// --- End MCP Config IPC Handlers ---

// --- Reference to the active terminal process ---
// For simplicity, we assume only one terminal is active at a time.
// This could be extended to a map if multiple sessions are needed.
let activePtyProcess: pty.IPty | null = null;

// --- Function for the tool to call ---
export async function executeCommandInMainPty(command: string): Promise<string> {
  console.log(`[Main Process] Attempting to execute command via tool: ${command}`);
  if (!activePtyProcess) {
    console.error('[Main Process] Cannot execute command: No active pty process.');
    throw new Error("No active terminal session found.");
  }
  try {
    // Add carriage return to simulate pressing Enter
    activePtyProcess.write(command + '\r');
    console.log(`[Main Process] Command sent to active pty process ${activePtyProcess.pid}`);
    // Return confirmation. Output streams via WebSocket.
    return `Command sent to terminal.`;
  } catch (error: any) {
    console.error(`[Main Process] Error writing to pty process ${activePtyProcess.pid}:`, error);
    throw new Error(`Failed to send command to terminal: ${error.message}`);
  }
}

// Define types matching the renderer (can be shared in a common types file later)
interface FSEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}
interface DirectoryListing {
    path: string;
    entries: FSEntry[];
}

// Simple message state for the agent graph
export interface MessagesState {
  messages: Array<HumanMessage | AIMessage>;
}

// --- IPC Handler for Reading Directory ---
// Using handle/invoke for async request/response
ipcMain.handle('read-directory', async (event: IpcMainInvokeEvent, requestedPath: string): Promise<DirectoryListing> => {
  console.log(`[Main Process] Received read-directory request for: ${requestedPath}`);

  // Basic security check: Resolve the path to ensure it's absolute and normalized.
  // Consider adding more robust path validation/sandboxing later based on your app's needs.
  // Resolve relative to app's CWD. Might need adjustment if you want it relative to user data, etc.
  const absolutePath = path.resolve(requestedPath || '.');
  console.log(`[Main Process] Resolved path to: ${absolutePath}`);

  try {
    const entries: FSEntry[] = [];
    const ignoredNames = new Set(['.git', 'node_modules', 'dist',


    ]); // Add folders to ignore here

    const dir = await fs.opendir(absolutePath);
    for await (const dirent of dir) {
      // Potentially filter out hidden files, specific types, etc.
      if (dirent.name.startsWith('.') && dirent.name !== '.') continue; // Keep ignoring hidden, except root itself if requested
      if (ignoredNames.has(dirent.name)) continue; // Skip ignored directories

      entries.push({
        name: dirent.name,
        // Important: Send back the *absolute* path for the next request
        path: path.join(absolutePath, dirent.name),
        isDirectory: dirent.isDirectory(),
      });
    }

    // Sort entries (optional, directories first, then alphabetically)
    entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1; // Directories first
        }
        return a.name.localeCompare(b.name); // Then alphabetical
    });


    console.log(`[Main Process] Sending listing for ${absolutePath}`);
    return { path: absolutePath, entries: entries };

  } catch (error: any) {
    console.error(`[Main Process] Error reading directory ${absolutePath}:`, error);
    // Re-throw the error so the renderer's catch block receives it
    throw new Error(`Failed to read directory '${absolutePath}': ${error.message}`);
  }
});
// --- End IPC Handler ---

// --- IPC Handler for Executing Terminal Commands ---
// Remove this handler as agent runs in main process now
/*
ipcMain.handle('execute-terminal-command', async (event: IpcMainInvokeEvent, command: string): Promise<{ success: boolean, output?: string, error?: string }> => {
  console.log(`[Main Process] Received execute-terminal-command request: ${command}`);
  try {
      // Use the existing function that interacts with the active pty
      const result = await executeCommandInMainPty(command);
      // Adapt the return value structure slightly for invoke/handle
      return { success: true, output: result };
  } catch (error: any) {
      console.error(`[Main Process] Error executing command "${command}":`, error);
      return { success: false, error: error.message };
  }
});
*/
// --- End Terminal Command Handler ---

// --- IPC Handler for Agent Interaction ---
// Re-enable this handler
// Import the agent interaction function
import { runAgentInteraction } from './app/agent';

// Re-enable this handler by removing the block comment
ipcMain.handle('run-agent', async (event: IpcMainInvokeEvent, input: string): Promise<string> => {
  console.log(`[Main Process] Received run-agent request with input: ${input}`);
  try {
    // We might want to pass a session/thread ID from the frontend later
    const aiResponse = await runAgentInteraction(input);
    // Return the content of the AI's final message
    // We might want to return the full message structure later
    // Ensure this returns a string as expected by app.tsx
    const responseContent = typeof aiResponse.content === 'string' ? aiResponse.content : JSON.stringify(aiResponse.content);
    return responseContent;
  } catch (error: any) {
    console.error('[Main Process] Error running agent interaction:', error);
    // Re-throw or return a formatted error message to the renderer
    // Return error message as string to the UI
    return `Error: Agent execution failed: ${error.message}`;
  }
});
// --- End Agent IPC Handler ---

export default class Main {
  static initialize() {
    if (SquirrelEvents.handleEvents()) {
      // squirrel event handled (except first run event) and app will exit in 1000ms, so don't do anything else
      app.quit();
    }
  }

  static bootstrapApp() {
    App.main(app, BrowserWindow);
  }

  static bootstrapAppEvents() {
    ElectronEvents.bootstrapElectronEvents();

    // Initialize WebSocket Terminal Server
    this.bootstrapTerminalServer();

    // initialize auto updater service
    if (!App.isDevelopmentMode()) {
      // UpdateEvents.initAutoUpdateService();
    }
  }

  // --- New Static Method for Terminal Server ---
  static bootstrapTerminalServer() {
    const port = 8081;
    const wss = new WebSocketServer({ port });
    console.log(`[Main Process] Terminal WebSocket Server listening on port ${port}`);

    wss.on('connection', (ws) => {
      console.log('[Main Process] Terminal client connected via WebSocket');

      // Spawn pty process
      const shellPath = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
      const ptyProcess = pty.spawn(shellPath, [], {
        name: 'xterm-color', // Corresponds to xterm.js terminal type
        cols: 80, // Default size, will be updated on resize event
        rows: 30,
        cwd: process.env.HOME, // Start in user's home directory
        env: process.env, // Use current environment variables
      });

      console.log(`[Main Process] Spawned pty process with PID: ${ptyProcess.pid}`);

      // --- Store reference to the active process ---
      if (activePtyProcess) {
         // Kill previous pty if a new connection is made (simple single-session handling)
         console.warn(`[Main Process] Killing previous pty process ${activePtyProcess.pid} due to new connection.`);
         try {
            activePtyProcess.kill();
         } catch (e) { /* Ignore error if already dead */ }
      }
      activePtyProcess = ptyProcess;
      // --- End store reference ---

      // Pipe pty output to WebSocket
      ptyProcess.onData((data) => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        } catch (err) {
          console.error('[Main Process] Error sending data over WebSocket:', err);
        }
      });

      // Handle messages from WebSocket (client -> pty)
      ws.on('message', (rawMessage) => {
        try {
          const message = JSON.parse(rawMessage.toString());

          if (message.type === 'input') {
            ptyProcess.write(message.data);
          } else if (message.type === 'resize') {
            if (message.cols && message.rows) {
              ptyProcess.resize(message.cols, message.rows);
              console.log(`[Main Process] Resized pty ${ptyProcess.pid} to ${message.cols}x${message.rows}`);
            }
          }
        } catch (error) {
          console.error('[Main Process] Failed to parse WebSocket message or handle pty command:', error);
        }
      });

      // Handle WebSocket close
      ws.on('close', () => {
        console.log(`[Main Process] Terminal client WebSocket closed. Killing pty process ${ptyProcess.pid}.`);
        ptyProcess.kill(); // This triggers the onExit handler
        // --- Clear reference if this was the active process ---
        if (activePtyProcess && activePtyProcess.pid === ptyProcess.pid) {
          activePtyProcess = null;
           console.log('[Main Process] Cleared active pty process reference.');
        }
        // --- End clear reference ---
      });

      // Handle WebSocket error
      ws.on('error', (error) => {
        console.error('[Main Process] WebSocket error:', error);
        // Attempt to kill pty if WebSocket errors out
        try {
          ptyProcess.kill();
        } catch (killError) {
          console.error(`[Main Process] Error killing pty ${ptyProcess.pid} after WebSocket error:`, killError);
        }
      });

      // Handle pty exit
      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`[Main Process] Pty process ${ptyProcess.pid} exited with code ${exitCode}, signal ${signal}`);
        // --- Clear reference if this was the active process ---
         if (activePtyProcess && activePtyProcess.pid === ptyProcess.pid) {
          activePtyProcess = null;
           console.log('[Main Process] Cleared active pty process reference on exit.');
        }
        // --- End clear reference ---
        // Close WebSocket if pty process exits unexpectedly
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    });

    wss.on('error', (error) => {
      console.error('[Main Process] WebSocket Server Error:', error);
      // Handle specific errors like EADDRINUSE
      if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        console.error(`[Main Process] Port ${port} is already in use. Terminal server cannot start.`);
        // Optionally notify the user through the UI
      }
    });
  }
  // --- End Terminal Server Method ---
}

// handle setup events as quickly as possible
Main.initialize();

// bootstrap app
Main.bootstrapApp();
Main.bootstrapAppEvents();

// --- Initialize Chokidar File Watcher ---
// NOTE: This initialization might ideally live within the App.main logic
// or be triggered after the main window is created and ready.
// Placing it here for now as a starting point.
// Ensure mainWindow is accessible if defined within App.main
// For now, we assume App.mainWindow holds the reference.

// Define the target directory to watch (replace '.' with your actual project root later)
// const watchPath = '.';
// console.log(`[Main Process] Initializing file watcher for path: ${watchPath}`);

// const watcher = chokidar.watch(watchPath, {
//   ignored: /(^|[/\\])\../, // ignore dotfiles - reverting to original pattern
//   persistent: true,
//   ignoreInitial: true, // Don't send events for files already present
//   depth: 99, // Adjust depth as needed, be mindful of performance on large trees
// });

// const sendFileChange = (eventType: string, filePath: string) => {
//   console.log(`[Main Process] File ${eventType}: ${filePath}`);
//   // Access the main window - THIS IS A GUESS based on common patterns.
//   // You MUST ensure 'App.mainWindow' or equivalent is correctly referenced.
//   const mainWindow = App.mainWindow; // Replace with actual reference if different
//   if (mainWindow && !mainWindow.isDestroyed()) {
//       mainWindow.webContents.send('file-changed', {
//           type: eventType,
//           path: filePath,
//       });
//   } else {
//       console.warn('[Main Process] Main window not available to send file-changed event.');
//   }
// };

// watcher
//   .on('add', (filePath) => sendFileChange('add', filePath))
//   .on('change', (filePath) => sendFileChange('change', filePath))
//   .on('unlink', (filePath) => sendFileChange('unlink', filePath))
//   .on('addDir', (filePath) => sendFileChange('addDir', filePath))
//   .on('unlinkDir', (filePath) => sendFileChange('unlinkDir', filePath))
//   .on('error', (error) => console.error(`[Main Process] Watcher error: ${error}`))
//   .on('ready', () => console.log('[Main Process] File watcher ready.'));

// --- End File Watcher Setup ---

// Ensure graceful shutdown of the watcher (optional but good practice)
app.on('before-quit', () => {
  // watcher.close().then(() => console.log('[Main Process] File watcher closed.')); // Old line
  App.fileWatcher?.close().then(() => console.log('[Main Process] File watcher closed via App class.')); // Updated line
});
