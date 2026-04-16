import { chromium, Page, BrowserContext } from "playwright";
import path from "path";
import fs from "fs";
import { findProjectRoot } from "../../util/findProjectRoot";
import { NaverAuthenticator } from "./NaverAuthenticator";
import { NaverEditor } from "./NaverEditor";
import { NaverPublicationManager } from "./NaverPublicationManager";
import { IBlogPublisher, PublishOptions } from "../interface";
import { Persona, Publication, Tone } from "../../types/blog";
import { DbService } from "../../services/dbService";

/**
 * 네이버 블로그 발행을 위한 입력 데이터 인터페이스 (Legacy Support)
 */
export interface NaverPostInput {
  blogId: string;
  title: string;
  htmlContent: string;
  password?: string;
  tags?: string[];
  category: string;
  references?: { name: string; url: string }[];
  persona: Persona;
  tone: Tone;
  onProgress?: (message: string) => void;
  headless?: boolean;
  heroImagePath?: string; // 🍌 [v8.8] 대표 이미지 경로 추가
}

/**
 * NaverPublisher
 * 네이버 블로그 자동 발행을 총괄하는 오케스트레이터 클래스입니다.
 */
export class NaverPublisher implements IBlogPublisher {
  private userDataDir: string;
  private projectRoot: string;
  private currentContext: BrowserContext | null = null;
  private db: DbService;
  private naverId: string; // ✅ [v5.2.2] 계정 식별자 추가

  constructor(customProjectRoot?: string, userId: string = "default") {
    this.projectRoot = customProjectRoot || findProjectRoot(__dirname);
    this.naverId = userId; // ✅ [v5.2.2]
    // 유저별로 별도의 인증 디렉토리 설정
    this.userDataDir = path.join(this.projectRoot, `.auth/naver_${userId}`);
    this.db = new DbService(this.projectRoot);

    this.ensureAuthDirectory();
  }

  // ... (private methods remain unchanged)

