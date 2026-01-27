export interface IElectronAPI {
  /**
   * File 객체에서 실제 시스템 경로를 추출합니다.
   * @param file - HTML Input에서 선택된 File 객체
   * @returns 파일의 실제 시스템 경로 (문자열)
   */
  getFilePath: (file: File) => string;

  /**
   * Main 프로세스의 채널을 호출하고 결과를 기다립니다.
   * @param channel - 호출할 채널명 (예: 'parse-excel')
   * @param args - 전달할 인수 목록
   * @returns Promise 형태의 응답 데이터
   */
  invoke: (channel: string, ...args: any[]) => Promise<any>;

  /**
   * Main 프로세스로 비동기 메시지를 보냅니다.
   * @param channel - 채널명
   * @param args - 전달할 인수 목록
   */
  send: (channel: string, ...args: any[]) => void;

  /**
   * Main 프로세스에서 보내는 이벤트를 수신합니다.
   * @param channel - 수신할 채널명
   * @param callback - 이벤트 발생 시 실행할 콜백 함수
   */
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => void;

  /**
   * 이벤트 리스너를 제거합니다.
   * @param channel - 채널명
   * @param callback - 제거할 콜백 함수
   */
  removeListener: (channel: string, callback: Function) => void;
}

declare global {
  interface Window {
    ipcRenderer: IElectronAPI;
  }
}
