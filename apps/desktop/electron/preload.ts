import { contextBridge, ipcRenderer, webUtils } from "electron";

// Renderer 프로세스에서 사용할 API 노출
const listeners = new Map<string, Map<Function, (event: any, ...args: any[]) => void>>();

contextBridge.exposeInMainWorld("ipcRenderer", {
  /**
   * File 객체에서 실제 시스템 경로를 추출합니다.
   * @param file - 브라우저의 File 객체
   * @returns 파일의 실제 경로
   */
  getFilePath: (file: File) => webUtils.getPathForFile(file),

  /**
   * Main 프로세스로 IPC 메시지를 보내고 응답을 기다립니다.
   * @param channel - 채널명
   * @param args - 인수 목록
   */
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      "parse-excel",
      "generate-post",
      "publish-post",
      "get-store-data",
      "update-task",
      "fetch-hollywood-trends",
      "fetch-korea-trends",
      "run-autopilot",
      "fetch-keyword-candidates",
      "run-autopilot-step2",
      "fetch-recommended-topics",
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
  },

  // 데이터 보내기 (단방향)
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),

  /**
   * Main 프로세스에서 오는 이벤트를 수신합니다.
   * @param channel - 채널명
   * @param callback - 콜백 함수
   */
  on: (channel: string, callback: Function) => {
    const validChannels = ["task-progress", "task-complete", "process-log"];
    if (validChannels.includes(channel)) {
      const wrapper = (event: any, ...args: any[]) => callback(...args);
      
      if (!listeners.has(channel)) {
        listeners.set(channel, new Map());
      }
      listeners.get(channel)!.set(callback, wrapper);
      
      ipcRenderer.on(channel, wrapper);
    }
  },

  /**
   * 등록된 이벤트 리스너를 제거합니다.
   * @param channel - 채널명
   * @param callback - 제거할 콜백 함수
   */
  removeListener: (channel: string, callback: Function) => {
    const channelListeners = listeners.get(channel);
    if (channelListeners) {
      const wrapper = channelListeners.get(callback);
      if (wrapper) {
        ipcRenderer.removeListener(channel, wrapper);
        channelListeners.delete(callback);
      }
    }
  },
});
