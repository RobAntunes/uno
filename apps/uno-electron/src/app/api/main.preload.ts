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

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  readDirectory: (path: string) => ipcRenderer.invoke('read-directory', path),
  readFile: (path: string): Promise<string | null> => ipcRenderer.invoke('read-file', path),
  resolvePath: (relativePath: string): Promise<string> => ipcRenderer.invoke('resolve-path', relativePath),
  onFileChanged: (callback: (event: IpcRendererEvent, data: { type: string; path: string }) => void) =>
    ipcRenderer.on('file-changed', callback),
  removeFileChangedListener: (callback: (event: IpcRendererEvent, data: { type: string; path: string }) => void) =>
    ipcRenderer.removeListener('file-changed', callback),

  // --- Add MCP Handlers ---
  getMcpServers: (): Promise<McpConfig> => ipcRenderer.invoke('get-mcp-servers'),
  saveMcpServers: (updatedConfig: McpConfig): Promise<void> => ipcRenderer.invoke('save-mcp-servers', updatedConfig),
  // --- End MCP Handlers ---

  ipcInvoke: (channel: string, ...args: any[]) => {
    // Update allowed channels list - RE-ADD 'run-agent'
    const allowedChannels = [
      'run-agent', // <-- RE-ADDED
      'read-directory',
      'read-file',
      'resolve-path',
      'get-app-version',
      'get-mcp-servers', // Allow getting MCP config
      'save-mcp-servers' // Allow saving MCP config
    ];
    if (allowedChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.error(`[Preload] Blocked invoke to unallowed channel: ${channel}`);
    return Promise.reject(new Error(`Access denied to IPC channel: ${channel}`));
  }
});
