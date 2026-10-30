const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Determine if we are in development mode
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: true,
    show: false,
  });

  // Show window once ready to avoid white flash
  win.once('ready-to-show', () => {
    win.show();
  });

  if (isDev) {
    // In dev mode, load the Vite dev server
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // In production, load the built index.html
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('print', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
      win.webContents.print({ silent: false, printBackground: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('print-to-pdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Save PDF',
        defaultPath: path.join(app.getPath('documents'), 'DTR.pdf'),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });

      if (canceled || !filePath) return { success: false, canceled: true };

      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'Letter',
      });
      fs.writeFileSync(filePath, pdfData);
      return { success: true, filePath };
    } catch (error) {
      console.error('Failed to print to PDF:', error);
      return { success: false, error: error.message };
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
