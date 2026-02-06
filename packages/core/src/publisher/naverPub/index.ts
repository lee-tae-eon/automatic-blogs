/// <reference lib="dom" />
import { chromium, Page, BrowserContext } from "playwright";
import path from "path";
import fs from "fs";
import { findProjectRoot } from "../../util/findProjectRoot";
import { NaverAuthenticator } from "./NaverAuthenticator";
import { NaverEditor } from "./NaverEditor";
import { NaverPublicationManager } from "./NaverPublicationManager";

export interface NaverPostInput {
  blogId: string;
  title: string;
  htmlContent: string;
  password?: string;
  tags?: string[];
  category?: string;
  references?: { name: string; url: string }[];
  persona?: string; // 추가
  tone?: string;    // 추가
  onProgress?: (message: string) => void;
  headless?: boolean;
}

export class NaverPublisher {
  private userDataDir: string;
  private projectRoot: string;
  private currentContext: BrowserContext | null = null;

  constructor(customProjectRoot?: string) {
    this.projectRoot = customProjectRoot || findProjectRoot(__dirname);
    this.userDataDir = path.join(this.projectRoot, ".auth/naver");

    // ✅ 디렉토리가 없으면 미리 생성 (권한 및 존재 확인)
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

  // ✅ 2. 출처를 HTML로 변환하는 프라이빗 메서드
  private appendReferences(
    html: string,
    references?: { name: string; url: string }[],
  ): string {
    if (!references || references.length === 0) return html;

    const refHtml = `
      <br><hr><br>
      <p><strong>🔗 참고 자료 및 최신 뉴스 출처</strong></p>
      <ul>
        ${references
          .map(
            (ref) =>
              `<li><a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.name} 기사 원문 보기</a></li>`,
          )
          .join("")}
      </ul>
    `;
    return html + refHtml;
  }

  async postToBlog({
    blogId,
    title,
    htmlContent,
    password,
    tags = [],
    category,
    references,
    persona,  // ✅ 누락되었던 변수 추가
    tone,     // ✅ 누락되었던 변수 추가
    onProgress,
    headless = false,
  }: NaverPostInput) {
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let currentTaskName = title;

    try {
      onProgress?.("브라우저 실행 중...");

      // ✅ 실행 환경에 따라 브라우저 경로 설정 (Electron 패키징 대응)
      const launchOptions: any = {
        headless: headless,
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

      // 1. PLAYWRIGHT_BROWSERS_PATH가 설정되어 있다면, 해당 폴더 내에서 실행 파일을 직접 탐색
      if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
        const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;

        // 운영체제별 크로미움 실행 파일 상대 경로 정의
        let executableRelativePath = "";
        if (process.platform === "darwin") {
          // macOS: ms-playwright/chromium-XXXX/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
          // glob을 사용하기 어려우므로 폴더 구조를 직접 탐색하거나 예측해야 함
          try {
            const chromiumFolders = fs
              .readdirSync(browserRoot)
              .filter((f) => f.startsWith("chromium-"));
            if (chromiumFolders.length > 0) {
              const chromeAppDir = fs
                .readdirSync(path.join(browserRoot, chromiumFolders[0]))
                .find((f) => f.startsWith("chrome-mac"));
              if (chromeAppDir) {
                executableRelativePath = path.join(
                  chromiumFolders[0],
                  chromeAppDir,
                  "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
                );
              }
            }
          } catch (e) {
            console.error("📂 브라우저 폴더 탐색 실패:", e);
          }
        } else if (process.platform === "win32") {
          // Windows: ms-playwright/chromium-XXXX/chrome-win/chrome.exe
          try {
            const chromiumFolders = fs
              .readdirSync(browserRoot)
              .filter((f) => f.startsWith("chromium-"));
            if (chromiumFolders.length > 0) {
              executableRelativePath = path.join(
                chromiumFolders[0],
                "chrome-win",
                "chrome.exe",
              );
            }
          } catch (e) {
            console.error("📂 브라우저 폴더 탐색 실패:", e);
          }
        }

        const fullExecutablePath = path.join(
          browserRoot,
          executableRelativePath,
        );
        if (fs.existsSync(fullExecutablePath)) {
          launchOptions.executablePath = fullExecutablePath;
          console.log(
            `🚀 커스텀 브라우저 실행 경로 사용: ${fullExecutablePath}`,
          );
        } else {
          console.warn(
            `⚠️ 브라우저를 찾을 수 없음 (기본 경로 시도): ${fullExecutablePath}`,
          );
        }
      }

      this.currentContext = await chromium.launchPersistentContext(
        this.userDataDir,
        launchOptions,
      );

      context = this.currentContext;
      page = await context.newPage();

      page.on("dialog", async (dialog) => {
        const message = dialog.message();
        console.log(`🔔 다이얼로그 감지: ${message}`);
        await dialog.accept();
        console.log("   ✅ 다이얼로그 자동 승인");
      });

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
          console.log(
            "👉 로그인이 필요합니다. 브라우저에서 로그인을 완료해 주세요 (2분 대기).",
          );
        }
        await page.waitForURL("https://blog.naver.com/**", { timeout: 120000 });
        onProgress?.("로그인 완료 (세션 저장 중...)");

        // 세션이 디스크에 기록될 시간을 벌어줌
        await page.waitForTimeout(3000);

        await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
      }

