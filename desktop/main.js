const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');

const APP_URL = 'https://lumen.chemcraze.asia/?source=desktop';
const APP_ORIGIN = 'https://lumen.chemcraze.asia';
let mainWindow = null;

function isAppUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function openExternal(url) {
  try {
    const parsed = new URL(url);
    if (['https:', 'http:'].includes(parsed.protocol)) shell.openExternal(url);
  } catch {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 600,
    title: 'LUMEN ATLAS',
    backgroundColor: '#030811',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(APP_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: 'allow' };
    openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  mainWindow.webContents.on('did-fail-load', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const retry = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(APP_URL);
    }, 2500);
    mainWindow.once('closed', () => clearTimeout(retry));
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['geolocation', 'media', 'notifications', 'clipboard-read', 'clipboard-write'].includes(permission));
  });
  mainWindow.webContents.session.setPermissionCheckHandler((_wc, permission) => (
    ['geolocation', 'media', 'notifications', 'clipboard-read', 'clipboard-write'].includes(permission)
  ));

  mainWindow.on('closed', () => { mainWindow = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('asia.chemcraze.lumen');
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: 'LUMEN ATLAS',
        submenu: [
          { label: '重新加载', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
          { label: '在浏览器中打开', click: () => shell.openExternal(APP_ORIGIN) },
          { type: 'separator' },
          { role: 'quit', label: '退出' },
        ],
      },
      {
        label: '编辑',
        submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }],
      },
    ]));
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
