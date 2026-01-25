import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";

// 개발 환경 여부 (패키징되지 않았으면 개발 환경으로 간주)
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // preload 스크립트 로드 (컴파일된 JS 파일 경로 지정 필요)
      // 보통 빌드 설정에 따라 __dirname 주변에 위치합니다.
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    // Vite 개발 서버 URL (기본 포트 5173, 필요시 수정)
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    // 프로덕션 빌드 결과물 로드
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  // IPC 핸들러: React 앱에서 보낸 'parse-excel' 요청 처리
  ipcMain.handle("parse-excel", async (event, filePath: string) => {
    console.log("📂 엑셀 파일 파싱 요청:", filePath);

    // TODO: 실제 엑셀 파싱 로직 구현 (xlsx 라이브러리 등 사용)
    // 연결 테스트를 위한 더미 데이터 반환
    return {
      success: true,
      data: [
        {
          topic: "Electron 연결 성공",
          persona: "테스트 봇",
          category: "테스트",
          keywords: "IPC, Electron",
          status: "ready",
        },
      ],
    };
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
