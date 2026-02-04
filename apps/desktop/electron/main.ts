import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import dotenv from "dotenv";
import Store from "electron-store";

// 환경 변수 로드
if (app.isPackaged) {
  // 빌드된 상태 (Production)
  // 앱의 리소스 폴더나 실행 파일 위치를 기준으로 설정합니다.
  dotenv.config({ path: path.join(process.resourcesPath, ".env") });
} else {
  // 개발 모드 (Development)
  // 기존처럼 모노레포 루트의 .env를 참조합니다.
  dotenv.config({ path: path.join(__dirname, "../../../.env") });
}

// 스토어 초기화
const store = new Store();

let mainWindow: BrowserWindow | null = null;

/**
 * 메인 윈도우를 생성하고 설정을 초기화합니다.
 */
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
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
  // 데이터 저장 (아이디, 비번 등)
  ipcMain.on("set-store-data", (event, key, value) => {
    console.log(`💾 저장 요청: ${key}`, value);
    store.set(key, value);
  });

  // 데이터 불러오기
  ipcMain.handle("get-store-data", (event, key) => {
    const data = store.get(key);
    console.log(`📂 불러오기 요청: ${key}`, data); // undefined인지 확인
    return data;
  });

  store.delete("user-credentials.groqKey");
  store.delete("user-credentials.sub-gemini");
  /**
   * 엑셀 파일 파싱 요청 핸들러
   * @param event - IPC 이벤트 객체
   * @param filePath - 파싱할 엑셀 파일의 경로
   */
  ipcMain.handle("parse-excel", async (event, filePath: string) => {
    try {
      await fs.access(filePath);
      const { ExcelProcessor } = require("@blog-automation/core");
      const result = await ExcelProcessor.readTasks(filePath);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * 블로그 포스트 생성 요청 핸들러
   * @param event - IPC 이벤트 객체
   * @param task - 생성할 포스트의 작업 정보
   */
  ipcMain.handle("generate-post", async (event, task) => {
    try {
      const { generatePost } = require("@blog-automation/core");
      const { GeminiClient } = require("@blog-automation/core/ai");

      const store = new Store();
      const credentials: any = store.get("user-credentials");
      const { geminiKey, subGemini } = credentials || {};

      let publication;
      let lastError;

      const apiKeys = [geminiKey, subGemini, process.env.GEMINI_API_KEY].filter(
        (k) => !!k,
      );

      // 2. 키 배열을 순회 (이게 진짜 스위칭!)
      for (const apiKey of apiKeys) {
        try {
          console.log(`🔑 현재 사용 중인 키: ${apiKey.slice(0, 8)}***`);

          const geminiClient = new GeminiClient(
            apiKey,
            process.env.VITE_GEMINI_MODEL_NORMAL,
          );

          publication = await generatePost({
            client: geminiClient,
            task: task,
          });

          if (publication) break; // ✅ 성공하면 루프 종료 (다음 키 안 씀)
        } catch (error: any) {
          lastError = error;
          // 3. 429(Quota Exceeded) 에러일 때만 다음 키로 스위칭
          if (
            error.message.includes("429") ||
            error.message.includes("limit")
          ) {
            console.warn("⚠️ 메인 키 한도 초과! 서브 키로 전환합니다...");
            continue; // ✅ 다음 apiKey로 이동
          }
          // 429가 아닌 다른 에러(인증 실패 등)는 즉시 중단
          throw error;
        }
      }
      if (!publication)
        throw lastError || new Error("모든 AI 모델 호출에 실패했습니다.");

      console.log(`✅ [${task.topic}] 포스트 생성 성공: ${publication.title}`);
      return { success: true, data: publication };
    } catch (error: any) {
      console.error("❌ 포스트 생성 에러:", error.message);
      return { success: false, error: error.message };
    }
  });

  /**
   * 블로그 포스트 발행 요청 핸들러
   * @param event - IPC 이벤트 객체
   * @param post - 발행할 포스트 데이터 (카테고리 포함)
   */
  ipcMain.handle("publish-post", async (event, post) => {
    try {
      const {
        NaverPublisher,
        markdownToHtml,
      } = require("@blog-automation/core");

      // 1. 우선 사용자가 UI에서 입력한 정보를 Store에서 가져옵니다.
      const credentials: any = store.get("user-credentials");

      // 2. 우선순위: 사용자가 입력한 값(Store) -> 없으면 개발자 설정(.env)
      const blogId = credentials?.naverId || process.env.NAVER_BLOG_ID;
      const password = credentials?.naverPw || process.env.NAVER_PASSWORD;

      if (!blogId) throw new Error("네이버 블로그 ID가 설정되지 않았습니다.");

      const htmlContent = await markdownToHtml(post.content);
      const publisher = new NaverPublisher();

      await publisher.postToBlog({
        blogId,
        password,
        title: post.title,
        htmlContent,
        tags: post.tags || post.focusKeywords || [],
        category: post.category,
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /**
   * 작업 상태 업데이트 요청 핸들러
   */
  ipcMain.handle(
    "update-task",
    async (event, { filePath, index, status, persona, tone }) => {
      try {
        const { ExcelProcessor } = require("@blog-automation/core");
        ExcelProcessor.updateTaskInExcel(filePath, index, {
          status,
          persona,
          tone,
        });
        return { success: true };
      } catch (error: any) {
        console.error("❌ 상태 업데이트 오류:", error);
        return { success: false, error: error.message };
      }
    },
  );
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
