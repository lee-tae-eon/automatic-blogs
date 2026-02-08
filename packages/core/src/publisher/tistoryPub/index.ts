import { chromium, Page, BrowserContext } from "playwright";
import path from "path";
import fs from "fs";
import { findProjectRoot } from "../../util/findProjectRoot";
import { IBlogPublisher, PublishOptions } from "../interface";
import { Publication } from "../../types/blog";

export class TistoryPublisher implements IBlogPublisher {
  private userDataDir: string;
  private projectRoot: string;
  private currentContext: BrowserContext | null = null;

  constructor(customProjectRoot?: string) {
    this.projectRoot = customProjectRoot || findProjectRoot(__dirname);
    this.userDataDir = path.join(this.projectRoot, ".auth/tistory");

    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }
  }

  async stop() {
    if (this.currentContext) {
      await this.currentContext.close();
      this.currentContext = null;
    }
  }

  private getExecutablePath(): string | undefined {
    const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (!browserRoot) return undefined;
    try {
      const chromiumFolders = fs.readdirSync(browserRoot).filter((f) => f.startsWith("chromium-"));
      if (chromiumFolders.length === 0) return undefined;
      let relativePath = "";
      const latestFolder = chromiumFolders[0];
      if (process.platform === "darwin") {
        const chromeAppDir = fs.readdirSync(path.join(browserRoot, latestFolder)).find((f) => f.startsWith("chrome-mac"));
        if (chromeAppDir) {
          relativePath = path.join(latestFolder, chromeAppDir, "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
        }
      } else if (process.platform === "win32") {
        relativePath = path.join(latestFolder, "chrome-win", "chrome.exe");
      }
      const fullPath = path.join(browserRoot, relativePath);
      return fs.existsSync(fullPath) ? fullPath : undefined;
    } catch (e) {
      return undefined;
    }
  }

  private async initializeContext(headless: boolean): Promise<Page> {
    const launchOptions: any = {
      headless,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-setuid-sandbox"],
      permissions: ["clipboard-read", "clipboard-write"],
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    };

    const customPath = this.getExecutablePath();
    if (customPath) launchOptions.executablePath = customPath;

    this.currentContext = await chromium.launchPersistentContext(this.userDataDir, launchOptions);
    const page = await this.currentContext.newPage();
    
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    return page;
  }

  async publish(options: PublishOptions, post: Publication): Promise<void> {
    const { blogId, password, onProgress, headless = false } = options;
    const { title, content, tags = [] } = post;
    let page: Page | null = null;

    try {
      onProgress?.("티스토리 브라우저 실행 중...");
      page = await this.initializeContext(headless);

      // 1. 티스토리 로그인 및 관리자 페이지 진입
      onProgress?.("티스토리 접속 및 로그인 확인 중...");
      await page.goto(`https://www.tistory.com/auth/login`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);

      // 로그인 상태가 아니면 사용자 개입 또는 자동 로그인 시도
      if (page.url().includes("auth/login")) {
        onProgress?.("⚠️ 로그인이 필요합니다. (카카오 계정 로그인을 진행해 주세요)");
        // 카카오 로그인은 보안상 수동 로그인을 권장하며 2분간 대기합니다.
        // 만약 password가 있다면 자동 입력을 시도해볼 수 있으나, 카카오의 경우 봇 감지가 강력합니다.
        await page.waitForURL(`https://www.tistory.com/`, { timeout: 120000 });
      }

      onProgress?.("에디터 페이지로 이동 중...");
      await page.goto(`https://${blogId}.tistory.com/manage/post`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      // 3. 제목 및 본문 입력 (티스토리 에디터 구조에 맞춘 조작)
      // 티스토리 에디터는 iframe 또는 contenteditable 구조이므로 신중한 접근 필요
      // 여기서는 가장 안정적인 방식인 '마크다운' 모드 전환 또는 직접 입력을 시뮬레이션
      onProgress?.("콘텐츠 작성 중...");
      
      // 제목 입력
      await page.fill('input[name="title"]', title);
      
      // 본문 입력 (에디터 영역 클릭 후 타이핑 또는 붙여넣기)
      // 티스토리 스마트에디터는 복잡하므로 간단한 텍스트 주입 로직 우선 시도
      await page.click('#editor-root [contenteditable="true"]');
      await page.evaluate((html) => {
        const editor = document.querySelector('#editor-root [contenteditable="true"]');
        if (editor) editor.innerHTML = html;
      }, content);

      // 4. 태그 입력
      if (tags.length > 0) {
        onProgress?.("태그 설정 중...");
        await page.fill('#tagText', tags.join(","));
        await page.keyboard.press("Enter");
      }

      // 5. 발행 버튼 클릭
      onProgress?.("발행 버튼 클릭 중...");
      await page.click('.btn_primitive.btn_post'); // 완료 버튼
      await page.waitForTimeout(1000);
      await page.click('#publish-button'); // 실제 발행 버튼 (셀렉터는 실제와 다를 수 있음)

      onProgress?.("티스토리 발행 완료");
      await page.waitForTimeout(3000);

    } catch (error: any) {
      console.error("❌ 티스토리 발행 오류:", error);
      throw error;
    } finally {
      if (this.currentContext) {
        await this.currentContext.close();
        this.currentContext = null;
      }
    }
  }
}
