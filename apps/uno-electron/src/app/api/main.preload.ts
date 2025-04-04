import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Define the type for the MCP config to be used in preload/renderer
interface McpServerConfig {
  description?: string;
  active: boolean;
  // Add other fields if the renderer needs them directly, otherwise keep minimal
}
interface McpConfig {
  servers: Record<string, McpServerConfig>;
}

// Define type for paths object returned by IPC
interface TsConfigPaths { [key: string]: string[] }

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  readDirectory: (path: string) => ipcRenderer.invoke('read-directory', path),
  readFile: (path: string): Promise<string | null> => ipcRenderer.invoke('read-file', path),
  resolvePath: (relativePath: string): Promise<string> => ipcRenderer.invoke('resolve-path', relativePath),
  
  // Add function to get tsconfig paths
  getTsConfigPaths: (projectRoot: string): Promise<TsConfigPaths | null> => ipcRenderer.invoke('get-tsconfig-paths', projectRoot),

  onFileChanged: (callback: (event: IpcRendererEvent, data: { type: string; path: string }) => void) =>
    ipcRenderer.on('file-changed', callback),
  removeFileChangedListener: (callback: (event: IpcRendererEvent, data: { type: string; path: string }) => void) =>
    ipcRenderer.removeListener('file-changed', callback),

  // --- Add MCP Handlers ---
  getMcpServers: (): Promise<McpConfig> => ipcRenderer.invoke('get-mcp-servers'),
  saveMcpServers: (updatedConfig: McpConfig): Promise<void> => ipcRenderer.invoke('save-mcp-servers', updatedConfig),
  // --- End MCP Handlers ---

  // Indexing methods
  startIndexing: () => ipcRenderer.invoke('start-indexing'),
  
  // Indexing events
  onIndexingStart: (callback: () => void) => 
    ipcRenderer.on('indexing-start', () => callback()),
  onIndexingProgress: (callback: (data: { filePath: string; progress: number }) => void) =>
    ipcRenderer.on('indexing-progress', (_, data) => callback(data)),
  onIndexingComplete: (callback: (data: { filePath: string }) => void) =>
    ipcRenderer.on('indexing-complete', (_, data) => callback(data)),
  onIndexingError: (callback: (data: { filePath: string; error: string }) => void) =>
    ipcRenderer.on('indexing-error', (_, data) => callback(data)),
    
  removeIndexingStartListener: (callback: () => void) =>
    ipcRenderer.removeListener('indexing-start', () => callback()),
  removeIndexingProgressListener: (callback: (data: { filePath: string; progress: number }) => void) =>
    ipcRenderer.removeListener('indexing-progress', (_, data) => callback(data)),
  removeIndexingCompleteListener: (callback: (data: { filePath: string }) => void) =>
    ipcRenderer.removeListener('indexing-complete', (_, data) => callback(data)),
  removeIndexingErrorListener: (callback: (data: { filePath: string; error: string }) => void) =>
    ipcRenderer.removeListener('indexing-error', (_, data) => callback(data)),

  ipcInvoke: (channel: string, ...args: any[]) => {
    const allowedChannels = [
      'run-agent',
      'read-directory',
      'read-file',
      'resolve-path',
      'get-app-version',
      'get-mcp-servers',
      'save-mcp-servers',
      'start-indexing' // Add the new channel
    ];
    if (allowedChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.error(`[Preload] Blocked invoke to unallowed channel: ${channel}`);
    return Promise.reject(new Error(`Access denied to IPC channel: ${channel}`));
  }
});
