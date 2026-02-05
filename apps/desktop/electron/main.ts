import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import dotenv from "dotenv";
import Store from "electron-store";

// ✅ Core 패키지 정적 Import (안정성 및 번들링 최적화)
// SQLite가 없어도 Core 인터페이스만 맞다면 에러가 나지 않습니다.
import {
  generatePost,
  ExcelProcessor,
  NaverPublisher,
  markdownToHtml,
  GeminiClient,
} from "@blog-automation/core";
// import { GeminiClient } from "@blog-automation/core/ai";

// ==========================================
// 1. 환경 변수 설정
// ==========================================
const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

if (app.isPackaged) {
  // 빌드된 상태 (Production): 리소스 폴더 내 .env 참조
  dotenv.config({ path: path.join(process.resourcesPath, ".env") });
} else {
  // 개발 모드 (Development): 모노레포 루트 .env 참조
  dotenv.config({ path: path.join(__dirname, "../../../.env") });
}

// ==========================================
// 2. 스토어 초기화
// ==========================================
const store = new Store();

// 🚨 주의: 아래 코드는 사용자 데이터를 날려버리므로 절대 복구하지 마세요.
// store.delete("user-credentials.groqKey");
// store.delete("user-credentials.sub-gemini");

let mainWindow: BrowserWindow | null = null;

// ==========================================
// 3. 윈도우 생성 함수
// ==========================================
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools(); // 개발자 도구 자동 오픈
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

// ==========================================
// 4. IPC 핸들러 등록
// ==========================================
let currentPublisher: NaverPublisher | null = null;
let globalAbortController: AbortController | null = null;

/**
 * 작업을 중단 가능하게 감싸는 래퍼 함수
 */
async function runWithAbort<T>(
  operation: () => Promise<T>,
  controller: AbortController,
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) => {
      // 이미 중단된 경우 즉시 에러
      if (controller.signal.aborted) {
        return reject(new Error("AbortError"));
      }
      // 중단 이벤트 리스너 등록
      controller.signal.addEventListener("abort", () => {
        reject(new Error("AbortError"));
      });
    }),
  ]);
}

function registerIpcHandlers() {
  // ----------------------------------------
  // [Abort] 프로세스 중단
  // ----------------------------------------
  ipcMain.on("abort-process", async () => {
    console.log("🛑 중단 요청 수신: 작업 강제 종료 시도");
    
    // 1. 대기 중인 Promise 강제 reject
    if (globalAbortController) {
      globalAbortController.abort();
    }

    // 2. Playwright 브라우저 물리적 종료
    if (currentPublisher) {
      await currentPublisher.stop();
      currentPublisher = null;
    }
  });

  // ----------------------------------------
  // [Store] 데이터 저장/로드
  // ----------------------------------------
  ipcMain.on("set-store-data", (event, key, value) => {
    store.set(key, value);
  });

  ipcMain.handle("get-store-data", (event, key) => {
    return store.get(key);
  });

  // ----------------------------------------
  // [Excel] 엑셀 파일 파싱
  // ----------------------------------------
  ipcMain.handle("parse-excel", async (event, filePath: string) => {
    try {
      await fs.access(filePath); // 파일 존재 여부 확인
      const result = await ExcelProcessor.readTasks(filePath);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ----------------------------------------
  // [AI] 블로그 포스트 생성 (핵심 로직)
  // ----------------------------------------
  ipcMain.handle("generate-post", async (event, task) => {
    // 새로운 작업 시작 시 컨트롤러 초기화
    globalAbortController = new AbortController();
    
    try {
      return await runWithAbort(async () => {
        const credentials: any = store.get("user-credentials");
        const { geminiKey, subGemini } = credentials || {};
        const userDataPath = app.getPath("userData");

        // 1. 키 배열 생성
        const apiKeys = [geminiKey, subGemini, process.env.GEMINI_API_KEY].filter(
          (k) => !!k && k.trim() !== "",
        );

        if (apiKeys.length === 0) {
          throw new Error("사용 가능한 Gemini API Key가 없습니다.");
        }

        let publication;
        let lastError;

        // 2. 키 순환 로직
        for (const apiKey of apiKeys) {
          try {
            // 중단 체크
            if (globalAbortController?.signal.aborted) throw new Error("AbortError");

            console.log(`🔑 Key 사용 시도: ${apiKey.slice(0, 5)}...`);
            const modelName = process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-1.5-flash";
            const geminiClient = new GeminiClient(apiKey, modelName);

            publication = await generatePost({
              client: geminiClient,
              task: task,
              projectRoot: userDataPath,
              onProgress: (message) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send("process-log", message);
                }
              },
            });

            if (publication) break;
          } catch (error: any) {
            if (error.message === "AbortError") throw error; // 중단은 즉시 전파
            
            lastError = error;
            const errorMsg = error.message || "";
            if (errorMsg.includes("429") || errorMsg.includes("limit")) {
              console.warn("⚠️ 할당량 초과! 다음 API 키로 전환합니다...");
              continue;
            }
            throw error;
          }
        }

        if (!publication) {
          throw lastError || new Error("모든 AI 모델 호출에 실패했습니다.");
        }

        console.log(`✅ [${task.topic}] 생성 완료`);
        return { success: true, data: publication };
      }, globalAbortController);

    } catch (error: any) {
      if (error.message === "AbortError") {
        console.log("⚠️ 생성 작업이 사용자에 의해 중단되었습니다.");
        return { success: false, error: "AbortError" };
      }
      console.error("❌ 포스트 생성 에러:", error);
      return { success: false, error: error.message };
    } finally {
      globalAbortController = null;
    }
  });

  // ----------------------------------------
  // [Naver] 블로그 발행
  // ----------------------------------------
  ipcMain.handle("publish-post", async (event, post) => {
    globalAbortController = new AbortController();

    try {
      return await runWithAbort(async () => {
        const credentials: any = store.get("user-credentials");
        const blogId = credentials?.naverId || process.env.NAVER_BLOG_ID;
        const password = credentials?.naverPw || process.env.NAVER_PASSWORD;

        if (!blogId || !password) {
          throw new Error("네이버 계정 정보가 없습니다.");
        }

        const htmlContent = await markdownToHtml(post.content);
        const userDataPath = app.getPath("userData");
        currentPublisher = new NaverPublisher(userDataPath);

        await currentPublisher.postToBlog({
          blogId,
          password,
          title: post.title,
          htmlContent,
          tags: post.tags || post.focusKeywords || [],
          category: post.category,
          references: post.references,
          headless: post.headless, // UI에서 전달받은 headless 옵션 적용
          onProgress: (message) => {
            event.sender.send("process-log", message);
          },
        });

        return { success: true };
      }, globalAbortController);

    } catch (error: any) {
      if (error.message === "AbortError") {
         console.log("⚠️ 발행 작업이 사용자에 의해 중단되었습니다.");
         return { success: false, error: "AbortError" };
      }
      console.error("❌ 발행 실패:", error);
      return { success: false, error: error.message };
    } finally {
      currentPublisher = null;
      globalAbortController = null;
    }
  });

  // ----------------------------------------
  // [Excel] 작업 상태 업데이트
  // ----------------------------------------
  ipcMain.handle(
    "update-task",
    async (event, { filePath, index, status, persona, tone }) => {
      try {
        await ExcelProcessor.updateTaskInExcel(filePath, index, {
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

// ==========================================
// 5. 앱 생명주기
// ==========================================
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
