"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Renderer 프로세스에서 사용할 API 노출
electron_1.contextBridge.exposeInMainWorld("ipcRenderer", {
    // Excel 파일 파싱
    invoke: (channel, ...args) => {
        const validChannels = ["parse-excel", "generate-post", "publish-post"];
        if (validChannels.includes(channel)) {
            return electron_1.ipcRenderer.invoke(channel, ...args);
        }
    },
    // 이벤트 수신 (진행 상황 업데이트 등)
    on: (channel, callback) => {
        const validChannels = ["task-progress", "task-complete"];
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    },
    // 이벤트 리스너 제거
    removeListener: (channel, callback) => {
        electron_1.ipcRenderer.removeListener(channel, callback);
    },
});
//# sourceMappingURL=preload.js.map