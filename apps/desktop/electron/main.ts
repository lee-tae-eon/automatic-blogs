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
  runAutoPilot, // 추가
  TopicExpanderService,
  KeywordScoutService,
  RssService,
} from "@blog-automation/core";

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
  // [Discovery] 헐리우드 핫이슈 가져오기
  // ----------------------------------------
  ipcMain.handle("fetch-hollywood-trends", async (event, query?: string) => {
    const credentials: any = store.get("user-credentials");
    const { geminiKey, subGemini } = credentials || {};

    // 사용 가능한 키 목록 생성
    const apiKeys = [
      geminiKey,
      subGemini,
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

        console.log(
          `🤖 검색 엔진 모델: ${modelName} (${credentials.modelType || "normal"})`,
        );

        const client = new GeminiClient(apiKey, modelName);
        const tavily = new TavilyService();

        // 1. 하이브리드 검색: Tavily와 Gemini Grounding 동시 실행
        const [tavilyResults, geminiSearchResults] = await Promise.all([
          tavily.fetchTrendingHollywood(query),
          client.searchWithGrounding(
            query || "Hollywood celebrity news gossip trending today",
          ),
        ]);

        // 검색 결과가 둘 다 없으면 에러
        if (
          (!tavilyResults || tavilyResults.length === 0) &&
          !geminiSearchResults
        ) {
          console.warn(
            `⚠️ 키(${apiKey.slice(0, 5)}...) 결과 없음. 다음 키 시도.`,
          );
          continue;
        }

        // 2. 데이터 병합 및 요약 프롬프트
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
          console.warn(
            `⚠️ 키(${apiKey.slice(0, 5)}...) 할당량 초과. 다음 키로 재시도합니다.`,
          );
          continue;
        }
        console.error(`❌ 키(${apiKey.slice(0, 5)}...) 에러 발생:`, errorMsg);
        // 일반적인 에러의 경우 다음 키 시도
        continue;
      }
    }

    return {
      success: false,
      error: `모든 API 키가 할당량을 초과했거나 에러가 발생했습니다. 잠시 후 다시 시도해 주세요. (${lastError?.message || ""})`,
    };
  });

  // ----------------------------------------
  // [Discovery] 한국 핫이슈 가져오기 (RSS 기반 - 비용 0원)
  // ----------------------------------------
  ipcMain.handle("fetch-korea-trends", async (event, query?: string) => {
    try {
      console.log(`📡 RSS 기반 한국 트렌드 수집 시작... (검색어: ${query || "없음"})`);
      const rss = new RssService();
      const trends = await rss.fetchTrendingTopics("KR", query);

      if (!trends || trends.length === 0) {
        return { success: false, error: "현재 가져올 수 있는 한국 트렌드가 없습니다." };
      }

      // RSS 결과 형식을 기존 UI와 맞추기 위해 변환
      const formattedTopics = trends.map(t => ({
        topic: t.title,
        summary: `최신 이슈: ${t.title}`,
        keywords: t.title.split(" ").slice(0, 2)
      }));

      return { success: true, data: formattedTopics };
    } catch (error: any) {
      console.error("❌ 한국 트렌드(RSS) 수집 에러:", error.message);
      return { success: false, error: "트렌드를 가져오는 중 오류가 발생했습니다." };
    }
  });

  // ----------------------------------------
  // [Abort] 프로세스 중단
  // ----------------------------------------
  ipcMain.on("abort-process", async (event, type?: "manual" | "auto") => {
    console.log(`🛑 중단 요청 수신 (${type || "전체"}): 작업 강제 종료 시도`);

    // 1. 대기 중인 Promise 강제 reject (현재는 공용 컨트롤러 사용)
    if (globalAbortController) {
      globalAbortController.abort();
    }

    // 2. Playwright 브라우저 물리적 종료
    if (currentPublisher) {
      console.log("   🖱️ 브라우저 엔진 강제 종료");
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
        const userDataPath = isDev ? rootPath : app.getPath("userData");

        // 1. 키 배열 생성
        const apiKeys = [
          geminiKey,
          subGemini,
          process.env.VITE_GEMINI_API_KEY,
        ].filter((k) => !!k && k.trim() !== "");

        if (apiKeys.length === 0) {
          throw new Error("사용 가능한 Gemini API Key가 없습니다.");
        }

        let publication;
        let lastError;

        // 2. 키 순환 로직
        for (const apiKey of apiKeys) {
          try {
            // 중단 체크
            if (globalAbortController?.signal.aborted)
              throw new Error("AbortError");

            console.log(`🔑 Key 사용 시도: ${apiKey.slice(0, 5)}...`);

            // 글로벌 설정 또는 태스크별 설정 사용
            const selectedModelType = task.modelType || credentials.modelType;
            const modelName =
              selectedModelType === "fast"
                ? process.env.VITE_GEMINI_MODEL_FAST || "gemini-2.5-flash-lite"
                : process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-2.5-flash";

            console.log(
              `🤖 생성 엔진 모델: ${modelName} (${selectedModelType || "normal"})`,
            );

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

  // [v2.0] 오토파일럿 1단계: 키워드 후보 분석

  // ----------------------------------------

  ipcMain.handle(
    "fetch-keyword-candidates",
    async (event, { broadTopic, modelType }) => {
      globalAbortController = new AbortController();
      try {
        return await runWithAbort(async () => {
          const credentials: any = store.get("user-credentials");
          const { geminiKey, subGemini } = credentials || {};
          const apiKey = geminiKey || subGemini || process.env.VITE_GEMINI_API_KEY;
          if (!apiKey) throw new Error("Gemini API Key가 없습니다.");

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

          // 1. 키워드 확장
          const expander = new TopicExpanderService(geminiClient);
          const candidates = await expander.expandTopic(broadTopic);

          // 2. 각 키워드 정밀 분석 (중단 가능 루프)
          const scout = new KeywordScoutService(scoutConfig);
          const analyzed = [];
          for (const c of candidates) {
            if (globalAbortController?.signal.aborted) throw new Error("AbortError");
            const analysis = await scout.analyzeKeyword(c.keyword);
            analyzed.push({ ...c, ...analysis });
            await new Promise((res) => setTimeout(res, 500));
          }

          return { success: true, data: analyzed };
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
    async (event, { analysis, category, modelType, headless }) => {
      globalAbortController = new AbortController();

      try {
        return await runWithAbort(async () => {
          const credentials: any = store.get("user-credentials");

          const {
            geminiKey,
            subGemini,
            naverId,
            naverPw,
            tistoryId,
            tistoryPw,
            enableNaver,
            enableTistory,
          } = credentials || {};

          const userDataPath = isDev ? rootPath : app.getPath("userData");

          const apiKey =
            geminiKey || subGemini || process.env.VITE_GEMINI_API_KEY;

          const modelName =
            modelType === "fast"
              ? process.env.VITE_GEMINI_MODEL_FAST || "gemini-2.5-flash-lite"
              : process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-2.5-flash";

          const geminiClient = new GeminiClient(apiKey, modelName);

          // 이미 분석된 데이터를 가지고 바로 생성/발행 단계 수행하는 별도 함수 혹은 runAutoPilot 수정 필요

          // 여기서는 기존 runAutoPilot이 처음부터 다 하는 구조이므로,

          // 선택된 키워드 하나로 runAutoPilot을 속여서 호출하거나 로직을 분리해야 함.

          // 일단은 기존 runAutoPilot을 'keyword' 모드로 동작하게 살짝 수정해서 사용.

          const publishPlatforms: ("naver" | "tistory")[] = [];

          if (enableNaver) publishPlatforms.push("naver");

          if (enableTistory) publishPlatforms.push("tistory");

          // 분석된 데이터를 옵션으로 넘겨주는 방식으로 진행 (추후 core 수정 필요)

          // 현재는 broadTopic 자리에 선택된 키워드를 넣으면 다시 분석하지만 점수는 동일할 것임.

          return await runAutoPilot({
            broadTopic: analysis.keyword,
            blogBoardName: category, // UI에서 입력받은 category를 blogBoardName으로 전달

            config: {
              searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",

              searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",

              adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",

              adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",

              adCustomerId:
                process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
            },

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
            naverId,
            naverPw,
            tistoryId,
            tistoryPw,
            enableNaver,
            enableTistory,
          } = credentials || {};

          const userDataPath = isDev ? rootPath : app.getPath("userData");

          // 1. Gemini 클라이언트 준비

          const apiKey =
            geminiKey || subGemini || process.env.VITE_GEMINI_API_KEY;

          if (!apiKey) throw new Error("Gemini API Key가 없습니다.");

          const modelName =
            modelType === "fast"
              ? process.env.VITE_GEMINI_MODEL_FAST || "gemini-2.5-flash-lite"
              : process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-2.5-flash";

          const geminiClient = new GeminiClient(apiKey, modelName);

          // 2. 스카우트 설정 준비

          const scoutConfig = {
            searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",

            searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",

            adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",

            adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",

            adCustomerId:
              process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
          };

          // 3. 발행 플랫폼 설정

          const publishPlatforms: ("naver" | "tistory")[] = [];

          if (enableNaver) publishPlatforms.push("naver");

          if (enableTistory) publishPlatforms.push("tistory");

          if (publishPlatforms.length === 0)
            throw new Error("발행할 플랫폼이 선택되지 않았습니다.");

          // 4. 파이프라인 실행
          return await runAutoPilot({
            broadTopic: keyword, // keyword를 broadTopic으로 매핑
            blogBoardName: category, // UI에서 전달받은 값 그대로 사용
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
          accessToken,
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
          // Default: Naver

          currentPublisher = new NaverPublisher(userDataPath);

          publisher = currentPublisher;

          publishOptions.password = password;

          publishOptions.headless = headless;
        }

        // 마크다운을 HTML로 변환 (이미 되어있을 수도 있지만 안전을 위해)

        // 만약 postData.content가 이미 HTML이라면 markdownToHtml이 그대로 반환하거나 처리할 것임

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

      console.error(`❌ [${payload.platform}] 발행 실패:`, error);

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

// ✅ 앱 종료 시 안전한 정리 (세션 저장 보장)
app.on("before-quit", async (e) => {
  if (currentPublisher) {
    console.log("Cleanup: Closing publisher before quit...");
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
