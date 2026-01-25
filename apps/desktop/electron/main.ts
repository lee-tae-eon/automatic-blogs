import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs/promises";

let mainWindow: BrowserWindow | null = null;

/**
 * 메인 윈도우를 생성하고 설정을 초기화합니다.
 */
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // ✅ Preload 스크립트 추가
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // 개발 환경
  if (process.env.NODE_ENV !== "production") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

/**
 * IPC(Inter-Process Communication) 핸들러를 등록합니다.
 * Renderer 프로세스에서 오는 요청을 처리합니다.
 */
function registerIpcHandlers() {
  /**
   * 엑셀 파일 파싱 요청 핸들러
   * @param event - IPC 이벤트 객체
   * @param filePath - 파싱할 엑셀 파일의 경로
   */
  ipcMain.handle("parse-excel", async (event, filePath: string) => {
    try {
      console.log("📁 파일 경로:", filePath);

      // 파일 존재 확인
      await fs.access(filePath);

      // Core 패키지의 Excel 파서 사용
      const { ExcelProcessor } = require("@blog-automation/core");
      const result = await ExcelProcessor.readTasks(filePath);

      return { success: true, data: result };
    } catch (error: any) {
      console.error("❌ 파일 파싱 오류:", error);
      return {
        success: false,
        error: error.message || "파일 파싱 중 오류가 발생했습니다.",
      };
    }
  });

  /**
   * 블로그 포스트 생성 요청 핸들러
   * @param event - IPC 이벤트 객체
   * @param task - 생성할 포스트의 작업 정보
   */
  ipcMain.handle("generate-post", async (event, task) => {
    try {
      // const { generatePost } = require('@blog-automation/core');
      // const result = await generatePost(task);

      // 임시 응답
      return {
        success: true,
        data: { title: "생성된 포스트", content: "..." },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * 블로그 포스트 발행 요청 핸들러
   * @param event - IPC 이벤트 객체
   * @param post - 발행할 포스트 데이터
   */
  ipcMain.handle("publish-post", async (event, post) => {
    try {
      // 발행 로직
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
