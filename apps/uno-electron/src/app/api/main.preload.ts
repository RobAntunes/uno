import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  readDirectory: (path: string) => ipcRenderer.invoke('read-directory', path),
  onFileChanged: (callback: (event: IpcRendererEvent, data: { type: string; path: string }) => void) =>
    ipcRenderer.on('file-changed', callback),
  removeFileChangedListener: (callback: (event: IpcRendererEvent, data: { type: string; path: string }) => void) =>
    ipcRenderer.removeListener('file-changed', callback),
});
