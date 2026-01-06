const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Keep references to prevent garbage collection
let mainWindow = null;
let server = null;

const isDev = process.env.NODE_ENV === 'development';
const PORT = 3001;

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Adventure Kids Check-In',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    show: false,
    backgroundColor: '#1a1a2e'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://localhost:${PORT}`);
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
      label: 'Adventure Kids',
      submenu: [
        { label: 'About', click: showAbout },
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
              mainWindow.loadURL(`http://localhost:${PORT}/admin`);
            }
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template[0].submenu = [
      { label: 'About Adventure Kids Check-In', click: showAbout },
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
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Adventure Kids Check-In',
    message: 'Adventure Kids Check-In',
    detail: `Version: ${app.getVersion()}\n\nA fun and engaging check-in system for children's ministry.\n\n© ${new Date().getFullYear()} Adventure Kids`
  });
}

// ============================================
// APP LIFECYCLE
// ============================================

app.whenReady().then(async () => {
  console.log('App ready, starting server...');
  console.log('isDev:', isDev);
  console.log('resourcesPath:', process.resourcesPath);
  
  try {
    await startServer();
    console.log('Server started, creating window...');
    createWindow();
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
    createWindow();
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
