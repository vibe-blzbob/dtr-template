const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  print: () => ipcRenderer.invoke('print'),
  printToPDF: () => ipcRenderer.invoke('print-to-pdf')
});
