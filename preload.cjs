const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveSession: (payload) => ipcRenderer.invoke('save-session', payload),
  loadSession: () => ipcRenderer.invoke('load-session'),
  // Temp media streaming helpers
  createTempMedia: (opts) => ipcRenderer.invoke('create-temp-media', opts),
  appendTempMedia: (id, chunk) => ipcRenderer.invoke('append-temp-media', id, chunk),
  closeTempMedia: (id) => ipcRenderer.invoke('close-temp-media', id),
  saveHtml:   (payload) => ipcRenderer.invoke('save-html', payload),
  saveHtmlVideo: (payload) => ipcRenderer.invoke('save-html-video', payload),
  pickImage:  () => ipcRenderer.invoke('pick-image')
});

contextBridge.exposeInMainWorld('menu', {
  onAction: (callback) => ipcRenderer.on('menu-action', (evt, action) => callback(action)),
  onSaveProgress: (callback) => ipcRenderer.on('save-progress', (evt, progress) => callback(progress)),
  onFileLoadingStart: (callback) => ipcRenderer.on('file-loading-start', () => callback()),
  onFileLoadingComplete: (callback) => ipcRenderer.on('file-loading-complete', () => callback()),
  sendState: (state) => ipcRenderer.send('menu-state', state)
});

// Allow renderer to clear the last opened session directory in main process
contextBridge.exposeInMainWorld('session', {
  clearLastOpenedSession: () => ipcRenderer.invoke('clear-last-session')
});
