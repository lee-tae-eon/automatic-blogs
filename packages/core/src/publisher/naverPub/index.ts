/// <reference lib="dom" />
import { chromium, Page, BrowserContext } from "playwright";
import path from "path";
import fs from "fs";
import { findProjectRoot } from "../../util/findProjectRoot";
import { NaverAuthenticator } from "./NaverAuthenticator";
import { NaverEditor } from "./NaverEditor";
import { NaverPublicationManager } from "./NaverPublicationManager";

/**
 * 네이버 블로그 발행을 위한 입력 데이터 인터페이스
 */
export interface NaverPostInput {
  blogId: string;
  title: string;
  htmlContent: string;
  password?: string;
  tags?: string[];
  category?: string;
  references?: { name: string; url: string }[];
  persona?: string;
  tone?: string;
  onProgress?: (message: string) => void;
  headless?: boolean;
}

/**
 * NaverPublisher
 * 네이버 블로그 자동 발행을 총괄하는 오케스트레이터 클래스입니다.
 */
export class NaverPublisher {
  private userDataDir: string;
  private projectRoot: string;
  private currentContext: BrowserContext | null = null;

  constructor(customProjectRoot?: string) {
    this.projectRoot = customProjectRoot || findProjectRoot(__dirname);
    this.userDataDir = path.join(this.projectRoot, ".auth/naver");

    this.ensureAuthDirectory();
  }

