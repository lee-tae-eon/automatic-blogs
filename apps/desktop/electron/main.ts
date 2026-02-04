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
const isDev = process.env.NODE_ENV === "development";

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
function registerIpcHandlers() {
  // ----------------------------------------
  // [Store] 데이터 저장/로드
  // ----------------------------------------
  ipcMain.on("set-store-data", (event, key, value) => {
    console.log(`💾 저장 요청: ${key}`, value ? "(값 있음)" : "(값 없음)");
    store.set(key, value);
  });

  ipcMain.handle("get-store-data", (event, key) => {
    const data = store.get(key);
    // 보안상 로그에는 민감한 값 노출 자제
    console.log(`📂 불러오기 요청: ${key}`, data ? "(데이터 존재)" : "(없음)");
    return data;
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
    try {
      const credentials: any = store.get("user-credentials");
      const { geminiKey, subGemini } = credentials || {};

      // ✅ 나중에 SQLite DB가 저장될 안전한 경로 확보
      // (지금 SQLite가 없어도 경로는 미리 넘겨두는 것이 좋습니다)
      const userDataPath = app.getPath("userData");

      // 1. 키 배열 생성 (우선순위: 스토어 저장값 -> .env 값)
      const apiKeys = [geminiKey, subGemini, process.env.GEMINI_API_KEY].filter(
        (k) => !!k && k.trim() !== "",
      );

      if (apiKeys.length === 0) {
        throw new Error(
          "사용 가능한 Gemini API Key가 없습니다. 설정 메뉴에서 키를 등록해주세요.",
        );
      }

      let publication;
      let lastError;

      // 2. 키 순환 (Failover) 로직
      for (const apiKey of apiKeys) {
        try {
          console.log(`🔑 Key 사용 시도: ${apiKey.slice(0, 5)}...`);

          // 모델명 하드코딩 (안전장치)
          const modelName =
            process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-1.5-flash";

          const geminiClient = new GeminiClient(apiKey, modelName);

          publication = await generatePost({
            client: geminiClient,
            task: task,
            projectRoot: userDataPath, // 👈 DB 경로 주입 (Core에서 안 쓰면 무시됨)
          });

          if (publication) break; // 성공 시 루프 탈출
        } catch (error: any) {
          lastError = error;
          const errorMsg = error.message || "";

          // 429(Too Many Requests) 또는 Limit 관련 에러만 다음 키로 넘어감
          if (errorMsg.includes("429") || errorMsg.includes("limit")) {
            console.warn("⚠️ 할당량 초과! 다음 API 키로 전환합니다...");
            continue;
          }
          // 인증 에러 등은 즉시 실패 처리
          throw error;
        }
      }

      if (!publication) {
        throw lastError || new Error("모든 AI 모델 호출에 실패했습니다.");
      }

      console.log(`✅ [${task.topic}] 생성 완료`);
      return { success: true, data: publication };
    } catch (error: any) {
      console.error("❌ 포스트 생성 에러:", error);
      return { success: false, error: error.message };
    }
  });

  // ----------------------------------------
  // [Naver] 블로그 발행
  // ----------------------------------------
  ipcMain.handle("publish-post", async (event, post) => {
    try {
      const credentials: any = store.get("user-credentials");
      const blogId = credentials?.naverId || process.env.NAVER_BLOG_ID;
      const password = credentials?.naverPw || process.env.NAVER_PASSWORD;

      if (!blogId || !password) {
        throw new Error(
          "네이버 계정 정보가 없습니다. 설정 메뉴를 확인해주세요.",
        );
      }

      // 마크다운 -> HTML 변환 (Core 유틸리티 사용)
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
      console.error("❌ 발행 실패:", error);
      return { success: false, error: error.message };
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

// import { app, BrowserWindow, ipcMain } from "electron";
// import * as path from "path";
// import * as fs from "fs/promises";
// import dotenv from "dotenv";
// import Store from "electron-store";

// // 환경 변수 로드
// if (app.isPackaged) {
//   // 빌드된 상태 (Production)
//   // 앱의 리소스 폴더나 실행 파일 위치를 기준으로 설정합니다.
//   dotenv.config({ path: path.join(process.resourcesPath, ".env") });
// } else {
//   // 개발 모드 (Development)
//   // 기존처럼 모노레포 루트의 .env를 참조합니다.
//   dotenv.config({ path: path.join(__dirname, "../../../.env") });
// }

// // 스토어 초기화
// const store = new Store();

// let mainWindow: BrowserWindow | null = null;

// /**
//  * 메인 윈도우를 생성하고 설정을 초기화합니다.
//  */
// const createWindow = () => {
//   mainWindow = new BrowserWindow({
//     width: 1400,
//     height: 1000,
//     webPreferences: {
//       nodeIntegration: false,
//       contextIsolation: true,
//       // ✅ Preload 스크립트 추가
//       preload: path.join(__dirname, "preload.js"),
//     },
//   });

//   // 개발 환경
//   if (process.env.NODE_ENV !== "production") {
//     mainWindow.loadURL("http://localhost:5173");
//     mainWindow.webContents.openDevTools();
//   } else {
//     mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
//   }

//   mainWindow.on("closed", () => {
//     mainWindow = null;
//   });
// };

// /**
//  * IPC(Inter-Process Communication) 핸들러를 등록합니다.
//  * Renderer 프로세스에서 오는 요청을 처리합니다.
//  */
// function registerIpcHandlers() {
//   // 데이터 저장 (아이디, 비번 등)
//   ipcMain.on("set-store-data", (event, key, value) => {
//     console.log(`💾 저장 요청: ${key}`, value);
//     store.set(key, value);
//   });

//   // 데이터 불러오기
//   ipcMain.handle("get-store-data", (event, key) => {
//     const data = store.get(key);
//     console.log(`📂 불러오기 요청: ${key}`, data); // undefined인지 확인
//     return data;
//   });

//   store.delete("user-credentials.groqKey");
//   store.delete("user-credentials.sub-gemini");
//   /**
//    * 엑셀 파일 파싱 요청 핸들러
//    * @param event - IPC 이벤트 객체
//    * @param filePath - 파싱할 엑셀 파일의 경로
//    */
//   ipcMain.handle("parse-excel", async (event, filePath: string) => {
//     try {
//       await fs.access(filePath);
//       const { ExcelProcessor } = require("@blog-automation/core");
//       const result = await ExcelProcessor.readTasks(filePath);
//       return { success: true, data: result };
//     } catch (error: any) {
//       return { success: false, error: error.message };
//     }
//   });

//   /**
//    * 블로그 포스트 생성 요청 핸들러
//    * @param event - IPC 이벤트 객체
//    * @param task - 생성할 포스트의 작업 정보
//    */
//   ipcMain.handle("generate-post", async (event, task) => {
//     try {
//       const { generatePost } = require("@blog-automation/core");
//       const { GeminiClient } = require("@blog-automation/core/ai");

//       const store = new Store();
//       const credentials: any = store.get("user-credentials");
//       const { geminiKey, subGemini } = credentials || {};

//       let publication;
//       let lastError;

//       const apiKeys = [geminiKey, subGemini, process.env.GEMINI_API_KEY].filter(
//         (k) => !!k,
//       );

//       // 2. 키 배열을 순회 (이게 진짜 스위칭!)
//       for (const apiKey of apiKeys) {
//         try {
//           console.log(`🔑 현재 사용 중인 키: ${apiKey.slice(0, 8)}***`);

//           const geminiClient = new GeminiClient(
//             apiKey,
//             process.env.VITE_GEMINI_MODEL_NORMAL,
//           );

//           publication = await generatePost({
//             client: geminiClient,
//             task: task,
//           });

//           if (publication) break; // ✅ 성공하면 루프 종료 (다음 키 안 씀)
//         } catch (error: any) {
//           lastError = error;
//           // 3. 429(Quota Exceeded) 에러일 때만 다음 키로 스위칭
//           if (
//             error.message.includes("429") ||
//             error.message.includes("limit")
//           ) {
//             console.warn("⚠️ 메인 키 한도 초과! 서브 키로 전환합니다...");
//             continue; // ✅ 다음 apiKey로 이동
//           }
//           // 429가 아닌 다른 에러(인증 실패 등)는 즉시 중단
//           throw error;
//         }
//       }
//       if (!publication)
//         throw lastError || new Error("모든 AI 모델 호출에 실패했습니다.");

//       console.log(`✅ [${task.topic}] 포스트 생성 성공: ${publication.title}`);
//       return { success: true, data: publication };
//     } catch (error: any) {
//       console.error("❌ 포스트 생성 에러:", error.message);
//       return { success: false, error: error.message };
//     }
//   });

//   /**
//    * 블로그 포스트 발행 요청 핸들러
//    * @param event - IPC 이벤트 객체
//    * @param post - 발행할 포스트 데이터 (카테고리 포함)
//    */
//   ipcMain.handle("publish-post", async (event, post) => {
//     try {
//       const {
//         NaverPublisher,
//         markdownToHtml,
//       } = require("@blog-automation/core");

//       // 1. 우선 사용자가 UI에서 입력한 정보를 Store에서 가져옵니다.
//       const credentials: any = store.get("user-credentials");

//       // 2. 우선순위: 사용자가 입력한 값(Store) -> 없으면 개발자 설정(.env)
//       const blogId = credentials?.naverId || process.env.NAVER_BLOG_ID;
//       const password = credentials?.naverPw || process.env.NAVER_PASSWORD;

//       if (!blogId) throw new Error("네이버 블로그 ID가 설정되지 않았습니다.");

//       const htmlContent = await markdownToHtml(post.content);
//       const publisher = new NaverPublisher();

//       await publisher.postToBlog({
//         blogId,
//         password,
//         title: post.title,
//         htmlContent,
//         tags: post.tags || post.focusKeywords || [],
//         category: post.category,
//       });

//       return { success: true };
//     } catch (error: any) {
//       return { success: false, error: error.message };
//     }
//   });

//   /**
//    * 작업 상태 업데이트 요청 핸들러
//    */
//   ipcMain.handle(
//     "update-task",
//     async (event, { filePath, index, status, persona, tone }) => {
//       try {
//         const { ExcelProcessor } = require("@blog-automation/core");
//         ExcelProcessor.updateTaskInExcel(filePath, index, {
//           status,
//           persona,
//           tone,
//         });
//         return { success: true };
//       } catch (error: any) {
//         console.error("❌ 상태 업데이트 오류:", error);
//         return { success: false, error: error.message };
//       }
//     },
//   );
// }

// app.whenReady().then(() => {
//   registerIpcHandlers();
//   createWindow();
// });

// app.on("window-all-closed", () => {
//   if (process.platform !== "darwin") {
//     app.quit();
//   }
// });

// app.on("activate", () => {
//   if (BrowserWindow.getAllWindows().length === 0) {
//     createWindow();
//   }
// });
