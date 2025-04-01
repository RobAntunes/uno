import * as dotenv from "dotenv";
import path from 'node:path'; // Use default import for path
import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, dialog } from 'electron';
import { fork, ChildProcess, Serializable } from 'node:child_process';
import { promises as fsPromises } from 'node:fs';
import { WebSocket, WebSocketServer } from "ws";
import * as pty from "node-pty";
import * as os from "os";
// import { fileURLToPath } from 'node:url'; // REMOVE - Unused
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { EventEmitter } from 'node:events'; // Import EventEmitter

// Use path alias now that webpack is configured
import { chunkCode } from './services/indexing/chunker';
import App from "./app/app";
import SquirrelEvents from "./app/events/squirrel.events";
import ElectronEvents from "./app/events/electron.events";
// import { environment } from './environments/environment.js'; // REMOVE - Unused

// Load environment variables from the root directory's .env file first
// Adjust the path relative to the compiled main.js in dist/
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// Load environment variables from apps/uno/.env, potentially overriding root
// Adjust the path relative to the compiled main.js in dist/
dotenv.config({
  path: path.resolve(__dirname, "../../uno/.env"),
  override: true,
});

// Add a check to see if the key is loaded
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "WARN: ANTHROPIC_API_KEY not found after loading .env files. Check paths in main.ts and ensure the key exists.",
  );
} else {
  console.log("INFO: ANTHROPIC_API_KEY loaded successfully.");
}

// --- Define the structure for MCP Server config (matching mcp.json)
// Note: This is simplified; add other fields like transport, url etc. if needed by the handler
interface McpServerConfig {
  description?: string;
  active: boolean;
  command?: string;
  args?: string[];
  transport?: "stdio" | "sse";
  url?: string;
  // Add other potential fields from your mcp.json schema
}

interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

// --- Path to mcp.json (relative to project root, assuming CWD is project root)
const MCP_CONFIG_PATH = path.resolve(process.cwd(), "mcp.json");

// --- IPC Handlers for MCP Config ---

// Handler to read and return the MCP server configuration
ipcMain.handle("get-mcp-servers", async (): Promise<McpConfig> => {
  console.log(`[Main Process] Reading MCP config from: ${MCP_CONFIG_PATH}`);
  try {
    const fileContent = await fsPromises.readFile(MCP_CONFIG_PATH, "utf-8");
    const config = JSON.parse(fileContent) as McpConfig;
    // Basic validation
    if (!config || typeof config.servers !== "object") {
      throw new Error(
        "Invalid MCP configuration format: missing or invalid 'servers' property.",
      );
    }
    console.log("[Main Process] Successfully read and parsed MCP config.");
    return config;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.warn(
        `[Main Process] MCP config file not found at ${MCP_CONFIG_PATH}. Returning default empty structure.`,
      );
      // Return a default empty structure if the file doesn't exist
      return { servers: {} };
    } else {
      console.error(
        "[Main Process] Error reading or parsing MCP config:",
        error,
      );
      throw new Error(
        `Failed to read/parse MCP configuration: ${error.message}`,
      );
    }
  }
});

// Handler to save the updated MCP server configuration
ipcMain.handle(
  "save-mcp-servers",
  async (
    event: IpcMainInvokeEvent,
    updatedConfig: McpConfig,
  ): Promise<void> => {
    console.log(
      `[Main Process] Saving updated MCP config to: ${MCP_CONFIG_PATH}`,
    );
    try {
      // Basic validation of incoming data
      if (!updatedConfig || typeof updatedConfig.servers !== "object") {
        throw new Error("Invalid configuration format provided for saving.");
      }
      const jsonString = JSON.stringify(updatedConfig, null, 2); // Pretty print JSON
      await fsPromises.writeFile(MCP_CONFIG_PATH, jsonString, "utf-8");
      console.log("[Main Process] Successfully saved MCP config.");
    } catch (error: any) {
      console.error("[Main Process] Error saving MCP config:", error);
      throw new Error(`Failed to save MCP configuration: ${error.message}`);
    }
  },
);

// --- End MCP Config IPC Handlers ---

