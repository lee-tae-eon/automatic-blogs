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
            const { generatePost, BLOG_PRESET } = require("@blog-automation/core");
            const { GeminiClient } = require("@blog-automation/core/ai");
            // 1. Store에서 계정 정보를 가져옵니다.
            const credentials = store.get("user-credentials");
            // 2. 우선순위 설정: 사용자가 입력한 API 키 -> 없으면 .env의 API 키
            const apiKey = credentials?.geminiKey || process.env.GEMINI_API_KEY;
            const modelName = process.env.GEMINI_MODEL_FAST;
            if (!apiKey || !modelName) {
                throw new Error("Gemini API 키가 설정되지 않았습니다. 설정을 확인해주세요.");
            }
            const aiClient = new GeminiClient(apiKey, modelName);
            // 3. 플랫폼 프리셋 적용 (task.platform을 기반으로 동적으로 프리셋을 가져옴)
            const platform = task.platform?.toLowerCase() || "naver";
            const preset = BLOG_PRESET[platform] || BLOG_PRESET["naver"];
            // 페르소나 매핑 (한글/영어 대응 및 정규화)
            let persona = task.persona?.toLowerCase() || "informative";
            if (["정보성", "정보", "info", "informative"].some((k) => persona.includes(k))) {
                persona = "informative";
            }
            else if (["공감형", "공감", "empathy", "empathetic"].some((k) => persona.includes(k))) {
                persona = "empathetic";
            }
            // 4. 포스트 생성
            console.log(`🤖 [${task.topic}] 포스트 생성 시작... (Persona: ${persona})`);
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
        }
        catch (error) {
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
    electron_1.ipcMain.handle("update-task-status", async (event, { filePath, index, status }) => {
        try {
            const { ExcelProcessor } = require("@blog-automation/core");
            ExcelProcessor.updateTaskStatus(filePath, index, status);
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