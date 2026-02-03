"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Renderer 프로세스에서 사용할 API 노출
electron_1.contextBridge.exposeInMainWorld("ipcRenderer", {
    /**
     * File 객체에서 실제 시스템 경로를 추출합니다.
     * @param file - 브라우저의 File 객체
     * @returns 파일의 실제 경로
     */
    getFilePath: (file) => electron_1.webUtils.getPathForFile(file),
    /**
     * Main 프로세스로 IPC 메시지를 보내고 응답을 기다립니다.
     * @param channel - 채널명
     * @param args - 인수 목록
     */
    invoke: (channel, ...args) => {
        const validChannels = [
            "parse-excel",
            "generate-post",
            "publish-post",
            "get-store-data",
            "update-task",
        ];
        if (validChannels.includes(channel)) {
            return electron_1.ipcRenderer.invoke(channel, ...args);
        }
    },
    // 데이터 보내기 (단방향)
    send: (channel, ...args) => electron_1.ipcRenderer.send(channel, ...args),
    /**
     * Main 프로세스에서 오는 이벤트를 수신합니다.
     * @param channel - 채널명
     * @param callback - 콜백 함수
     */
    on: (channel, callback) => {
        const validChannels = ["task-progress", "task-complete"];
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    },
    /**
     * 등록된 이벤트 리스너를 제거합니다.
     * @param channel - 채널명
     * @param callback - 제거할 콜백 함수
     */
    removeListener: (channel, callback) => {
        electron_1.ipcRenderer.removeListener(channel, callback);
    },
});
//# sourceMappingURL=preload.js.map