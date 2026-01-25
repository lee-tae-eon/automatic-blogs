import { contextBridge, ipcRenderer } from "electron";

// Renderer 프로세스(React)에 ipcRenderer 기능 노출
contextBridge.exposeInMainWorld("ipcRenderer", {
  invoke: (channel: string, ...args: any[]) =>
    ipcRenderer.invoke(channel, ...args),
});
