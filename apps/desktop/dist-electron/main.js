"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const dotenv_1 = __importDefault(require("dotenv"));
const electron_store_1 = __importDefault(require("electron-store"));
// ✅ Core 패키지 정적 Import (안정성 및 번들링 최적화)
// SQLite가 없어도 Core 인터페이스만 맞다면 에러가 나지 않습니다.
const core_1 = require("@blog-automation/core");
// import { GeminiClient } from "@blog-automation/core/ai";
// ==========================================
// 1. 환경 변수 설정
// ==========================================
const isDev = !electron_1.app.isPackaged || process.env.NODE_ENV === "development";
if (electron_1.app.isPackaged) {
    // 빌드된 상태 (Production): 리소스 폴더 내 .env 참조
    dotenv_1.default.config({ path: path.join(process.resourcesPath, ".env") });
}
else {
    // 개발 모드 (Development): 모노레포 루트 .env 참조
    dotenv_1.default.config({ path: path.join(__dirname, "../../../.env") });
}
// ==========================================
// 2. 스토어 초기화
// ==========================================
const store = new electron_store_1.default();
// 🚨 주의: 아래 코드는 사용자 데이터를 날려버리므로 절대 복구하지 마세요.
// store.delete("user-credentials.groqKey");
// store.delete("user-credentials.sub-gemini");
let mainWindow = null;
// ==========================================
// 3. 윈도우 생성 함수
// ==========================================
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
};
// ==========================================
// 4. IPC 핸들러 등록
// ==========================================
let currentPublisher = null;
let globalAbortController = null;
/**
 * 작업을 중단 가능하게 감싸는 래퍼 함수
 */
async function runWithAbort(operation, controller) {
    return Promise.race([
        operation(),
        new Promise((_, reject) => {
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
    electron_1.ipcMain.on("abort-process", async () => {
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
    electron_1.ipcMain.on("set-store-data", (event, key, value) => {
        store.set(key, value);
    });
    electron_1.ipcMain.handle("get-store-data", (event, key) => {
        return store.get(key);
    });
    // ----------------------------------------
    // [Excel] 엑셀 파일 파싱
    // ----------------------------------------
    electron_1.ipcMain.handle("parse-excel", async (event, filePath) => {
        try {
            await fs.access(filePath); // 파일 존재 여부 확인
            const result = await core_1.ExcelProcessor.readTasks(filePath);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ----------------------------------------
    // [AI] 블로그 포스트 생성 (핵심 로직)
    // ----------------------------------------
    electron_1.ipcMain.handle("generate-post", async (event, task) => {
        // 새로운 작업 시작 시 컨트롤러 초기화
        globalAbortController = new AbortController();
        try {
            return await runWithAbort(async () => {
                const credentials = store.get("user-credentials");
                const { geminiKey, subGemini } = credentials || {};
                const userDataPath = electron_1.app.getPath("userData");
                // 1. 키 배열 생성
                const apiKeys = [geminiKey, subGemini, process.env.GEMINI_API_KEY].filter((k) => !!k && k.trim() !== "");
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
                        const modelName = process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-1.5-flash";
                        const geminiClient = new core_1.GeminiClient(apiKey, modelName);
                        publication = await (0, core_1.generatePost)({
                            client: geminiClient,
                            task: task,
                            projectRoot: userDataPath,
                            onProgress: (message) => {
                                if (mainWindow && !mainWindow.isDestroyed()) {
                                    mainWindow.webContents.send("process-log", message);
                                }
                            },
                        });
                        if (publication)
                            break;
                    }
                    catch (error) {
                        if (error.message === "AbortError")
                            throw error; // 중단은 즉시 전파
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
        }
        catch (error) {
            if (error.message === "AbortError") {
                console.log("⚠️ 생성 작업이 사용자에 의해 중단되었습니다.");
                return { success: false, error: "AbortError" };
            }
            console.error("❌ 포스트 생성 에러:", error);
            return { success: false, error: error.message };
        }
        finally {
            globalAbortController = null;
        }
    });
    // ----------------------------------------
    // [Naver] 블로그 발행
    // ----------------------------------------
    electron_1.ipcMain.handle("publish-post", async (event, post) => {
        globalAbortController = new AbortController();
        try {
            return await runWithAbort(async () => {
                const credentials = store.get("user-credentials");
                const blogId = credentials?.naverId || process.env.NAVER_BLOG_ID;
                const password = credentials?.naverPw || process.env.NAVER_PASSWORD;
                if (!blogId || !password) {
                    throw new Error("네이버 계정 정보가 없습니다.");
                }
                const htmlContent = await (0, core_1.markdownToHtml)(post.content);
                currentPublisher = new core_1.NaverPublisher();
                await currentPublisher.postToBlog({
                    blogId,
                    password,
                    title: post.title,
                    htmlContent,
                    tags: post.tags || post.focusKeywords || [],
                    category: post.category,
                    headless: post.headless, // UI에서 전달받은 headless 옵션 적용
                    onProgress: (message) => {
                        event.sender.send("process-log", message);
                    },
                });
                return { success: true };
            }, globalAbortController);
        }
        catch (error) {
            if (error.message === "AbortError") {
                console.log("⚠️ 발행 작업이 사용자에 의해 중단되었습니다.");
                return { success: false, error: "AbortError" };
            }
            console.error("❌ 발행 실패:", error);
            return { success: false, error: error.message };
        }
        finally {
            currentPublisher = null;
            globalAbortController = null;
        }
    });
    // ----------------------------------------
    // [Excel] 작업 상태 업데이트
    // ----------------------------------------
    electron_1.ipcMain.handle("update-task", async (event, { filePath, index, status, persona, tone }) => {
        try {
            await core_1.ExcelProcessor.updateTaskInExcel(filePath, index, {
                status,
                persona,
                tone,
            });
            return { success: true };
        }
        catch (error) {
            console.error("❌ 상태 업데이트 오류:", error);
            return { success: false, error: error.message };
        }
    });
}
// ==========================================
// 5. 앱 생명주기
// ==========================================
electron_1.app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
//# sourceMappingURL=main.js.map