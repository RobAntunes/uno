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
    };
  }
}

// Export {} is important to make this file a module
// and ensure the global augmentation works correctly.
export {};
