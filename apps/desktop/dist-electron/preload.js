"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Renderer 프로세스(React)에 ipcRenderer 기능 노출
electron_1.contextBridge.exposeInMainWorld("ipcRenderer", {
    invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
});
//# sourceMappingURL=preload.js.map