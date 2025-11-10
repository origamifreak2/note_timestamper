const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveSession: (payload) => ipcRenderer.invoke('save-session', payload),
  loadSession: () => ipcRenderer.invoke('load-session'),
  saveHtml:   (payload) => ipcRenderer.invoke('save-html', payload),
  saveHtmlVideo: (payload) => ipcRenderer.invoke('save-html-video', payload),
  pickImage:  () => ipcRenderer.invoke('pick-image')
});
