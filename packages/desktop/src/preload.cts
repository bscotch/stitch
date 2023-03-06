import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  pickDirectory: (options?: {
    buttonLabel?: string;
    message?: string;
    title?: string;
  }) => ipcRenderer.invoke('pickDirectory', options),
  version: () => ipcRenderer.invoke('version'),
  onNotify: (
    callback: (alert: { id: string; kind: string; text: string }) => void,
  ) => {
    ipcRenderer.on('notify', (event, alert) => callback(alert));
  },
});