  /**
   * 인증 정보가 저장될 디렉토리를 확인하고 없으면 생성합니다.
   */
  private ensureAuthDirectory() {
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
      console.log(`📂 [NaverPublisher] 인증 디렉토리 생성: ${this.userDataDir}`);
    } else {
      console.log(`📂 [NaverPublisher] 기존 인증 디렉토리 사용: ${this.userDataDir}`);
    }
  }

  /**
   * 진행 중인 발행 프로세스를 즉시 중단합니다.
   */
  async stop() {
    if (this.currentContext) {
      console.log("🛑 NaverPublisher: 브라우저 종료 및 프로세스 중단 시도");
      await this.currentContext.close();
      this.currentContext = null;
    }
  }

  /**
   * 본문 하단에 출처(References) 링크 섹션을 추가합니다.
   */
  private appendReferences(
    html: string,
    references?: { name: string; url: string }[],
  ): string {
    // 유효한 출처만 필터링 (이름과 URL이 모두 있어야 함)
    const validRefs = (references || []).filter(ref => ref && ref.name?.trim() && ref.url?.trim());
    
    if (validRefs.length === 0) return html;

    const refHtml = `
      <br><hr><br>
      <p><strong>🔗 참고 자료 및 최신 뉴스 출처</strong></p>
      <ul>
        ${validRefs
          .map(
            (ref) =>
              `<li><a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.name} 기사 원문 보기</a></li>`,
          )
          .join("")}
      </ul>
    `;
    return html + refHtml;
  }

  /**
   * 실행 환경(Electron/OS)에 따른 브라우저 실행 파일 경로를 탐색합니다.
   */
  private getExecutablePath(): string | undefined {
    const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (!browserRoot) return undefined;

    try {
      const chromiumFolders = fs.readdirSync(browserRoot).filter((f) => f.startsWith("chromium-"));
      if (chromiumFolders.length === 0) return undefined;

      let relativePath = "";
      const latestFolder = chromiumFolders[0];

      if (process.platform === "darwin") {
        const chromeAppDir = fs
          .readdirSync(path.join(browserRoot, latestFolder))
          .find((f) => f.startsWith("chrome-mac"));
        if (chromeAppDir) {
          relativePath = path.join(
            latestFolder,
            chromeAppDir,
            "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
          );
        }
      } else if (process.platform === "win32") {
        relativePath = path.join(latestFolder, "chrome-win", "chrome.exe");
      }

      const fullPath = path.join(browserRoot, relativePath);
      return fs.existsSync(fullPath) ? fullPath : undefined;
    } catch (e) {
      console.error("📂 브라우저 경로 탐색 실패:", e);
      return undefined;
    }
  }

  /**
   * 브라우저 컨텍스트를 초기화하고 페이지를 생성합니다.
   */
  private async initializeContext(headless: boolean): Promise<Page> {
    const launchOptions: any = {
      headless,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
      permissions: ["clipboard-read", "clipboard-write"],
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    };

    const customPath = this.getExecutablePath();
    if (customPath) {
      launchOptions.executablePath = customPath;
      console.log(`🚀 커스텀 브라우저 실행 경로 사용: ${customPath}`);
    }

    this.currentContext = await chromium.launchPersistentContext(this.userDataDir, launchOptions);
    const page = await this.currentContext.newPage();

    // 다이얼로그(Alert 등) 자동 승인 설정
    page.on("dialog", async (dialog) => {
      console.log(`🔔 다이얼로그 자동 승인: ${dialog.message()}`);
      await dialog.accept();
    });

    return page;
  }

  /**
   * 네이버 로그인을 처리합니다. 이미 세션이 있는 경우 건너뜁니다.
   */
  private async handleLogin(page: Page, blogId: string, password?: string, onProgress?: (msg: string) => void) {
    onProgress?.("네이버 블로그 접속 중...");
    await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    if (page.url().includes("nid.naver.com")) {
      onProgress?.("네이버 로그인 진행 중...");
      if (password) {
        const authenticator = new NaverAuthenticator(page);
        await authenticator.login(blogId, password);
      } else {
        onProgress?.("수동 로그인이 필요합니다 (2분 대기)");
        console.log("👉 로그인이 필요합니다. 브라우저에서 로그인을 완료해 주세요 (2분 대기).");
      }
      
      await page.waitForURL("https://blog.naver.com/**", { timeout: 120000 });
      onProgress?.("로그인 완료 (세션 저장 중...)");
      await page.waitForTimeout(3000);

      await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
    }
  }

  /**
   * 에러 발생 시 로그를 파일로 기록합니다.
   */
  private logError(taskName: string, error: any, url: string) {
    const logPath = path.join(process.cwd(), "error-log.txt");
    const timestamp = new Date().toLocaleString("ko-KR");
    const errorEntry = `\n==================================================\n[${timestamp}]\n📍 대상 포스트: ${taskName}\n❌ 에러 메시지: ${error.message || error}\n🔗 발생 URL: ${url}\n--------------------------------------------------\n`;
    try {
      fs.appendFileSync(logPath, errorEntry, "utf8");
      console.log(`📝 에러 로그 저장 완료: ${logPath}`);
    } catch (err) {
      console.error("💾 로그 파일 저장 실패:", err);
    }
  }

  /**
   * [Public API] 블로그에 포스트를 작성하고 발행합니다.
   */
  async postToBlog(input: NaverPostInput) {
    const { blogId, title, htmlContent, password, tags = [], category, references, persona, onProgress, headless = false } = input;
    let page: Page | null = null;

    try {
      onProgress?.("브라우저 환경 준비 중...");
      page = await this.initializeContext(headless);

      // 1. 로그인 처리
      await this.handleLogin(page, blogId, password, onProgress);

      // 2. 에디터 진입 및 초기화
      const editor = new NaverEditor(page, this.projectRoot, title, tags, persona);
      onProgress?.("에디터 초기화 중...");
      await editor.clearPopups();
      await page.waitForTimeout(2000);

      // 3. 제목 입력
      await editor.enterTitle(title);
      await page.waitForTimeout(1000);

      // 4. 본문 구성 (페르소나 기반 출처 필터링 적용)
      const excludedPersonas = ["friendly", "storytelling", "experiential"];
      const shouldExcludeRef = persona && excludedPersonas.includes(persona);
      
      let finalHtml = htmlContent;
      if (shouldExcludeRef) {
        console.log(`ℹ️ [NaverPublisher] '${persona}' 페르소나는 출처 기재를 일괄 제외합니다.`);
      } else {
        finalHtml = this.appendReferences(htmlContent, references);
      }

      onProgress?.("본문 내용 작성 중...");
      await editor.enterContent(finalHtml);
      await page.waitForTimeout(1000);

      // 5. 최종 발행
      onProgress?.("태그 설정 및 최종 발행 중...");
      const publicationManager = new NaverPublicationManager(page);
      await publicationManager.publish(tags, category);

      onProgress?.("블로그 발행 완료");
      console.log("✅ 작성 및 발행 완료!");
      
    } catch (error: any) {
      console.error("❌ 네이버 발행 오류:", error);
      if (page) this.logError(title, error, page.url());
      throw error;
    } finally {
      if (this.currentContext) {
        onProgress?.("💾 세션 데이터 저장을 위해 잠시 대기합니다...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await this.currentContext.close();
        this.currentContext = null;
        onProgress?.("👋 브라우저 안전 종료 완료");
      }
    }
  }
}