// Handler for reading a file
ipcMain.handle("read-file", async (event, filePath) => {
  try {
    // Resolve path relative to the project root (assuming Electron runs from project root)
    const safePath = path.resolve(process.cwd(), filePath);
    const content = await fsPromises.readFile(safePath, "utf-8");
    return content;
  } catch (error: any) {
    console.error(`[IPC:read-file] Error reading ${filePath}:`, error.message);
    return null; // Indicate failure
  }
});

// Handler for resolving a path
ipcMain.handle("resolve-path", async (event, relativePath) => {
  try {
    // Resolve relative to the project root
    const absolutePath = path.resolve(process.cwd(), relativePath);
    return absolutePath;
  } catch (error: any) {
    console.error(
      `[IPC:resolve-path] Error resolving ${relativePath}:`,
      error.message,
    );
    throw error;
  }
});

// --- Reference to the active terminal process ---
// For simplicity, we assume only one terminal is active at a time.
// This could be extended to a map if multiple sessions are needed.
let activePtyProcess: pty.IPty | null = null;

// --- Function for the tool to call ---
export async function executeCommandInMainPty(
  command: string,
): Promise<string> {
  console.log(
    `[Main Process] Attempting to execute command via tool: ${command}`,
  );
  if (!activePtyProcess) {
    console.error(
      "[Main Process] Cannot execute command: No active pty process.",
    );
    throw new Error("No active terminal session found.");
  }
  try {
    // Add carriage return to simulate pressing Enter
    activePtyProcess.write(command + "\r");
    console.log(
      `[Main Process] Command sent to active pty process ${activePtyProcess.pid}`,
    );
    // Return confirmation. Output streams via WebSocket.
    return `Command sent to terminal.`;
  } catch (error: any) {
    console.error(
      `[Main Process] Error writing to pty process ${activePtyProcess.pid}:`,
      error,
    );
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
ipcMain.handle(
  "read-directory",
  async (
    event: IpcMainInvokeEvent,
    requestedPath: string,
  ): Promise<DirectoryListing> => {
    console.log(
      `[Main Process] Received read-directory request for: ${requestedPath}`,
    );

    // Basic security check: Resolve the path to ensure it's absolute and normalized.
    // Consider adding more robust path validation/sandboxing later based on your app's needs.
    // Resolve relative to app's CWD. Might need adjustment if you want it relative to user data, etc.
    const absolutePath = path.resolve(requestedPath || ".");
    console.log(`[Main Process] Resolved path to: ${absolutePath}`);

    try {
      const entries: FSEntry[] = [];
      const ignoredNames = new Set([".git", "node_modules", "dist"]); // Add folders to ignore here

      const dir = await fsPromises.opendir(absolutePath);
      for await (const dirent of dir) {
        // Potentially filter out hidden files, specific types, etc.
        if (dirent.name.startsWith(".") && dirent.name !== ".") continue; // Keep ignoring hidden, except root itself if requested
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
      console.error(
        `[Main Process] Error reading directory ${absolutePath}:`,
        error,
      );
      // Re-throw the error so the renderer's catch block receives it
      throw new Error(
        `Failed to read directory '${absolutePath}': ${error.message}`,
      );
    }
  },
);
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
import { runAgentInteraction } from "./app/agent";

// Re-enable this handler by removing the block comment
ipcMain.handle(
  "run-agent",
  async (event: IpcMainInvokeEvent, input: string): Promise<string> => {
    console.log(
      `[Main Process] Received run-agent request with input: ${input}`,
    );
    try {
      // We might want to pass a session/thread ID from the frontend later
      const aiResponse = await runAgentInteraction(input);
      // Return the content of the AI's final message
      // We might want to return the full message structure later
      // Ensure this returns a string as expected by app.tsx
      const responseContent = typeof aiResponse.content === "string"
        ? aiResponse.content
        : JSON.stringify(aiResponse.content);
      return responseContent;
    } catch (error: any) {
      console.error("[Main Process] Error running agent interaction:", error);
      // Re-throw or return a formatted error message to the renderer
      // Return error message as string to the UI
      return `Error: Agent execution failed: ${error.message}`;
    }
  },
);
// --- End Agent IPC Handler ---

// --- ADDED: IPC Handlers for Indexing ---

// --- Helper: Initialize vector store in main process ---
export async function initializeMainVectorStore() {
    // Now just sends a message to the service
    console.log('[Main Process] Requesting service initialization...');
    sendToIndexingService({ type: 'initialize' });
}

// Counter for outstanding chunk requests
let inFlightChunkCount = 0;
// Event emitter for backpressure signaling
const backpressureEmitter = new EventEmitter();
// Concurrency limit for indexing chunks
const MAX_CONCURRENT_CHUNKS = 3; // Reduced from 10

// Add indexing handler
ipcMain.handle('start-indexing', async (event) => {
  const sender = event.sender;
  
  try {
    // Check if the vector store itself is initialized, not just the process
    if (!vectorStoreInitialized) {
      throw new Error('Indexing service has not finished initializing the vector store. Please wait and try again.');
    }

    // Signal start of indexing
    sender.send('indexing-start');
    
    // Get the workspace directory (assuming it's the project root)
    const workspaceDir = process.cwd();
    
    // Process files using the indexing service directly
    const ignoredDirs = new Set(['node_modules', '.git', '.angular', '.cache', '.idea', '.nx', '.vscode', 'dist', 'out', '.lancedb']);
    let filesScanned = 0;
    let chunksSent = 0;

    // Helper function to wait if concurrency limit is reached
    async function waitForSlot() {
        if (inFlightChunkCount < MAX_CONCURRENT_CHUNKS) {
            return; // Slot available, no need to wait
        }
        
        console.log(`[Main Process] waitForSlot: Limit (${MAX_CONCURRENT_CHUNKS}) reached. Count: ${inFlightChunkCount}. Waiting...`);
        await new Promise<void>(resolve => backpressureEmitter.once('slotFreed', resolve));
        console.log(`[Main Process] waitForSlot: Slot freed event received! Count is now ${inFlightChunkCount}. Continuing...`);
    }

    async function scanDirectory(dirPath: string) {
      try {
        const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            if (!ignoredDirs.has(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            const allowedExts = new Set([
              // JavaScript/TypeScript
              '.ts', '.js', '.tsx', '.jsx', '.mjs', '.cjs',
              // Web
              '.html', '.htm', '.css', '.scss', '.sass', '.less', '.svg',
              // Config files
              '.json', '.yaml', '.yml', '.xml', '.env',
              // Documentation
              '.md', '.mdx',
              // Templates
              '.ejs', '.hbs', '.pug', '.vue', '.svelte',
              // GraphQL
              '.graphql', '.gql',
              // Web Assembly
              '.wasm',
              // Package files
              'package.json', 'tsconfig.json', 'webpack.config.js', 'rollup.config.js', 'vite.config.js'
            ]);

            if (allowedExts.has(ext) || allowedExts.has(entry.name)) {
              filesScanned++;
              try {
                const content = await fsPromises.readFile(fullPath, 'utf-8');
                const chunks = chunkCode(fullPath, content);
                sender.send('indexing-progress', {
                  filePath: fullPath,
                  progress: 50
                });

                for (const chunk of chunks) {
                  await waitForSlot(); // Wait for an available slot
                  inFlightChunkCount++; // Increment before sending
                  chunksSent++;
                  
                  sendToIndexingService({ type: 'addChunk', payload: chunk });
                }
              } catch (fileError: any) {
                sender.send('indexing-error', {
                  filePath: fullPath,
                  error: fileError?.message || 'Unknown file processing error'
                });
              }
            }
          }
        }
      } catch (dirError: any) {
        sender.send('indexing-error', {
          filePath: dirPath,
          error: dirError?.message || 'Unknown directory processing error'
        });
      }
    }

    await scanDirectory(workspaceDir);
    // Send overall completion signal ONLY after scanDirectory finishes
    console.log(`[Main Process] Indexing finished. Files scanned: ${filesScanned}, Chunks sent: ${chunksSent}`);
    sender.send('indexing-finished', { 
        success: true, 
        filesScanned, 
        chunksSent 
    });
    return { success: true, filesScanned, chunksSent };
    
  } catch (error: any) {
    // Send overall completion signal with error status
    console.error(`[Main Process] Indexing failed with error: ${error?.message}`);
    sender.send('indexing-finished', { 
        success: false, 
        error: error?.message || 'Unknown error during indexing' 
    });
    // Re-throw or return error for the ipcMain.handle promise
    return { success: false, message: error?.message || 'Unknown error during indexing' };
  }
});

// Modified Handler to get the combined index status - Now triggers getMainIndexStatus
ipcMain.handle('get-index-status', async () => {
    console.log("[Main Process] Received 'get-index-status' request.");
    if (!indexingServiceReady) {
        return { itemCount: 0, status: 'disconnected' };
    }
    sendToIndexingService({ type: 'getStatus' });
    // Status will be sent back asynchronously via 'index-status-result' event
    return { message: "Status request sent" };
});

// --- END Indexing Handlers ---

// --- ADDED: Indexing Service Management ---
let indexingServiceProcess: ChildProcess | null = null;
let indexingServiceReady = false; // Indicates if the service process is running and responsive
let vectorStoreInitialized = false; // Indicates if the vector store inside the service is successfully initialized

export function launchIndexingService() {
  if (indexingServiceProcess) {
    console.log('[Main Process] Indexing service already launched.');
    return;
  }
  console.log('[Main Process] Launching indexing service using child_process.fork...');

  // Path to the compiled service script
  const indexingServicePath = path.join(__dirname, 'services/indexing/service.js');
  console.log(`[Main Process] Attempting to fork service script at: ${indexingServicePath}`);

  try {
    indexingServiceProcess = fork(indexingServicePath, [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'], // Ensure IPC channel is piped
        // execPath: process.execPath, // Might be needed? Try without first.
    });
    indexingServiceReady = false; // Reset ready state
    vectorStoreInitialized = false; // Reset initialized state

    if (!indexingServiceProcess || typeof indexingServiceProcess.pid === 'undefined') {
        throw new Error('Failed to fork child process (PID undefined).');
    }

    console.log(`[Main Process] Forked indexing service process (PID: ${indexingServiceProcess.pid})`);

    // Optional: Log stdout/stderr from the service for debugging
    indexingServiceProcess.stdout?.on('data', (data) => {
        console.log(`[Indexing Service STDOUT] ${data.toString().trim()}`);
    });
    indexingServiceProcess.stderr?.on('data', (data) => {
        console.error(`[Indexing Service STDERR] ${data.toString().trim()}`);
    });

    // Setup message handling (API is slightly different for ChildProcess vs UtilityProcess)
    setupServiceMessageHandling(indexingServiceProcess);

    indexingServiceProcess.on('exit', (code, signal) => { // Exit handler has signal arg
      console.error(`[Main Process] Indexing service exited with code: ${code}, signal: ${signal}`);
      indexingServiceProcess = null;
      indexingServiceReady = false;
      vectorStoreInitialized = false; // Reset on exit
      App.mainWindow?.webContents.send('indexing-service-status', { status: 'crashed', error: `Exited with code ${code}, signal ${signal}` });
    });

    indexingServiceProcess.on('error', (err) => { // Add specific error handler for fork issues
        console.error('[Main Process] Indexing service process error:', err);
        indexingServiceProcess = null;
        indexingServiceReady = false;
        vectorStoreInitialized = false; // Reset on error
        App.mainWindow?.webContents.send('indexing-service-status', { status: 'error', error: `Process error: ${err.message}` });
    });

  } catch (error) {
      console.error('[Main Process] Failed to fork indexing service:', error);
      indexingServiceProcess = null;
      indexingServiceReady = false;
      vectorStoreInitialized = false; // Reset on fork failure
      App.mainWindow?.webContents.send('indexing-service-status', { status: 'error', error: `Failed to fork: ${error}` });
  }
}

function setupServiceMessageHandling(processInstance: ChildProcess) {
    processInstance.on('message', (message: Serializable) => {
        // Basic type check first
        if (typeof message !== 'object' || message === null || !('type' in message)) {
            console.warn('[Main Process] Received malformed message from service:', message);
            return;
        }
        // Now it's safe to access type
        console.log('[Main Process] Received message from indexing service:', message.type);
        
        const msg = message as { type: string; payload?: any }; // Type assertion after check

        switch (msg.type) {
            case 'ready':
                console.log('[Main Process] Indexing service process reported ready.');
                indexingServiceReady = true;
                vectorStoreInitialized = false; // Explicitly false until confirmed by 'initialized'
                // Send initialize command now that the service process is ready
                sendToIndexingService({ type: 'initialize' }); 
                break;
            case 'initialized':
                console.log('[Main Process] Indexing service initialization result:', msg.payload);
                if (msg.payload?.success) {
                    vectorStoreInitialized = true; // Set to true on successful initialization
                    App.mainWindow?.webContents.send('indexing-service-status', { 
                        status: 'initialized' 
                    });
                } else {
                    vectorStoreInitialized = false; // Set to false on failed initialization
                    console.error('[Main Process] Initialization failed:', msg.payload?.error);
                    App.mainWindow?.webContents.send('indexing-service-status', { 
                        status: 'error',
                        error: msg.payload?.error || 'Failed to initialize indexing service'
                    });
                }
                break;
            case 'addChunkResult':
                console.log('[Main Process] Add chunk result:', msg.payload);
                if (msg.payload?.chunkId) {
                     const былInFlightCount = inFlightChunkCount; // Store previous value for check
                     inFlightChunkCount = Math.max(0, inFlightChunkCount - 1); // Decrement count
                     
                     // If count was at the limit before decrementing, signal that a slot is now free
                     if (былInFlightCount >= MAX_CONCURRENT_CHUNKS) {
                         console.log(`[Main Process] addChunkResult: Emitting slotFreed. Previous count: ${былInFlightCount}, New count: ${inFlightChunkCount}`);
                         backpressureEmitter.emit('slotFreed');
                     }
                }
                 // Handle success/failure 
                break;
            case 'statusResult':
                 console.log('[Main Process] Indexing status result:', msg.payload);
                 // Forward status to renderer or handle here
                 App.mainWindow?.webContents.send('index-status-result', msg.payload); // Use App.mainWindow
                 break;
            case 'serviceError':
                 console.error('[Main Process] Received error from indexing service:', msg.payload);
                 // Handle service errors (e.g., notify user, attempt restart?)
                 break;
            default:
                console.warn('[Main Process] Received unknown message type from service:', msg.type);
        }
    });
}

function sendToIndexingService(message: any) {
    if (!indexingServiceProcess) {
        console.error('[Main Process] Cannot send message: Indexing service not running.');
        return false; 
    }
    
    // Only enforce ready check for addChunk messages
    if (message.type === 'addChunk' && !indexingServiceReady) {
        console.error('[Main Process] Cannot add chunks: Service not ready.');
        return false;
    }
    
    try {
        console.log('[Main Process] Sending message to service:', message?.type);
        const success = indexingServiceProcess.send(message);
        if (!success) {
             console.error('[Main Process] Failed to send message to indexing service (channel closed?).');
             return false;
        }
        return true;
    } catch (error) {
        console.error('[Main Process] Failed to send message to indexing service:', error);
        return false;
    }
}
// --- END Indexing Service Management ---

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
    console.log(
      `[Main Process] Terminal WebSocket Server listening on port ${port}`,
    );

    wss.on("connection", (ws) => {
      console.log("[Main Process] Terminal client connected via WebSocket");

      // Spawn pty process
      const shellPath = os.platform() === "win32"
        ? "powershell.exe"
        : (process.env.SHELL || "bash");
      const ptyProcess = pty.spawn(shellPath, [], {
        name: "xterm-color", // Corresponds to xterm.js terminal type
        cols: 80, // Default size, will be updated on resize event
        rows: 30,
        cwd: process.env.HOME, // Start in user's home directory
        env: process.env, // Use current environment variables
      });

      console.log(
        `[Main Process] Spawned pty process with PID: ${ptyProcess.pid}`,
      );

      // --- Store reference to the active process ---
      if (activePtyProcess) {
        // Kill previous pty if a new connection is made (simple single-session handling)
        console.warn(
          `[Main Process] Killing previous pty process ${activePtyProcess.pid} due to new connection.`,
        );
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
          console.error(
            "[Main Process] Error sending data over WebSocket:",
            err,
          );
        }
      });

      // Handle messages from WebSocket (client -> pty)
      ws.on("message", (rawMessage) => {
        try {
          const message = JSON.parse(rawMessage.toString());

          if (message.type === "input") {
            ptyProcess.write(message.data);
          } else if (message.type === "resize") {
            if (message.cols && message.rows) {
              ptyProcess.resize(message.cols, message.rows);
              console.log(
                `[Main Process] Resized pty ${ptyProcess.pid} to ${message.cols}x${message.rows}`,
              );
            }
          }
        } catch (error) {
          console.error(
            "[Main Process] Failed to parse WebSocket message or handle pty command:",
            error,
          );
        }
      });

      // Handle WebSocket close
      ws.on("close", () => {
        console.log(
          `[Main Process] Terminal client WebSocket closed. Killing pty process ${ptyProcess.pid}.`,
        );
        ptyProcess.kill(); // This triggers the onExit handler
        // --- Clear reference if this was the active process ---
        if (activePtyProcess && activePtyProcess.pid === ptyProcess.pid) {
          activePtyProcess = null;
          console.log("[Main Process] Cleared active pty process reference.");
        }
        // --- End clear reference ---
      });

      // Handle WebSocket error
      ws.on("error", (error) => {
        console.error("[Main Process] WebSocket error:", error);
        // Attempt to kill pty if WebSocket errors out
        try {
          ptyProcess.kill();
        } catch (killError) {
          console.error(
            `[Main Process] Error killing pty ${ptyProcess.pid} after WebSocket error:`,
            killError,
          );
        }
      });

      // Handle pty exit
      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(
          `[Main Process] Pty process ${ptyProcess.pid} exited with code ${exitCode}, signal ${signal}`,
        );
        // --- Clear reference if this was the active process ---
        if (activePtyProcess && activePtyProcess.pid === ptyProcess.pid) {
          activePtyProcess = null;
          console.log(
            "[Main Process] Cleared active pty process reference on exit.",
          );
        }
        // --- End clear reference ---
        // Close WebSocket if pty process exits unexpectedly
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    });

    wss.on("error", (error) => {
      console.error("[Main Process] WebSocket Server Error:", error);
      // Handle specific errors like EADDRINUSE
      if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
        console.error(
          `[Main Process] Port ${port} is already in use. Terminal server cannot start.`,
        );
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
app.on("before-quit", () => {
  // watcher.close().then(() => console.log('[Main Process] File watcher closed.')); // Old line
  App.fileWatcher?.close().then(() =>
    console.log("[Main Process] File watcher closed via App class.")
  ); // Updated line
});

// === IPC Handlers ===

// Simple handler to open directory dialog
ipcMain.handle('open-directory-dialog', async () => {
    if (!App.mainWindow) { // Add null check
         console.error("Cannot open directory dialog: main window not available.");
         return undefined;
    }
    const result = await dialog.showOpenDialog(App.mainWindow, { // Now safe
        properties: ['openDirectory']
    });
    return result.filePaths[0]; // Return selected path or undefined
});

// Handler to initialize vector store (now primarily sends message to service)
ipcMain.handle('initialize-vector-store', async () => {
    console.log("[Main Process] Received 'initialize-vector-store' request.");
    if (!indexingServiceProcess || !indexingServiceReady) {
         console.warn("[Main Process] Cannot initialize: Indexing service not ready.");
         return { success: false, message: "Indexing service not ready." };
    }
    sendToIndexingService({ type: 'initialize' });
    // We don't wait here, service will send 'initialized' message back
    return { success: true, message: "Initialization request sent to service." };
});
