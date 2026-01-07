const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Keep references to prevent garbage collection
let mainWindow = null;
let loginWindow = null;
let server = null;
let authData = null;

const isDev = process.env.NODE_ENV === 'development';
const PORT = 3001;
const API_URL = 'https://churchcheck-api.onrender.com';

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
// DATABASE & ASSETS SETUP
// ============================================

function ensureDatabase() {
  const userDataPath = app.getPath('userData');
  const userDbPath = path.join(userDataPath, 'kidcheck.db');
  
  if (isDev) {
    return path.join(__dirname, '..', 'kidcheck.db');
  }
  
  if (!fs.existsSync(userDbPath)) {
    const bundledDbPath = path.join(process.resourcesPath, 'server', 'kidcheck.db');
    console.log('Copying database from:', bundledDbPath);
    console.log('To:', userDbPath);
    
    if (fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, userDbPath);
      console.log('Database copied successfully');
    } else {
      console.log('No bundled database found, will create new one');
    }
  } else {
    console.log('Using existing database at:', userDbPath);
  }
  
  return userDbPath;
}

function ensurePublicAssets() {
  const userDataPath = app.getPath('userData');
  const userPublicPath = path.join(userDataPath, 'public');
  
  if (isDev) {
    return path.join(__dirname, '..', 'public');
  }
  
  // Copy public assets if they don't exist
  if (!fs.existsSync(userPublicPath)) {
    const bundledPublicPath = path.join(process.resourcesPath, 'server', 'public');
    console.log('Copying public assets from:', bundledPublicPath);
    
    if (fs.existsSync(bundledPublicPath)) {
      fs.cpSync(bundledPublicPath, userPublicPath, { recursive: true });
      console.log('Public assets copied successfully');
    }
  }
  
  return userPublicPath;
}

// ============================================
// SERVER MANAGEMENT
// ============================================

function startServer() {
  return new Promise((resolve, reject) => {
    try {
      // Set up environment before requiring the server
      const dbPath = ensureDatabase();
      const publicPath = ensurePublicAssets();
      
      const serverDir = isDev 
        ? path.join(__dirname, '..')
        : path.join(process.resourcesPath, 'server');
      
      const distPath = isDev
        ? path.join(__dirname, '..', 'dist')
        : path.join(process.resourcesPath, 'app.asar', 'dist');
      
      // Set environment variables BEFORE requiring print-server
      process.env.PORT = PORT.toString();
      process.env.NODE_ENV = 'production';
      process.env.DB_PATH = dbPath;
      process.env.PUBLIC_PATH = publicPath;
      process.env.DIST_PATH = distPath;
      process.env.DISABLE_PRINTING = 'false';
      
      console.log('Server configuration:');
      console.log('  DB_PATH:', dbPath);
      console.log('  PUBLIC_PATH:', publicPath);
      console.log('  DIST_PATH:', distPath);
      console.log('  Server dir:', serverDir);
      
      // Change to server directory for relative requires
      process.chdir(serverDir);
      
      // Now require the print-server which will use the env vars
      const serverPath = isDev 
        ? path.join(__dirname, '..', 'print-server.cjs')
        : path.join(process.resourcesPath, 'server', 'print-server.cjs');
      
      console.log('Loading server from:', serverPath);
      
      // The print-server.cjs starts listening when required
      require(serverPath);
      
      // Give server time to start
      setTimeout(() => {
        console.log('Server should be running on port', PORT);
        resolve();
      }, 2000);
      
    } catch (err) {
      console.error('Failed to start server:', err);
      reject(err);
    }
  });
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

  // Add org_id to URL if authenticated
  const orgParam = authData?.orgId ? `?org_id=${authData.orgId}` : '';
  
  if (isDev) {
    mainWindow.loadURL(`http://localhost:5173${orgParam}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://localhost:${PORT}${orgParam}`);
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
              mainWindow.loadURL(`http://localhost:${PORT}/admin${orgParam}`);
            }
          }
        },
        {
          label: 'Sync Data from Cloud',
          click: async () => {
            if (authData?.token) {
              await syncFromCloud();
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Not Logged In',
                message: 'Please log in to sync data from the cloud.'
              });
            }
          }
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
    detail: `Version: ${app.getVersion()}${orgInfo}\n\nKids check-in that makes them want to come back.\n\n© ${new Date().getFullYear()} ChurchCheck`
  });
}

// ============================================
// CLOUD SYNC
// ============================================

async function syncFromCloud() {
  if (!authData?.token) {
    console.log('No auth token, cannot sync');
    return false;
  }
  
  try {
    console.log('Syncing data from cloud...');
    
    // For now, we'll just verify the token is still valid
    // Full sync would download families, children, etc. from the cloud
    // and merge with local database
    
    const response = await fetch(`${API_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${authData.token}` }
    });
    
    if (!response.ok) {
      console.log('Token expired, need to re-login');
      return false;
    }
    
    console.log('Sync complete');
    return true;
  } catch (err) {
    console.error('Sync error:', err);
    return false;
  }
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
  console.log('Continuing offline');
  authData = null;
  
  // Close login window and open main window without auth
  if (loginWindow) {
    loginWindow.close();
  }
  
  createMainWindow();
  return { success: true };
});

ipcMain.handle('get-auth', async () => {
  return authData;
});

ipcMain.handle('logout', async () => {
  clearAuth();
  return { success: true };
});

ipcMain.handle('sync-from-cloud', async () => {
  return await syncFromCloud();
});

ipcMain.handle('get-app-info', async () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    orgName: authData?.orgName,
    isOffline: !authData?.token
  };
});

// ============================================
// APP LIFECYCLE
// ============================================

app.whenReady().then(async () => {
  console.log('App ready, starting server...');
  console.log('isDev:', isDev);
  console.log('resourcesPath:', process.resourcesPath);
  
  try {
    await startServer();
    console.log('Server started');
    
    // Check for saved auth
    authData = loadSavedAuth();
    
    if (authData?.token) {
      console.log('Found saved auth for:', authData.orgName);
      // Verify token is still valid
      const isValid = await syncFromCloud();
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
    
  } catch (err) {
    console.error('Failed to start:', err);
    dialog.showErrorBox('Startup Error', `Failed to start the application: ${err.message}`);
    app.quit();
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
