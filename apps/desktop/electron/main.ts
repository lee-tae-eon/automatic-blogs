import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs/promises";
import dotenv from "dotenv";
import Store from "electron-store";

// ==========================================
// 1. 환경 변수 및 브라우저 경로 설정 (CRITICAL - Import 전에 설정 권장)
// ==========================================
const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

// ✅ .env 로드 경로 최적화 (절대 경로 사용)
const rootPath = path.join(__dirname, "../../..");
const envPath = isDev
  ? path.join(rootPath, ".env")
  : path.join(process.resourcesPath, ".env");

dotenv.config({ path: envPath });

console.log(`🌍 Environment loaded from: ${envPath}`);
console.log(
  `🤖 Default Model: ${process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-2.5-flash"}`,
);

if (app.isPackaged) {
  // 빌드된 상태 (Production)
  // Playwright 브라우저 경로를 앱 내부 리소스로 강제 지정
  const bundledBrowserPath = path.join(process.resourcesPath, "ms-playwright");
  process.env.PLAYWRIGHT_BROWSERS_PATH = bundledBrowserPath;
  console.log(`🌍 Playwright Browser Path set to: ${bundledBrowserPath}`);
}

// ✅ Core 패키지 Import (환경 변수 설정 이후)
import {
  generatePost,
  ExcelProcessor,
  NaverPublisher,
  TistoryPublisher,
  markdownToHtml,
  GeminiClient,
  TavilyService,
  runAutoPilot,
  TopicExpanderService,
  KeywordScoutService,
  TopicRecommendationService, // 추가
  RssService,
} from "@blog-automation/core";

