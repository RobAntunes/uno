// This tells TypeScript that the 'electron' object exposed by preload.ts
// exists on the global Window object and defines its shape.

// Define the types for the data structures used in IPC
interface FSEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface DirectoryListing {
  path: string;
  entries: FSEntry[];
}

// Define the shape of the data passed by the 'file-changed' event
interface FileChangeData {
    type: string; // e.g., 'add', 'change', 'unlink', 'addDir', 'unlinkDir'
    path: string;
}

// Define TsConfigPaths type (should match preload and main)
interface TsConfigPaths { [key: string]: string[] }

// Augment the global Window interface
declare global {
  interface Window {
    // This should match the key used in contextBridge.exposeInMainWorld
    electron: {
      // Function exposed for reading directories
      readDirectory: (path: string) => Promise<DirectoryListing>;

      // Functions exposed for handling file change events
      onFileChanged: (callback: (event: Electron.IpcRendererEvent, data: FileChangeData) => void) => void;
      removeFileChangedListener: (callback: (event: Electron.IpcRendererEvent, data: FileChangeData) => void) => void;

      // Add other functions exposed via contextBridge here if any
      getAppVersion: () => Promise<string>; // Assuming this returns a promise
      platform: string;

      // Added based on main.preload.ts update
      ipcInvoke: (channel: string, ...args: any[]) => Promise<any>;

      // --- ADDED --- 
      readFile: (path: string) => Promise<string | null>;
      resolvePath: (relativePath: string) => Promise<string>; 
      // --- END ADDED ---

      // Indexing methods
      startIndexing: () => Promise<void>;
      
      // Indexing events
      onIndexingStart: (callback: () => void) => void;
      onIndexingProgress: (callback: (data: { filePath: string; progress: number }) => void) => void;
      onIndexingComplete: (callback: (data: { filePath: string }) => void) => void;
      onIndexingError: (callback: (data: { filePath: string; error: string }) => void) => void;
      
      removeIndexingStartListener: (callback: () => void) => void;
      removeIndexingProgressListener: (callback: (data: { filePath: string; progress: number }) => void) => void;
      removeIndexingCompleteListener: (callback: (data: { filePath: string }) => void) => void;
      removeIndexingErrorListener: (callback: (data: { filePath: string; error: string }) => void) => void;

      // Add MCP Handlers types if needed
      getMcpServers: () => Promise<any>; // Use specific type if available
      saveMcpServers: (updatedConfig: any) => Promise<void>; // Use specific type if available

      // Add the new function signature
      getTsConfigPaths: (projectRoot: string) => Promise<TsConfigPaths | null>;
    };
  }
}

// Export {} is important to make this file a module
// and ensure the global augmentation works correctly.
export {};
