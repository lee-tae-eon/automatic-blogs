import { app, BrowserWindow, ipcMain, dialog } from "electron";
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
  `🤖 Default Model: ${process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview"}`,
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
  generateCoupangPost,
  ExcelProcessor,
  NaverPublisher,
  TistoryPublisher,
  markdownToHtml,
  GeminiClient,
  TavilyService,
  runAutoPilot,
  TopicExpanderService,
  KeywordScoutService,
  TopicRecommendationService,
  RssService,
  DbService,
  NateNewsService,
  } from "@blog-automation/core";


// ==========================================
// 2. 스토어 초기화
// ==========================================
const store = new Store();

// ✅ [v11.10] DB 서비스 초기화
const userDataPath = !app.isPackaged 
  ? path.join(__dirname, "../../..") 
  : app.getPath("userData");
const dbService = new DbService(userDataPath);

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
  // [System] 이미지 파일 선택 다이얼로그 (New v8.8)
  // ----------------------------------------
  ipcMain.handle("select-image", async () => {
    if (!mainWindow) return { success: false, error: "Main window not found" };

    const result = await dialog.showOpenDialog(mainWindow, {
      title: "대표 이미지 선택",
      properties: ["openFile"],
      filters: [
        { name: "Images", extensions: ["jpg", "png", "jpeg", "webp", "gif"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, filePath: result.filePaths[0] };
  });

  // ----------------------------------------
  // [Discovery] 추천 토픽 가져오기 (New v3.0, v10.7 사용자 검색어 지원)
  // ----------------------------------------
  ipcMain.handle("fetch-recommended-topics", async (event, { category, query }: { category: any; query?: string }) => {
    // [Nate News Ranking] 특수 처리
    if (category === "nate") {
      try {
        const nateService = new NateNewsService();
        const rankings = await nateService.fetchTopRankings(15);
        const data = rankings.map(r => ({
          topic: r.title,
          summary: `네이트 실시간 랭킹 ${r.rank}위 (${r.medium})`,
          keywords: r.title.split(" ").slice(0, 2),
          sourceUrl: r.link
        }));
        return { success: true, data };
      } catch (error: any) {
        return { success: false, error: `네이트 랭킹 수집 실패: ${error.message}` };
      }
    }

    const credentials: any = store.get("user-credentials");
    // ... (apiKey 설정 로직)
    const { geminiKey, subGemini, thirdGemini } = credentials || {};

    const apiKeys = [
      geminiKey,
      subGemini,
      thirdGemini,
      process.env.VITE_GEMINI_API_KEY,
    ].filter((k) => !!k && k.trim() !== "");

    if (apiKeys.length === 0)
      return { success: false, error: "Gemini API Key가 없습니다." };

    let lastError: any;
    const modelVersions = [
      process.env.VITE_GEMINI_MODEL_3_1_PRO || "gemini-3.1-pro-preview",
      process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview",
      process.env.VITE_GEMINI_MODEL_3_1_FLASH_LITE || "gemini-3.1-flash-lite-preview",
      process.env.VITE_GEMINI_MODEL_2_5_FLASH || "gemini-2.5-flash",
      process.env.VITE_GEMINI_MODEL_2_5_FLASH_LITE || "gemini-2.5-flash-lite",
    ];

    for (const [idx, apiKey] of apiKeys.entries()) {
      for (const modelName of modelVersions) {
        try {
          const client = new GeminiClient(apiKey, modelName);
          const naverConfig = {
            clientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
            clientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
          };
          const scoutConfig = {
            searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
            searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
            adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
            adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
            adCustomerId: process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
          };
          const service = new TopicRecommendationService(client, naverConfig, scoutConfig);

          const logMsg = `🔍 [추천 시스템] 키 #${idx + 1} (${modelName}) 시도 중 (검색어: ${query || "없음"})...`;
          if (mainWindow) mainWindow.webContents.send("process-log", logMsg);

          const data = await service.getRecommendationsByCategory(category, query);
          return { success: true, data };
        } catch (error: any) {
          lastError = error;
          const errorMsg = String(error.message || error);

          // 할당량 초과(429) 및 기타 모든 일시적 에러에 대해 다음 모델로 계속 시도
          const warnMsg = `⚠️ [추천 시스템] 키 #${idx + 1} (${modelName}) 시도 실패: ${errorMsg.slice(0, 40)}... 다음 모델/키 시도`;
          console.warn(warnMsg);
          if (mainWindow) mainWindow.webContents.send("process-log", warnMsg);
          
          continue; // 429뿐만 아니라 모든 에러 발생 시 다음 모델로 넘어감
        }
      }
    }

    const finalError = `모든 API 키가 할당량을 초과했거나 에러가 발생했습니다. (${lastError?.message || lastError})`;
    if (mainWindow)
      mainWindow.webContents.send("process-log", `❌ ${finalError}`);
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

        let modelName = "";
        switch (credentials.modelType) {
          case "3.1_pro":
            modelName = process.env.VITE_GEMINI_MODEL_3_1_PRO || "gemini-3.1-pro-preview";
            break;
          case "3.0_flash":
            modelName = process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview";
            break;
          case "3.1_flash_lite":
            modelName = process.env.VITE_GEMINI_MODEL_3_1_FLASH_LITE || "gemini-3.1-flash-lite-preview";
            break;
          case "2.5_flash":
            modelName = process.env.VITE_GEMINI_MODEL_2_5_FLASH || "gemini-2.5-flash";
            break;
          case "2.5_flash_lite":
            modelName = process.env.VITE_GEMINI_MODEL_2_5_FLASH_LITE || "gemini-2.5-flash-lite";
            break;
          default:
            modelName = process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview";
        }

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
        return {
          success: false,
          error: "현재 가져올 수 있는 한국 트렌드가 없습니다.",
        };
      }

      const formattedTopics = trends.map((t) => ({
        topic: t.title,
        summary: `최신 이슈: ${t.title}`,
        keywords: t.title.split(" ").slice(0, 2),
      }));

      return { success: true, data: formattedTopics };
    } catch (error: any) {
      return {
        success: false,
        error: "트렌드를 가져오는 중 오류가 발생했습니다.",
      };
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

        let lastError;
        const modelOrder: any[] = [
          task.modelType || credentials.modelType || "3.0_flash",
          "3.1_pro",
          "3.0_flash",
          "3.1_flash_lite",
          "2.5_flash",
          "2.5_flash_lite",
        ];
        const uniqueModels = Array.from(new Set(modelOrder));

        for (const apiKey of apiKeys) {
          for (const modelType of uniqueModels) {
            try {
              if (globalAbortController?.signal.aborted)
                throw new Error("AbortError");

              let mName = "";
              switch (modelType) {
                case "3.1_pro": mName = process.env.VITE_GEMINI_MODEL_3_1_PRO || "gemini-3.1-pro-preview"; break;
                case "3.0_flash": mName = process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview"; break;
                case "3.1_flash_lite": mName = process.env.VITE_GEMINI_MODEL_3_1_FLASH_LITE || "gemini-3.1-flash-lite-preview"; break;
                case "2.5_flash": mName = process.env.VITE_GEMINI_MODEL_2_5_FLASH || "gemini-2.5-flash"; break;
                case "2.5_flash_lite": mName = process.env.VITE_GEMINI_MODEL_2_5_FLASH_LITE || "gemini-2.5-flash-lite"; break;
                default: mName = process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview";
              }

              const client = new GeminiClient(apiKey, mName);
              const logMsg = `🤖 AI 모델 시도: ${mName} (Key: ${apiKey.slice(0, 5)}...)`;
              if (mainWindow) mainWindow.webContents.send("process-log", logMsg);

              const generateOptions = {
                client: client,
                task: { ...task, modelType }, // 현재 시도 중인 모델 타입 반영
                projectRoot: userDataPath,
                onProgress: (message: string) => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("process-log", message);
                  }
                },
              };

              let publication;
              if (task.coupangLink) {
                publication = await generateCoupangPost(generateOptions);
              } else {
                publication = await generatePost(generateOptions);
              }

              if (publication) return { success: true, data: publication };
            } catch (error: any) {
              if (error.message === "AbortError") throw error;

              lastError = error;
              const errorMsg = String(error.message || error);
              
              // 429(할당량 초과) 또는 503(과부하/High demand)인 경우 다음 모델/키 시도
              const isRetryable = 
                errorMsg.includes("429") || 
                errorMsg.includes("limit") || 
                errorMsg.includes("503") || 
                errorMsg.includes("500") ||
                errorMsg.includes("Service Unavailable") || 
                errorMsg.includes("demand") ||
                errorMsg.includes("overloaded");

              if (isRetryable) {
                const warnMsg = `⚠️ [AI 생성] ${modelType} 실패 (${errorMsg.slice(0, 70)}...). 2초 후 다음 모델로 전환합니다.`;
                if (mainWindow) mainWindow.webContents.send("process-log", warnMsg);
                console.warn(warnMsg);
                
                // [v9.1] 즉시 재시도 시 연속 503 방지를 위한 짧은 대기
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue; 
              }
              // 그 외 예상치 못한 에러는 중단
              throw error;
            }
          }
        }

        throw lastError || new Error("모든 AI 모델 호출에 실패했습니다.");
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

          if (apiKeys.length === 0)
            throw new Error("Gemini API Key가 없습니다.");

          let lastError;
          for (const apiKey of apiKeys) {
            try {
              let modelName = "";
              switch (modelType) {
                case "3.1_pro": modelName = process.env.VITE_GEMINI_MODEL_3_1_PRO || "gemini-3.1-pro-preview"; break;
                case "3.0_flash": modelName = process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview"; break;
                case "3.1_flash_lite": modelName = process.env.VITE_GEMINI_MODEL_3_1_FLASH_LITE || "gemini-3.1-flash-lite-preview"; break;
                case "2.5_flash": modelName = process.env.VITE_GEMINI_MODEL_2_5_FLASH || "gemini-2.5-flash"; break;
                case "2.5_flash_lite": modelName = process.env.VITE_GEMINI_MODEL_2_5_FLASH_LITE || "gemini-2.5-flash-lite"; break;
                default: modelName = process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview";
              }

              const geminiClient = new GeminiClient(apiKey, modelName);
              const scoutConfig = {
                searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
                searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
                adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
                adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
                adCustomerId:
                  process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
              };

              const expander = new TopicExpanderService(geminiClient);
              const candidates = await expander.expandTopic(broadTopic);

              const scout = new KeywordScoutService(scoutConfig);
              const analyzed = [];
              for (const c of candidates) {
                if (globalAbortController?.signal.aborted)
                  throw new Error("AbortError");
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
        if (error.message === "AbortError")
          return { success: false, error: "AbortError" };
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
    async (
      event,
      { analysis, category, persona, tone, useImage, modelType, headless },
    ) => {
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
            naverCategory,
            naverId2,
            naverPw2,
            naverCategory2,
            tistoryId,
            tistoryPw,
            enableNaver,
            enableNaver2,
            enableTistory,
          } = credentials || {};

          const userDataPath = isDev ? rootPath : app.getPath("userData");
          const apiKeys = [
            geminiKey,
            subGemini,
            thirdGemini,
            process.env.VITE_GEMINI_API_KEY,
          ].filter((k) => !!k && k.trim() !== "");

          if (apiKeys.length === 0)
            throw new Error("Gemini API Key가 없습니다.");

          let lastError;
          for (const apiKey of apiKeys) {
            try {
              let modelName = "";
              switch (modelType) {
                case "3.1_pro": modelName = process.env.VITE_GEMINI_MODEL_3_1_PRO || "gemini-3.1-pro-preview"; break;
                case "3.0_flash": modelName = process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview"; break;
                case "3.1_flash_lite": modelName = process.env.VITE_GEMINI_MODEL_3_1_FLASH_LITE || "gemini-3.1-flash-lite-preview"; break;
                case "2.5_flash": modelName = process.env.VITE_GEMINI_MODEL_2_5_FLASH || "gemini-2.5-flash"; break;
                case "2.5_flash_lite": modelName = process.env.VITE_GEMINI_MODEL_2_5_FLASH_LITE || "gemini-2.5-flash-lite"; break;
                default: modelName = process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview";
              }

              const geminiClient = new GeminiClient(apiKey, modelName);
              const publishPlatforms: ("naver" | "tistory")[] = [];
              if (enableNaver) publishPlatforms.push("naver");
              if (enableTistory) publishPlatforms.push("tistory");

              return await runAutoPilot({
                broadTopic: analysis.keyword,
                blogBoardName: category,
                config: {
                  searchClientId:
                    process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
                  searchClientSecret:
                    process.env.VITE_NAVER_SEARCH_API_KEY || "",
                  adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
                  adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
                  adCustomerId:
                    process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
                },
                userDataPath,
                geminiClient,
                publishPlatforms,
                credentials: {
                  navers: [
                    ...(enableNaver && naverId
                      ? [
                          {
                            id: naverId,
                            pw: naverPw,
                            category: naverCategory,
                          },
                        ]
                      : []),
                    ...(enableNaver2 && naverId2
                      ? [
                          {
                            id: naverId2,
                            pw: naverPw2,
                            category: naverCategory2,
                          },
                        ]
                      : []),
                  ],
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
            naverCategory,
            naverId2,
            naverPw2,
            naverCategory2,
            tistoryId,
            tistoryPw,
            enableNaver,
            enableNaver2,
            enableTistory,
          } = credentials || {};

          const userDataPath = isDev ? rootPath : app.getPath("userData");
          const apiKeys = [
            geminiKey,
            subGemini,
            thirdGemini,
            process.env.VITE_GEMINI_API_KEY,
          ].filter((k) => !!k && k.trim() !== "");

          if (apiKeys.length === 0)
            throw new Error("Gemini API Key가 없습니다.");

          let lastError;
          for (const apiKey of apiKeys) {
            try {
              let modelName = "";
              switch (modelType) {
                case "3.1_pro": modelName = process.env.VITE_GEMINI_MODEL_3_1_PRO || "gemini-3.1-pro-preview"; break;
                case "3.0_flash": modelName = process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview"; break;
                case "3.1_flash_lite": modelName = process.env.VITE_GEMINI_MODEL_3_1_FLASH_LITE || "gemini-3.1-flash-lite-preview"; break;
                case "2.5_flash": modelName = process.env.VITE_GEMINI_MODEL_2_5_FLASH || "gemini-2.5-flash"; break;
                case "2.5_flash_lite": modelName = process.env.VITE_GEMINI_MODEL_2_5_FLASH_LITE || "gemini-2.5-flash-lite"; break;
                default: modelName = process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3-flash-preview";
              }

              const geminiClient = new GeminiClient(apiKey, modelName);
              const scoutConfig = {
                searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
                searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
                adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
                adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
                adCustomerId:
                  process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
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
                  navers: [
                    ...(enableNaver && naverId
                      ? [
                          {
                            id: naverId,
                            pw: naverPw,
                            category: naverCategory,
                          },
                        ]
                      : []),
                    ...(enableNaver2 && naverId2
                      ? [
                          {
                            id: naverId2,
                            pw: naverPw2,
                            category: naverCategory2,
                          },
                        ]
                      : []),
                  ],
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
        const { platform, blogId, password, headless, ...postData } = payload;

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
          currentPublisher = new NaverPublisher(userDataPath, blogId);
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

  // ----------------------------------------
  // [History] 발행 내역 가져오기 (New v11.10)
  // ----------------------------------------
  ipcMain.handle("fetch-history", async (event, { limit, account }) => {
    try {
      const history = dbService.getPublishedHistory(limit, account);
      return { success: true, data: history };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
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
