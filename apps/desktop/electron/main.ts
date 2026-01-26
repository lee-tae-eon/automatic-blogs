import { app, BrowserWindow, ipcMain } from "electron";
import Store from "electron-store";
import * as path from "path";
import * as fs from "fs/promises";
import dotenv from "dotenv";

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
    store.set(key, value);
  });

  // 데이터 불러오기
  ipcMain.handle("get-store-data", (event, key) => {
    return store.get(key);
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
      // 1. Core 모듈 및 AI 클라이언트 준비
      const { generatePost, BLOG_PRESET } = require("@blog-automation/core");
      // GeminiClient는 CLI와 동일하게 별도 경로에서 가져옵니다.
      // 'src' 경로는 컴파일된 Node.js 환경에서 인식할 수 없으므로, 패키지의 export 경로를 사용합니다.
      const { GeminiClient } = require("@blog-automation/core/ai");

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

      // 페르소나 매핑 (한글/영어 대응 및 정규화)
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

      // 4. 포스트 생성
      console.log(
        `🤖 [${task.topic}] 포스트 생성 시작... (Persona: ${persona})`,
      );
      const post = await generatePost({
        client: aiClient,
        input: {
          ...task,
          persona, // 정규화된 페르소나로 덮어쓰기
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
