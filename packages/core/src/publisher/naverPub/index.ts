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
  onProgress?: (message: string) => void;
}

export class NaverPublisher {
  private userDataDir: string;
  private projectRoot: string;
  private currentContext: BrowserContext | null = null;

  constructor() {
    this.projectRoot = findProjectRoot(__dirname);
    this.userDataDir = path.join(this.projectRoot, ".auth/naver");
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
      <blockquote>
        <p><strong>🔗 참고 자료 및 최신 뉴스 출처</strong></p>
        <ul style="list-style-type: disc;">
          ${references
            .map(
              (ref) =>
                `<li><a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.name} 기사 원문 보기</a></li>`,
            )
            .join("")}
        </ul>
      </blockquote>
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
    onProgress,
  }: NaverPostInput) {
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let currentTaskName = title;

    try {
      onProgress?.("브라우저 실행 중...");
      this.currentContext = await chromium.launchPersistentContext(this.userDataDir, {
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
        permissions: ["clipboard-read", "clipboard-write"],
      });

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
        onProgress?.("로그인 완료");
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

      // 2. ✅ 본문 입력 전: '본문 + 출처' 합치기
      const finalHtml = this.appendReferences(htmlContent, references);

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
        await context.close();
      }
    }
  }
}
