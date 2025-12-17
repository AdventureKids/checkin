// Preload script for Electron
// This runs in the renderer process but has access to Node.js APIs
// We use contextBridge to safely expose APIs to the renderer

const { contextBridge } = require('electron');

// Expose protected methods that allow the renderer process to use
// specific Electron/Node.js features without exposing the entire API
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true
});

