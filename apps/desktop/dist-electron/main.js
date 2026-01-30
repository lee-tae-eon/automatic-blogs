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
// 환경 변수 로드
// Monorepo Root의 .env 파일을 찾아 로드합니다. (빌드된 dist-electron/main.js 기준 상위 경로)
dotenv_1.default.config({ path: path.join(__dirname, "../../../.env") });
dotenv_1.default.config(); // 혹시 apps/desktop/.env 에 있을 경우를 대비해 기본 경로도 시도
// 스토어 초기화
const store = new electron_store_1.default();
let mainWindow = null;
/**
 * 메인 윈도우를 생성하고 설정을 초기화합니다.
 */
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
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
    electron_1.ipcMain.on("set-store-data", (event, key, value) => {
        console.log(`💾 저장 요청: ${key}`, value);
        store.set(key, value);
    });
    // 데이터 불러오기
    electron_1.ipcMain.handle("get-store-data", (event, key) => {
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
    electron_1.ipcMain.handle("parse-excel", async (event, filePath) => {
        try {
            await fs.access(filePath);
            const { ExcelProcessor } = require("@blog-automation/core");
            const result = await ExcelProcessor.readTasks(filePath);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * 블로그 포스트 생성 요청 핸들러
     * @param event - IPC 이벤트 객체
     * @param task - 생성할 포스트의 작업 정보
     */
    electron_1.ipcMain.handle("generate-post", async (event, task) => {
        try {
            const { generatePost } = require("@blog-automation/core");
            const { GeminiClient } = require("@blog-automation/core/ai");
            const store = new electron_store_1.default();
            const credentials = store.get("user-credentials");
            const { geminiKey, subGemini } = credentials || {};
            let publication;
            let lastError;
            const apiKeys = [geminiKey, subGemini, process.env.GEMINI_API_KEY].filter((k) => !!k);
            // 2. 키 배열을 순회 (이게 진짜 스위칭!)
            for (const apiKey of apiKeys) {
                try {
                    console.log(`🔑 현재 사용 중인 키: ${apiKey.slice(0, 8)}***`);
                    const geminiClient = new GeminiClient(apiKey, process.env.GEMINI_MODEL_NORMAL);
                    publication = await generatePost({
                        client: geminiClient,
                        task: task,
                    });
                    if (publication)
                        break; // ✅ 성공하면 루프 종료 (다음 키 안 씀)
                }
                catch (error) {
                    lastError = error;
                    // 3. 429(Quota Exceeded) 에러일 때만 다음 키로 스위칭
                    if (error.message.includes("429") ||
                        error.message.includes("limit")) {
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
        }
        catch (error) {
            console.error("❌ 포스트 생성 에러:", error.message);
            return { success: false, error: error.message };
        }
    });
    /**
     * 블로그 포스트 발행 요청 핸들러
     * @param event - IPC 이벤트 객체
     * @param post - 발행할 포스트 데이터 (카테고리 포함)
     */
    electron_1.ipcMain.handle("publish-post", async (event, post) => {
        try {
            const { NaverPublisher, markdownToHtml, } = require("@blog-automation/core");
            // 1. 우선 사용자가 UI에서 입력한 정보를 Store에서 가져옵니다.
            const credentials = store.get("user-credentials");
            // 2. 우선순위: 사용자가 입력한 값(Store) -> 없으면 개발자 설정(.env)
            const blogId = credentials?.naverId || process.env.NAVER_BLOG_ID;
            const password = credentials?.naverPw || process.env.NAVER_PASSWORD;
            if (!blogId)
                throw new Error("네이버 블로그 ID가 설정되지 않았습니다.");
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
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    /**
     * 작업 상태 업데이트 요청 핸들러
     */
    electron_1.ipcMain.handle("update-task", async (event, { filePath, index, status, persona }) => {
        try {
            const { ExcelProcessor } = require("@blog-automation/core");
            ExcelProcessor.updateTaskInExcel(filePath, index, { status, persona });
            return { success: true };
        }
        catch (error) {
            console.error("❌ 상태 업데이트 오류:", error);
            return { success: false, error: error.message };
        }
    });
}
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