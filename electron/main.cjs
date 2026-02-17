/**
 * ChurchCheck Electron App - Thin Client
 * 
 * This is a thin client that:
 * - Connects to the cloud API for all data
 * - Handles local Dymo label printing
 * - Caches auth for offline login screen
 * 
 * No local database or server required!
 */

const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep references to prevent garbage collection
let mainWindow = null;
let loginWindow = null;
let authData = null;

const isDev = process.env.NODE_ENV === 'development';

// Cloud API URL - your Render deployment
const API_URL = process.env.API_URL || 'https://churchcheck-api.onrender.com';

// ============================================
// AUTH STORAGE
// ============================================

function getAuthPath() {
  return path.join(app.getPath('userData'), 'auth.json');
}

function loadSavedAuth() {
  try {
    const authPath = getAuthPath();
    if (fs.existsSync(authPath)) {
      const data = fs.readFileSync(authPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load saved auth:', err);
  }
  return null;
}

function saveAuth(data) {
  try {
    const authPath = getAuthPath();
    fs.writeFileSync(authPath, JSON.stringify(data, null, 2));
    console.log('Auth saved to:', authPath);
  } catch (err) {
    console.error('Failed to save auth:', err);
  }
}

function clearAuth() {
  try {
    const authPath = getAuthPath();
    if (fs.existsSync(authPath)) {
      fs.unlinkSync(authPath);
    }
    authData = null;
  } catch (err) {
    console.error('Failed to clear auth:', err);
  }
}

// ============================================
// WINDOW MANAGEMENT
// ============================================

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 500,
    height: 700,
    resizable: false,
    title: 'ChurchCheck - Login',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    show: false,
    backgroundColor: '#1a1a2e'
  });

  loginWindow.loadFile(path.join(__dirname, 'login.html'));

  loginWindow.once('ready-to-show', () => {
    loginWindow.show();
  });

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: authData?.orgName ? `${authData.orgName} - ChurchCheck` : 'ChurchCheck',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true
    },
    show: false,
    backgroundColor: '#1a1a2e'
  });

  // Build URL with auth token for the cloud-hosted app
  const orgParam = authData?.orgId ? `?org_id=${authData.orgId}` : '';
  
  if (isDev) {
    // In dev mode, load the local Vite dev server
    mainWindow.loadURL(`http://localhost:5173${orgParam}`);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the cloud API
    mainWindow.loadURL(`${API_URL}${orgParam}`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'ChurchCheck',
      submenu: [
        { label: 'About', click: showAbout },
        { type: 'separator' },
        { 
          label: 'Switch Organization', 
          click: () => {
            clearAuth();
            if (mainWindow) {
              mainWindow.close();
            }
            createLoginWindow();
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Admin Dashboard',
          click: () => {
            if (mainWindow) {
              const orgParam = authData?.orgId ? `?org_id=${authData.orgId}` : '';
              if (isDev) {
                mainWindow.loadURL(`http://localhost:5173/admin${orgParam}`);
              } else {
                mainWindow.loadURL(`${API_URL}/admin${orgParam}`);
              }
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Printer Settings',
          click: showPrinterSettings
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template[0].submenu = [
      { label: 'About ChurchCheck', click: showAbout },
      { type: 'separator' },
      { 
        label: 'Switch Organization', 
        click: () => {
          clearAuth();
          if (mainWindow) {
            mainWindow.close();
          }
          createLoginWindow();
        }
      },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function showAbout() {
  const orgInfo = authData?.orgName ? `\nOrganization: ${authData.orgName}` : '';
  dialog.showMessageBox(mainWindow || loginWindow, {
    type: 'info',
    title: 'About ChurchCheck',
    message: 'ChurchCheck',
    detail: `Version: ${app.getVersion()}${orgInfo}\n\nKids check-in that makes them want to come back.\n\nConnected to: ${API_URL}\n\n© ${new Date().getFullYear()} ChurchCheck`
  });
}

function showPrinterSettings() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Printer Settings',
    message: 'Dymo Label Printer',
    detail: 'Make sure your Dymo LabelWriter is connected and the Dymo Web Service is running.\n\nThe app will automatically detect available Dymo printers.'
  });
}

// ============================================
// IPC HANDLERS
// ============================================

ipcMain.handle('login', async (event, data) => {
  console.log('Login received:', data.orgName);
  authData = data;
  saveAuth(data);
  
  // Close login window and open main window
  if (loginWindow) {
    loginWindow.close();
  }
  
  createMainWindow();
  return { success: true };
});

ipcMain.handle('continue-offline', async () => {
  console.log('Continuing offline - not supported in cloud mode');
  dialog.showMessageBox(loginWindow, {
    type: 'warning',
    title: 'Internet Required',
    message: 'ChurchCheck requires an internet connection to access your data.',
    detail: 'Please check your internet connection and try again.'
  });
  return { success: false };
});

ipcMain.handle('get-auth', async () => {
  return authData;
});

ipcMain.handle('logout', async () => {
  clearAuth();
  return { success: true };
});

ipcMain.handle('get-app-info', async () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    orgName: authData?.orgName,
    apiUrl: API_URL
  };
});

ipcMain.handle('get-api-url', async () => {
  return API_URL;
});

// ============================================
// PRINTING (Local Dymo via Web Service)
// ============================================

// The actual printing is handled by the React app via the Dymo Web Service
// These handlers are for future local print queue management

ipcMain.handle('print-label', async (event, labelData) => {
  console.log('Print request received:', labelData);
  // Printing is handled by the React app via Dymo Web Service
  // This is a placeholder for future local print queue
  return { success: true };
});

ipcMain.handle('get-printers', async () => {
  // Dymo printers are detected by the web service
  // This returns a placeholder - actual detection is in the React app
  return [];
});

// ============================================
// TOKEN VERIFICATION
// ============================================

async function verifyToken(token) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${API_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok;
  } catch (err) {
    console.error('Token verification failed:', err);
    return false;
  }
}

// ============================================
// APP LIFECYCLE
// ============================================

app.whenReady().then(async () => {
  console.log('ChurchCheck Electron App Starting...');
  console.log('API URL:', API_URL);
  console.log('isDev:', isDev);
  
  // Check for saved auth
  authData = loadSavedAuth();
  
  if (authData?.token) {
    console.log('Found saved auth for:', authData.orgName);
    
    // Verify token is still valid
    const isValid = await verifyToken(authData.token);
    
    if (isValid) {
      console.log('Token valid, opening main window');
      createMainWindow();
    } else {
      console.log('Token expired, showing login');
      clearAuth();
      createLoginWindow();
    }
  } else {
    console.log('No saved auth, showing login');
    createLoginWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (authData?.token) {
      createMainWindow();
    } else {
      createLoginWindow();
    }
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
