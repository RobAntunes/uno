import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// specific electron APIs without exposing the entire API
contextBridge.exposeInMainWorld('electron', {
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
  },
  // Add other API methods here
});
