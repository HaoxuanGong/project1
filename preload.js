/**
 * Electron Preload Script
 * Safely exposes a minimal API from the main process to the renderer.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  setWindowMode: (mode) => ipcRenderer.invoke('set-window-mode', mode),
});