  /**
   * 인증 정보가 저장될 디렉토리를 확인하고 없으면 생성합니다.
   */
  private ensureAuthDirectory() {
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
      console.log(
        `📂 [NaverPublisher] 인증 디렉토리 생성: ${this.userDataDir}`,
      );
    } else {
      console.log(
        `📂 [NaverPublisher] 기존 인증 디렉토리 사용: ${this.userDataDir}`,
      );
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
   * 개인 블로그(네이버, 티스토리 등)는 홍보 방지를 위해 엄격히 필터링합니다.
   */
  private appendReferences(
    html: string,
    references?: { name: string; url: string }[],
  ): string {
    // 🛡️ 필터링할 블로그, 커뮤니티 및 소셜 미디어 도메인 (정규표현식용)
    const blockedPatterns = [
      /blog/i,
      /cafe/i,
      /tistory/i,
      /brunch/i,
      /egloos/i,
      /post\.naver/i,
      /naver\.me/i,
      /daum\.net\/blog/i,
      /velog/i,
      /medium/i,
      /kakao/i,
      /dcinside/i,
      /ruliweb/i,
      /theqoo/i,
      /instiz/i,
      /fmkorea/i,
      /clien/i,
      /youtube/i,
      /youtu\.be/i,
      /facebook/i,
      /instagram/i,
      /twitter/i,
      /x\.com/i,
      /pstatic/i,
      /kakaocdn/i,
      /blogme\.me/i,
    ];

    // 1. [v5.1] 본문 내부의 출처 마커 제거 (예: [1], [뉴스], (매체명) 등)
    // AI가 지시를 어기고 본문에 남긴 찌꺼기를 정제합니다.
    const cleanHtml = html
      .replace(/\[\d+\]|\[뉴스\]|\[출처:.*?\]|\(\w+ 뉴스\)/gi, "")
      .trim();

    // 2. 유효한 출처 필터링 (이름/URL 존재 여부 + 블로그/커뮤니티 제외)
    const validRefs = (references || []).filter((ref) => {
      if (!ref || !ref.name?.trim() || !ref.url?.trim()) return false;

      const name = ref.name.toLowerCase();
      const url = ref.url.toLowerCase();

      // 차단 패턴 매칭 (도메인, 경로 및 매체명 체크)
      const isBlockedUrl =
        blockedPatterns.some((pattern) => pattern.test(url)) ||
        url.includes("/blog/") ||
        url.includes(".blog.") ||
        url.includes("naver.com/blog");
      const isBlockedName = /블로그|카페|brunch|티스토리|개인|포스트/i.test(
        name,
      );

      return !isBlockedUrl && !isBlockedName;
    });

    if (validRefs.length === 0) return cleanHtml;

    // 본문 내에 이미 '참고 자료' 섹션이 있는지 확인 (중복 방지)
    const lowerHtml = cleanHtml.toLowerCase();
    if (
      lowerHtml.includes("참고 자료") ||
      lowerHtml.includes("뉴스 출처") ||
      lowerHtml.includes("references")
    ) {
      console.log(
        "ℹ️ [NaverPublisher] 본문에 이미 출처 섹션이 포함되어 있어 추가를 건너뜁니다.",
      );
      return cleanHtml;
    }

    const refHtml = `
      <br><hr><br>
      <p style="font-size: 0.95rem; color: #666; margin-bottom: 15px;"><strong>🔗 참고 자료 및 뉴스 출처</strong></p>
      <ul style="list-style: none; padding-left: 0;">
        ${validRefs
          .map(
            (ref) =>
              `<li style="margin-bottom: 8px; font-size: 0.9rem; line-height: 1.5;">
                • <a href="${ref.url}" target="_blank" rel="noopener noreferrer" style="color: #03c75a; text-decoration: underline; font-weight: 500;">${ref.name}</a>
              </li>`,
          )
          .join("")}
      </ul>
    `;
    return cleanHtml + refHtml;
  }

  /**
   * 실행 환경(Electron/OS)에 따른 브라우저 실행 파일 경로를 탐색합니다.
   */
  private getExecutablePath(): string | undefined {
    const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (!browserRoot) return undefined;

    try {
      const chromiumFolders = fs
        .readdirSync(browserRoot)
        .filter((f) => f.startsWith("chromium-"));
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
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    };

    const customPath = this.getExecutablePath();
    if (customPath) {
      launchOptions.executablePath = customPath;
      console.log(`🚀 커스텀 브라우저 실행 경로 사용: ${customPath}`);
    }

    this.currentContext = await chromium.launchPersistentContext(
      this.userDataDir,
      launchOptions,
    );
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
  private async handleLogin(
    page: Page,
    blogId: string,
    password?: string,
    onProgress?: (msg: string) => void,
  ) {
    onProgress?.("네이버 블로그 접속 중...");
    await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    // 로그인이 안 되어 있거나 권한이 없는 경우, /postwrite 가 블로그 홈 등으로 리디렉션 됨
    if (
      !page.url().includes("postwrite") &&
      !page.url().includes("nid.naver.com")
    ) {
      onProgress?.(
        "세션이 없거나 권한이 없습니다. 로그인 페이지로 이동합니다...",
      );
      await page.goto("https://nid.naver.com/nidlogin.login", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);
    }

    if (page.url().includes("nid.naver.com")) {
      onProgress?.("네이버 로그인 진행 중...");
      if (password) {
        const authenticator = new NaverAuthenticator(page);
        try {
          await authenticator.login(blogId, password);
        } catch (e) {
          onProgress?.(
            "자동 로그인 실패. 수동 로그인을 시도해 주세요 (2분 대기).",
          );
        }
      } else {
        onProgress?.("수동 로그인이 필요합니다 (2분 대기)");
      }

      console.log(
        "👉 로그인이 필요합니다. 브라우저 창에서 로그인을 완료해 주세요 (2분 대기).",
      );

      // 로그인 완료 후 블로그 페이지로 이동할 때까지 충분히 대기 (최대 2분)
      await page.waitForURL("https://blog.naver.com/**", { timeout: 120000 });
      onProgress?.("로그인 확인 완료 (세션 저장 중...)");
      await page.waitForTimeout(3000);

      await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(2000);
    }

    // 최종적으로 현재 URL이 postwrite 에 들어왔는지 검증
    if (!page.url().includes("postwrite")) {
      console.warn(
        `⚠️ [NaverPublisher] '/postwrite' 권한 없음 또는 리디렉션 됨: ${page.url()}`,
      );
      throw new Error(
        `에디터 접속 실패. (현재 URL: ${page.url()}) 세션이 만료되었거나 권한이 없습니다. 계정 연결을 초기화하고 다시 로그인해주세요.`,
      );
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
   * [Legacy] 호환성을 위해 유지 (곧 Deprecated 예정)
   */
  async postToBlog(input: NaverPostInput) {
    // Legacy support wrapper
    const { blogId, password, headless, onProgress, ...rest } = input;

    // Publication 객체로 변환
    const post: Publication = {
      ...rest,
      content: rest.htmlContent, // htmlContent를 content로 매핑
      createdAt: new Date().toISOString(),
      persona: rest.persona,
      tone: rest.tone,
      category: rest.category,
      outline: [],
      metaDescription: "",
      metaTitle: "",
      focusKeywords: rest.tags || [],
      internalLinkSuggestions: [],
      heroImagePath: rest.heroImagePath, // 🍌 [v8.8] 대표 이미지 전달
    };

    return this.publish({ blogId, password, headless, onProgress }, post);
  }

  /**
   * [Interface Implementation] IBlogPublisher.publish 구현
   */
  async publish(options: PublishOptions, post: Publication): Promise<void> {
    const { blogId, password, onProgress, headless = false } = options;
    const { title, content, category, references, persona, heroImagePath } = post;

    // ✅ [v5.3] SEO: focusKeywords + lsiKeywords를 병합하여 최대 10개의 최적 태그 구성
    const rawTags = post.tags || [];
    const focusKw = post.focusKeywords || [];
    const lsiKw = post.lsiKeywords || [];
    const mergedTags = [...new Set([...rawTags, ...focusKw, ...lsiKw])]
      .map((t) => t.replace(/[^a-zA-Z0-9가-힣]/g, "").trim())
      .filter((t) => t.length > 0)
      .slice(0, 10);
    const tags = mergedTags;

    // 마크다운을 HTML로 변환하는 작업은 외부에서 수행되었다고 가정하거나 여기서 수행
    // NaverPublisher는 이미 HTML을 받는 것으로 설계되었으므로, content가 HTML이어야 함을 주의
    // 하지만 Publication 타입의 content는 마크다운일 수도 있음.
    // 기존 로직에서는 markdownToHtml이 호출된 상태로 넘어왔음.
    // 여기서는 content를 그대로 HTML로 간주하고 진행 (호출측 책임)
    const htmlContent = content;

    let page: Page | null = null;

    try {
      onProgress?.("브라우저 환경 준비 중...");
      page = await this.initializeContext(headless);

      // 1. 로그인 처리
      await this.handleLogin(page, blogId, password, onProgress);

      // 2. 에디터 진입 및 초기화
      const editor = new NaverEditor(
        page,
        this.projectRoot,
        title,
        tags,
        persona,
        heroImagePath,
      );
      onProgress?.("에디터 초기화 중...");
      await editor.clearPopups();
      await page.waitForTimeout(2000);

      // 3. 제목 입력
      await editor.enterTitle(title);
      await page.waitForTimeout(1000);

      // 4. 본문 구성 (페르소나 기반 출처 필터링 적용)
      const excludedPersonas = ["storytelling", "experiential"];
      const shouldExcludeRef = persona && excludedPersonas.includes(persona);

      let finalHtml = htmlContent;
      if (shouldExcludeRef) {
        console.log(
          `ℹ️ [NaverPublisher] '${persona}' 페르소나는 출처 기재를 일괄 제외합니다.`,
        );
      } else {
        finalHtml = this.appendReferences(htmlContent, references);
      }

      onProgress?.("본문 내용 작성 중...");
      await editor.enterContent(finalHtml);
      await page.waitForTimeout(1000);

      // 5. 최종 발행
      onProgress?.("태그 설정 및 최종 발행 중...");
      const publicationManager = new NaverPublicationManager(page);
      const publishedUrl = await publicationManager.publish(tags, category);

      // ✅ [v5.2.2] 발행 성공 정보 DB 저장 (계정 정보 포함)
      if (publishedUrl) {
        this.db.savePublishedPost(title, publishedUrl, tags, category || "", this.naverId);
      }

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
