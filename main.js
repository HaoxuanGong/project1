/**
 * Electron Main Process
 * Manages the application window lifecycle and spawns the multiplayer server.
 */
const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;

const SERVER_PORT = 3000;
const DEFAULT_WINDOW = {
  width: 1280,
  height: 800,
  minWidth: 960,
  minHeight: 600,
};
const COMPANION_WINDOW = {
  width: 420,
  height: 320,
  margin: 24,
};

function startServer() {
  const serverPath = path.join(__dirname, 'server.js');
  serverProcess = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(SERVER_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[server] ${data.toString().trim()}`);
  });
  serverProcess.stderr.on('data', (data) => {
    console.error(`[server-err] ${data.toString().trim()}`);
  });
  serverProcess.on('exit', (code) => {
    console.log(`[server] exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW.width,
    height: DEFAULT_WINDOW.height,
    minWidth: DEFAULT_WINDOW.minWidth,
    minHeight: DEFAULT_WINDOW.minHeight,
    title: 'Office Buddy',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setWindowMode(mode = 'office') {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const companionMode = mode === 'companion';
  mainWindow.setAlwaysOnTop(companionMode, companionMode ? 'screen-saver' : 'normal');
  mainWindow.setSkipTaskbar(companionMode);
  mainWindow.setVisibleOnAllWorkspaces(companionMode);
  mainWindow.setResizable(!companionMode);

  if (companionMode) {
    const { workArea } = screen.getPrimaryDisplay();
    const x = Math.round(workArea.x + workArea.width - COMPANION_WINDOW.width - COMPANION_WINDOW.margin);
    const y = Math.round(workArea.y + workArea.height - COMPANION_WINDOW.height - COMPANION_WINDOW.margin);
    mainWindow.setMinimumSize(COMPANION_WINDOW.width, COMPANION_WINDOW.height);
    mainWindow.setBounds({
      x,
      y,
      width: COMPANION_WINDOW.width,
      height: COMPANION_WINDOW.height,
    }, true);
  } else {
    mainWindow.setMinimumSize(DEFAULT_WINDOW.minWidth, DEFAULT_WINDOW.minHeight);
    mainWindow.setSize(DEFAULT_WINDOW.width, DEFAULT_WINDOW.height);
    mainWindow.center();
  }
}

app.whenReady().then(() => {
  startServer();
  // Give server a moment to bind before the renderer tries to connect
  setTimeout(createWindow, 500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

// IPC: renderer asks for the server URL
ipcMain.handle('get-server-url', () => `http://localhost:${SERVER_PORT}`);
ipcMain.handle('set-window-mode', (_event, mode) => {
  setWindowMode(mode);
});