// ==========================================
// 2. 스토어 초기화
// ==========================================
const store = new Store();

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
  // [Discovery] 추천 토픽 가져오기 (New v3.0)
  // ----------------------------------------
  ipcMain.handle("fetch-recommended-topics", async (event, category: any) => {
    const credentials: any = store.get("user-credentials");
    const { geminiKey, subGemini, thirdGemini } = credentials || {};

    const apiKeys = [
      geminiKey,
      subGemini,
      thirdGemini,
      process.env.VITE_GEMINI_API_KEY,
    ].filter((k) => !!k && k.trim() !== "");

    if (apiKeys.length === 0) return { success: false, error: "Gemini API Key가 없습니다." };

    let lastError: any;
    const modelVersions = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

    for (const [idx, apiKey] of apiKeys.entries()) {
      for (const modelName of modelVersions) {
        try {
          const client = new GeminiClient(apiKey, modelName);
          const service = new TopicRecommendationService(client);

          const logMsg = `🔍 [추천 시스템] 키 #${idx + 1} (${modelName}) 시도 중...`;
          if (mainWindow) mainWindow.webContents.send("process-log", logMsg);

          const data = await service.getRecommendationsByCategory(category);
          return { success: true, data };
        } catch (error: any) {
          lastError = error;
          const errorMsg = String(error.message || error);
          
          if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("limit")) {
            const warnMsg = `⚠️ [추천 시스템] 키 #${idx + 1} (${modelName}) 할당량 초과. 다음 모델/키 시도...`;
            console.warn(warnMsg);
            if (mainWindow) mainWindow.webContents.send("process-log", warnMsg);
            continue; // 다음 모델 시도 (안에서)
          }
          break; // 429 외의 에러는 해당 키의 다른 모델도 실패할 확률이 높으므로 다음 키로
        }
      }
    }

    const finalError = `모든 API 키가 할당량을 초과했거나 에러가 발생했습니다. (${lastError?.message || lastError})`;
    if (mainWindow) mainWindow.webContents.send("process-log", `❌ ${finalError}`);
    return { success: false, error: finalError };
  });

  // ----------------------------------------
  // [Discovery] 헐리우드 핫이슈 가져오기
  // ----------------------------------------
  ipcMain.handle("fetch-hollywood-trends", async (event, query?: string) => {
    const credentials: any = store.get("user-credentials");
    const { geminiKey, subGemini, thirdGemini } = credentials || {};

    const apiKeys = [
      geminiKey,
      subGemini,
      thirdGemini,
      process.env.VITE_GEMINI_API_KEY,
    ].filter((k) => !!k && k.trim() !== "");

    if (apiKeys.length === 0) {
      return { success: false, error: "사용 가능한 API 키가 없습니다." };
    }

    let lastError: any;

    for (const apiKey of apiKeys) {
      try {
        console.log(
          `🔍 하이브리드 검색 시도 (Key: ${apiKey.slice(0, 5)}...): '${query || "Hollywood Trends"}'`,
        );

        const modelName =
          credentials.modelType === "fast"
            ? process.env.VITE_GEMINI_MODEL_FAST || "gemini-2.5-flash-lite"
            : process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-2.5-flash";

        const client = new GeminiClient(apiKey, modelName);
        const tavily = new TavilyService();

        const [tavilyResults, geminiSearchResults] = await Promise.all([
          tavily.fetchTrendingHollywood(query),
          client.searchWithGrounding(
            query || "Hollywood celebrity news gossip trending today",
          ),
        ]);

        if (
          (!tavilyResults || tavilyResults.length === 0) &&
          !geminiSearchResults
        ) {
          continue;
        }

        const combinedData = `
          [Source A: Tavily Search Results]
          ${JSON.stringify(tavilyResults)}

          [Source B: Google Search Results (Gemini Grounding)]
          ${geminiSearchResults}
        `;

        const prompt = `
          다음은 두 개의 서로 다른 검색 엔진에서 수집한 헐리우드${query ? `('${query}' 관련)` : ""} 최신 뉴스 데이터입니다.
          한국 블로그 독자들이 흥미로워할 만한 핵심 토픽 5개를 선정하여 JSON 배열로 응답하세요.

          [데이터 소스]
          ${combinedData}

          [출력 규칙]
          1. 반드시 아래 JSON 배열 형식으로만 응답 (마크다운, 부연설명 절대 금지)
          [
            { "topic": "주제(한글)", "summary": "짧은 요약(한글)", "keywords": ["키워드1", "키워드2"] },
            ...
          ]
        `;

        const topics = await client.generateJson<any[]>(prompt);
        return { success: true, data: topics };
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message || "";
        if (errorMsg.includes("429") || errorMsg.includes("limit")) {
          continue;
        }
        continue;
      }
    }

    return {
      success: false,
      error: `모든 API 키가 할당량을 초과했거나 에러가 발생했습니다. (${lastError?.message || ""})`,
    };
  });

  // ----------------------------------------
  // [Discovery] 한국 핫이슈 가져오기 (RSS 기반 - 비용 0원)
  // ----------------------------------------
  ipcMain.handle("fetch-korea-trends", async (event, query?: string) => {
    try {
      const rss = new RssService();
      const trends = await rss.fetchTrendingTopics("KR", query);

      if (!trends || trends.length === 0) {
        return { success: false, error: "현재 가져올 수 있는 한국 트렌드가 없습니다." };
      }

      const formattedTopics = trends.map(t => ({
        topic: t.title,
        summary: `최신 이슈: ${t.title}`,
        keywords: t.title.split(" ").slice(0, 2)
      }));

      return { success: true, data: formattedTopics };
    } catch (error: any) {
      return { success: false, error: "트렌드를 가져오는 중 오류가 발생했습니다." };
    }
  });

  // ----------------------------------------
  // [Abort] 프로세스 중단
  // ----------------------------------------
  ipcMain.on("abort-process", async (event, type?: "manual" | "auto") => {
    if (globalAbortController) {
      globalAbortController.abort();
    }

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
      await fs.access(filePath);
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
    globalAbortController = new AbortController();

    try {
      return await runWithAbort(async () => {
        const credentials: any = store.get("user-credentials");
        const { geminiKey, subGemini, thirdGemini } = credentials || {};
        const userDataPath = isDev ? rootPath : app.getPath("userData");

        const apiKeys = [
          geminiKey,
          subGemini,
          thirdGemini,
          process.env.VITE_GEMINI_API_KEY,
        ].filter((k) => !!k && k.trim() !== "");

        if (apiKeys.length === 0) {
          throw new Error("사용 가능한 Gemini API Key가 없습니다.");
        }

        let publication;
        let lastError;

        for (const apiKey of apiKeys) {
          try {
            if (globalAbortController?.signal.aborted)
              throw new Error("AbortError");

            const selectedModelType = task.modelType || credentials.modelType;
            const modelName =
              selectedModelType === "fast"
                ? process.env.VITE_GEMINI_MODEL_FAST || "gemini-2.5-flash-lite"
                : process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-2.5-flash";

            const geminiClient = new GeminiClient(apiKey, modelName);

            publication = await generatePost({
              client: geminiClient,
              task: task,
              projectRoot: userDataPath,
              onProgress: (message: string) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send("process-log", message);
                }
              },
            });

            if (publication) break;
          } catch (error: any) {
            if (error.message === "AbortError") throw error;

            lastError = error;
            const errorMsg = error.message || "";
            if (errorMsg.includes("429") || errorMsg.includes("limit")) {
              continue;
            }
            throw error;
          }
        }

        if (!publication) {
          throw lastError || new Error("모든 AI 모델 호출에 실패했습니다.");
        }

        return { success: true, data: publication };
      }, globalAbortController);
    } catch (error: any) {
      if (error.message === "AbortError") {
        return { success: false, error: "AbortError" };
      }
      return { success: false, error: error.message };
    } finally {
      globalAbortController = null;
    }
  });

  // ----------------------------------------
  // [v2.0] 오토파일럿 1단계: 키워드 후보 분석
  // ----------------------------------------
  ipcMain.handle(
    "fetch-keyword-candidates",
    async (event, { broadTopic, modelType }) => {
      globalAbortController = new AbortController();
      try {
        return await runWithAbort(async () => {
          const credentials: any = store.get("user-credentials");
          const { geminiKey, subGemini, thirdGemini } = credentials || {};
          const apiKeys = [
            geminiKey,
            subGemini,
            thirdGemini,
            process.env.VITE_GEMINI_API_KEY,
          ].filter((k) => !!k && k.trim() !== "");

          if (apiKeys.length === 0) throw new Error("Gemini API Key가 없습니다.");

          let lastError;
          for (const apiKey of apiKeys) {
            try {
              const modelName =
                modelType === "fast"
                  ? process.env.VITE_GEMINI_MODEL_FAST || "gemini-2.5-flash-lite"
                  : process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-2.5-flash";

              const geminiClient = new GeminiClient(apiKey, modelName);
              const scoutConfig = {
                searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
                searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
                adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
                adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
                adCustomerId: process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
              };

              const expander = new TopicExpanderService(geminiClient);
              const candidates = await expander.expandTopic(broadTopic);

              const scout = new KeywordScoutService(scoutConfig);
              const analyzed = [];
              for (const c of candidates) {
                if (globalAbortController?.signal.aborted) throw new Error("AbortError");
                const analysis = await scout.analyzeKeyword(c.keyword);
                analyzed.push({ ...c, ...analysis });
                await new Promise((res) => setTimeout(res, 500));
              }

              return { success: true, data: analyzed };
            } catch (error: any) {
              lastError = error;
              if (error.message.includes("429")) continue;
              throw error;
            }
          }
          throw lastError;
        }, globalAbortController);
      } catch (error: any) {
        if (error.message === "AbortError") return { success: false, error: "AbortError" };
        return { success: false, error: error.message };
      } finally {
        globalAbortController = null;
      }
    },
  );

  // ----------------------------------------
  // [v2.0] 오토파일럿 2단계: 선택된 키워드로 실행
  // ----------------------------------------
  ipcMain.handle(
    "run-autopilot-step2",
    async (event, { analysis, category, persona, tone, useImage, modelType, headless }) => {
      globalAbortController = new AbortController();

      try {
        return await runWithAbort(async () => {
          const credentials: any = store.get("user-credentials");
          const {
            geminiKey,
            subGemini,
            thirdGemini,
            naverId,
            naverPw,
            tistoryId,
            tistoryPw,
            enableNaver,
            enableTistory,
          } = credentials || {};

          const userDataPath = isDev ? rootPath : app.getPath("userData");
          const apiKeys = [
            geminiKey,
            subGemini,
            thirdGemini,
            process.env.VITE_GEMINI_API_KEY,
          ].filter((k) => !!k && k.trim() !== "");

          if (apiKeys.length === 0) throw new Error("Gemini API Key가 없습니다.");

          let lastError;
          for (const apiKey of apiKeys) {
            try {
              const modelName =
                modelType === "fast"
                  ? process.env.VITE_GEMINI_MODEL_FAST || "gemini-2.5-flash-lite"
                  : process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-2.5-flash";

              const geminiClient = new GeminiClient(apiKey, modelName);
              const publishPlatforms: ("naver" | "tistory")[] = [];
              if (enableNaver) publishPlatforms.push("naver");
              if (enableTistory) publishPlatforms.push("tistory");

              return await runAutoPilot({
                broadTopic: analysis.keyword,
                blogBoardName: category,
                config: {
                  searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
                  searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
                  adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
                  adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
                  adCustomerId: process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
                },
                userDataPath,
                geminiClient,
                publishPlatforms,
                credentials: {
                  naver: { id: naverId, pw: naverPw },
                  tistory: { id: tistoryId, pw: tistoryPw },
                },
                persona,
                tone,
                useImage,
                headless,
                onProgress: (message: string) => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("process-log", message);
                  }
                },
              });
            } catch (error: any) {
              lastError = error;
              if (error.message.includes("429")) continue;
              throw error;
            }
          }
          throw lastError;
        }, globalAbortController);
      } catch (error: any) {
        return { success: false, error: error.message };
      } finally {
        globalAbortController = null;
      }
    },
  );

  // ----------------------------------------
  // [v2.0] 오토파일럿 실행 (분석 -> 생성 -> 발행)
  // ----------------------------------------
  ipcMain.handle(
    "run-autopilot",
    async (event, { keyword, category, modelType, headless }) => {
      globalAbortController = new AbortController();

      try {
        return await runWithAbort(async () => {
          const credentials: any = store.get("user-credentials");
          const {
            geminiKey,
            subGemini,
            thirdGemini,
            naverId,
            naverPw,
            tistoryId,
            tistoryPw,
            enableNaver,
            enableTistory,
          } = credentials || {};

          const userDataPath = isDev ? rootPath : app.getPath("userData");
          const apiKeys = [
            geminiKey,
            subGemini,
            thirdGemini,
            process.env.VITE_GEMINI_API_KEY,
          ].filter((k) => !!k && k.trim() !== "");

          if (apiKeys.length === 0) throw new Error("Gemini API Key가 없습니다.");

          let lastError;
          for (const apiKey of apiKeys) {
            try {
              const modelName =
                modelType === "fast"
                  ? process.env.VITE_GEMINI_MODEL_FAST || "gemini-2.5-flash-lite"
                  : process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-2.5-flash";

              const geminiClient = new GeminiClient(apiKey, modelName);
              const scoutConfig = {
                searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
                searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
                adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
                adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
                adCustomerId: process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
              };

              const publishPlatforms: ("naver" | "tistory")[] = [];
              if (enableNaver) publishPlatforms.push("naver");
              if (enableTistory) publishPlatforms.push("tistory");

              if (publishPlatforms.length === 0)
                throw new Error("발행할 플랫폼이 선택되지 않았습니다.");

              return await runAutoPilot({
                broadTopic: keyword,
                blogBoardName: category,
                config: scoutConfig,
                userDataPath,
                geminiClient,
                publishPlatforms,
                credentials: {
                  naver: { id: naverId, pw: naverPw },
                  tistory: { id: tistoryId, pw: tistoryPw },
                },
                headless,
                onProgress: (message: string) => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("process-log", message);
                  }
                },
              });
            } catch (error: any) {
              lastError = error;
              if (error.message.includes("429")) continue;
              throw error;
            }
          }
          throw lastError;
        }, globalAbortController);
      } catch (error: any) {
        if (error.message === "AbortError")
          return { success: false, error: "AbortError" };
        return { success: false, error: error.message };
      } finally {
        globalAbortController = null;
      }
    },
  );

  // ----------------------------------------
  // [Blog] 블로그 발행 (Multi-Platform)
  // ----------------------------------------
  ipcMain.handle("publish-post", async (event, payload) => {
    globalAbortController = new AbortController();

    try {
      return await runWithAbort(async () => {
        const {
          platform,
          blogId,
          password,
          headless,
          ...postData
        } = payload;

        const userDataPath = isDev ? rootPath : app.getPath("userData");
        let publisher;
        const publishOptions: any = {
          blogId,
          onProgress: (message: string) => {
            event.sender.send(
              "process-log",
              `[${platform.toUpperCase()}] ${message}`,
            );
          },
        };

        if (platform === "tistory") {
          currentPublisher = new TistoryPublisher(userDataPath) as any;
          publisher = currentPublisher;
          publishOptions.password = password;
          publishOptions.headless = headless;
        } else {
          currentPublisher = new NaverPublisher(userDataPath);
          publisher = currentPublisher;
          publishOptions.password = password;
          publishOptions.headless = headless;
        }

        const htmlContent = await markdownToHtml(postData.content);
        await publisher?.publish(publishOptions, {
          ...postData,
          content: htmlContent,
          tags: postData.tags || postData.focusKeywords || [],
        });

        return { success: true };
      }, globalAbortController);
    } catch (error: any) {
      if (error.message === "AbortError") {
        return { success: false, error: "AbortError" };
      }
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

app.on("before-quit", async (e) => {
  if (currentPublisher) {
    await currentPublisher.stop();
    currentPublisher = null;
  }
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