      // ✅ 3. 본문 입력 전 출처 섹션 결합
      const editor = new NaverEditor(page, this.projectRoot, title, tags);
      onProgress?.("임시 저장 팝업 제거 중...");
      await editor.clearPopups();

      onProgress?.("에디터 초기화 및 제목 입력 중...");
      await page.waitForTimeout(2000);

      await editor.enterTitle(title);
      await page.waitForTimeout(1000);

      // ✅ [Persona-based Exclusion] 특정 페르소나는 톤과 상관없이 출처 기재 제외
      // 대상: 친근형(friendly), 스토리텔링형(storytelling), 체험형(experiential)
      const excludedPersonas = ["friendly", "storytelling", "experiential"];
      const shouldExcludeRef = persona && excludedPersonas.includes(persona);
      
      let finalHtml = htmlContent;
      if (shouldExcludeRef) {
        console.log(`ℹ️ [NaverPublisher] '${persona}' 페르소나는 출처 기재를 일괄 제외합니다.`);
      } else {
        console.log(`✅ [NaverPublisher] '${persona}' 페르소나에 출처 링크를 결합합니다.`);
        finalHtml = this.appendReferences(htmlContent, references);
      }

      onProgress?.("본문 내용 작성 중...");
      await editor.enterContent(finalHtml);
      await page.waitForTimeout(1000);

      onProgress?.("태그 설정 및 최종 발행 중...");
      const publicationManager = new NaverPublicationManager(page);
      await publicationManager.publish(tags, category);

      onProgress?.("블로그 발행 완료");
      console.log("✅ 작성 및 발행 완료!");
    } catch (error: any) {
      console.error("❌ 네이버 발행 오류:", error);
      if (page) {
        const logPath = path.join(process.cwd(), "error-log.txt");
        const timestamp = new Date().toLocaleString("ko-KR");
        const errorEntry = `\n==================================================\n[${timestamp}]\n📍 대상 포스트: ${currentTaskName}\n❌ 에러 메시지: ${error.message || error}\n🔗 발생 URL: ${page.url()}\n--------------------------------------------------\n`;
        try {
          fs.appendFileSync(logPath, errorEntry, "utf8");
          console.log(`📝 에러 로그 저장 완료: ${logPath}`);
        } catch (err) {
          console.error("💾 로그 파일 저장 실패:", err);
        }
      }
      throw error;
    } finally {
      if (context) {
        onProgress?.("💾 세션 데이터 저장을 위해 잠시 대기합니다...");
        // ⚠️ 중요: 브라우저가 쿠키/스토리지를 디스크에 쓸 시간을 3~5초 정도 줍니다.
        await new Promise((resolve) => setTimeout(resolve, 3000));

        await context.close();
        this.currentContext = null;
        onProgress?.("👋 브라우저 안전 종료 완료");
      }
    }
  }
}
