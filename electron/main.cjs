const { app, BrowserWindow, Menu, Tray, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Keep references to prevent garbage collection
let mainWindow = null;
let tray = null;
let serverProcess = null;

const isDev = process.env.NODE_ENV === 'development';
const PORT = 3001;

// ============================================
// SERVER MANAGEMENT
// ============================================

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = isDev 
      ? path.join(__dirname, '..', 'print-server.cjs')
      : path.join(process.resourcesPath, 'server', 'print-server.cjs');
    
    console.log('Starting server from:', serverPath);
    
    // Set environment variables for the server
    const env = {
      ...process.env,
      PORT: PORT.toString(),
      NODE_ENV: 'production',
      DISABLE_PRINTING: 'false' // Enable printing in desktop app
    };
    
    serverProcess = spawn('node', [serverPath], {
      env,
      cwd: isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'server'),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
      if (data.toString().includes('Server running')) {
        resolve();
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });
    
    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      reject(err);
    });
    
    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      serverProcess = null;
    });
    
    // Give the server a moment to start
    setTimeout(resolve, 2000);
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('Stopping server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
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
    show: false, // Don't show until ready
    backgroundColor: '#1a1a2e'
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the built files served by Express
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Adventure Kids',
      submenu: [
        { label: 'About', click: showAbout },
        { type: 'separator' },
        { label: 'Check for Updates...', click: checkForUpdates },
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
        },
        { type: 'separator' },
        {
          label: 'View Logs',
          click: () => {
            const logPath = app.getPath('logs');
            shell.openPath(logPath);
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template[0].submenu = [
      { label: 'About Adventure Kids Check-In', click: showAbout },
      { type: 'separator' },
      { label: 'Check for Updates...', click: checkForUpdates },
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

function checkForUpdates() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Updates',
    message: 'You\'re up to date!',
    detail: 'You have the latest version of Adventure Kids Check-In.'
  });
}

// ============================================
// SYSTEM TRAY (optional - for background running)
// ============================================

function createTray() {
  const iconPath = path.join(__dirname, 'icons', 'tray-icon.png');
  
  try {
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Check-In', click: () => mainWindow?.show() },
      { label: 'Open Admin', click: () => {
        if (mainWindow) {
          mainWindow.loadURL(`http://localhost:${PORT}/admin`);
          mainWindow.show();
        }
      }},
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]);
    
    tray.setToolTip('Adventure Kids Check-In');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
      mainWindow?.show();
    });
  } catch (err) {
    console.log('Tray icon not available:', err.message);
  }
}

// ============================================
// APP LIFECYCLE
// ============================================

app.whenReady().then(async () => {
  console.log('App ready, starting server...');
  
  try {
    await startServer();
    console.log('Server started, creating window...');
    createWindow();
    // createTray(); // Uncomment if you want system tray support
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

app.on('before-quit', () => {
  stopServer();
});

app.on('quit', () => {
  stopServer();
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  stopServer();
});

