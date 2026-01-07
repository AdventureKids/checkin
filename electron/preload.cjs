const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Login and sync data
  login: (authData) => ipcRenderer.invoke('login', authData),
  
  // Continue without login (offline mode)
  continueOffline: () => ipcRenderer.invoke('continue-offline'),
  
  // Get current auth state
  getAuth: () => ipcRenderer.invoke('get-auth'),
  
  // Logout
  logout: () => ipcRenderer.invoke('logout'),
  
  // Sync data from cloud
  syncFromCloud: () => ipcRenderer.invoke('sync-from-cloud'),
  
  // Get app info
  getAppInfo: () => ipcRenderer.invoke('get-app-info')
});
