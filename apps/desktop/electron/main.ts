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
      // 1. Core 모듈 및 AI 클라이언트 준비
      const {
        generatePost,
        GeminiClient,
        BLOG_PRESET,
      } = require("@blog-automation/core");

      // 2. 환경 변수에서 API 키 가져오기 (중요: .env 파일 등으로 관리 필요)
      // TODO: API 키를 안전한 방법으로 설정/관리하는 기능 추가 필요
      const apiKey = process.env.GEMINI_API_KEY;
      const modelName = process.env.GEMINI_MODEL_FAST;

      if (!apiKey || !modelName) {
        throw new Error("Gemini API 키 또는 모델 이름이 설정되지 않았습니다.");
      }

      const aiClient = new GeminiClient(apiKey, modelName);

      // 3. 플랫폼 프리셋 적용 (task.platform을 기반으로 동적으로 프리셋을 가져옴)
      const platform = task.platform?.toLowerCase() || "naver";
      const preset = BLOG_PRESET[platform] || BLOG_PRESET["naver"];

      // 4. 포스트 생성
      console.log(`🤖 [${task.topic}] 포스트 생성 시작...`);
      const post = await generatePost({
        client: aiClient,
        input: {
          ...task,
          tone: task.tone || preset.tone,
          textLength: preset.textLength,
          sections: preset.sections,
        },
      });
      console.log(`✅ [${task.topic}] 포스트 생성 완료: ${post.title}`);

      return {
        success: true,
        data: { ...post, category: task.category }, // 발행을 위해 카테고리 정보 추가
      };
    } catch (error: any) {
      console.error(`❌ [${task.topic}] 포스트 생성 오류:`, error);
      return {
        success: false,
        error: error.message || "포스트 생성 중 오류가 발생했습니다.",
      };
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

      // TODO: 네이버 ID/PW를 안전하게 관리하는 기능 필요
      const blogId = process.env.NAVER_BLOG_ID;
      const password = process.env.NAVER_PASSWORD;

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

      console.log(`✅ [${post.title}] 포스트 발행 완료!`);
      return { success: true };
    } catch (error: any) {
      console.error(`❌ [${post.title}] 포스트 발행 오류:`, error);
      return {
        success: false,
        error: error.message || "포스트 발행 중 오류가 발생했습니다.",
      };
    }
  });

  /**
   * 작업 상태 업데이트 요청 핸들러
   */
  ipcMain.handle(
    "update-task-status",
    async (event, { filePath, index, status }) => {
      try {
        const { ExcelProcessor } = require("@blog-automation/core");
        ExcelProcessor.updateTaskStatus(filePath, index, status);
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
