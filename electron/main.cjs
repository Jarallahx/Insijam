/* ---------------------------------------------------------------------------
   Insijam — Electron shell. A quiet window around the game: no menu bar,
   sensible minimum size, F11 fullscreen, and nothing else in the way.
--------------------------------------------------------------------------- */

const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const DEV_URL = process.env.INSIJAM_DEV_URL || '';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Insijam — انسجام',
    backgroundColor: '#14172e',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.removeMenu();
  // F11 is handled in the renderer through the HTML5 fullscreen API, so the
  // in-game settings row and the shortcut always agree on the state.

  // any external link opens in the system browser, never in the game window
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => win.show());

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
