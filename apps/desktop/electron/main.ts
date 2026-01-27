import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import dotenv from "dotenv";
import Store from "electron-store";

// 환경 변수 로드
// Monorepo Root의 .env 파일을 찾아 로드합니다. (빌드된 dist-electron/main.js 기준 상위 경로)
dotenv.config({ path: path.join(__dirname, "../../../.env") });
dotenv.config(); // 혹시 apps/desktop/.env 에 있을 경우를 대비해 기본 경로도 시도

// 스토어 초기화
const store = new Store();

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
      // 1. 필요한 모듈 불러오기 (GroqClient 추가)
      const { generatePost, BLOG_PRESET } = require("@blog-automation/core");
      const { GeminiClient, GroqClient } = require("@blog-automation/core/ai");

      const store = new Store();
      const credentials: any = store.get("user-credentials");
      const { geminiKey, groqKey } = credentials || {};

      // 2. 플랫폼 프리셋 및 페르소나 정규화 (기존 로직 유지)
      const platform = task.platform?.toLowerCase() || "naver";
      const preset = BLOG_PRESET[platform] || BLOG_PRESET["naver"];

      let persona = task.persona?.toLowerCase() || "informative";
      if (
        ["정보성", "정보", "info", "informative"].some((k) =>
          persona.includes(k),
        )
      ) {
        persona = "informative";
      } else if (
        ["공감형", "공감", "empathy", "empathetic"].some((k) =>
          persona.includes(k),
        )
      ) {
        persona = "empathetic";
      }

      const inputParams = {
        ...task,
        persona,
        tone: task.tone || preset.tone,
        textLength: preset.textLength,
        sections: preset.sections,
      };

      let post;
      let lastError;

      // 3. 전략 선택: GroqKey가 있으면 Groq을 먼저 시도
      if (groqKey) {
        try {
          console.log(`🚀 [${task.topic}] Groq(Llama 3) 엔진으로 생성 시도...`);
          const groqClient = new GroqClient(groqKey);
          post = await generatePost({
            client: groqClient,
            input: inputParams,
          });
        } catch (error: any) {
          console.error(
            "⚠️ Groq 생성 실패, Gemini로 전환을 시도합니다:",
            error.message,
          );
          lastError = error;
        }
      }

      // 4. Groq이 없거나 실패했을 때 Gemini 루프 실행
      if (!post) {
        const apiKey = geminiKey || process.env.GEMINI_API_KEY;
        const models = [
          process.env.GEMINI_MODEL_FAST,
          process.env.GEMINI_MODEL_NORMAL,
          process.env.GEMINI_MODEL_OLD_FAST,
        ].filter((m): m is string => !!m);

        if (!apiKey)
          throw new Error(
            "사용 가능한 AI API 키가 없습니다. (Groq 또는 Gemini)",
          );

        for (const modelName of models) {
          try {
            console.log(`🤖 [${task.topic}] Gemini 모델 시도: ${modelName}`);
            const geminiClient = new GeminiClient(apiKey, modelName);
            post = await generatePost({
              client: geminiClient,
              input: inputParams,
            });
            break;
          } catch (error: any) {
            lastError = error;
            if (
              error.message.includes("429") ||
              error.message.includes("limit")
            ) {
              continue;
            }
            throw error;
          }
        }
      }

      if (!post)
        throw lastError || new Error("모든 AI 모델 호출에 실패했습니다.");

      console.log(`✅ [${task.topic}] 포스트 생성 성공: ${post.title}`);
      return { success: true, data: { ...post, category: task.category } };
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
