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
}

export class NaverPublisher {
  private userDataDir: string;
  private projectRoot: string;

  constructor() {
    this.projectRoot = findProjectRoot(__dirname);
    this.userDataDir = path.join(this.projectRoot, ".auth/naver");
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
  }: NaverPostInput) {
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let currentTaskName = title;

    try {
      context = await chromium.launchPersistentContext(this.userDataDir, {
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
        permissions: ["clipboard-read", "clipboard-write"],
      });

      page = await context.newPage();

      page.on("dialog", async (dialog) => {
        const message = dialog.message();
        console.log(`🔔 다이얼로그 감지: ${message}`);
        await dialog.accept();
        console.log("   ✅ 다이얼로그 자동 승인");
      });

      console.log("🌐 글쓰기 페이지로 이동 중...");
      await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await page.waitForTimeout(2000);

      if (page.url().includes("nid.naver.com")) {
        console.log("🔐 로그인 필요 감지");
        if (password) {
          const authenticator = new NaverAuthenticator(page);
          await authenticator.login(blogId, password);
        } else {
          console.log(
            "👉 로그인이 필요합니다. 브라우저에서 로그인을 완료해 주세요 (2분 대기).",
          );
        }
        await page.waitForURL("https://blog.naver.com/**", { timeout: 120000 });
        console.log("✅ 로그인 완료 감지");
        await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
      }

      // ✅ 3. 본문 입력 전 출처 섹션 결합
      const editor = new NaverEditor(page, this.projectRoot);
      await editor.clearPopups();

      console.log("⏳ 에디터 로딩 대기 중...");
      await page.waitForTimeout(2000);

      await editor.enterTitle(title);
      await page.waitForTimeout(1000);

      // 2. ✅ 본문 입력 전: '본문 + 출처' 합치기
      const finalHtml =
        htmlContent + this.appendReferences(htmlContent, references);

      await editor.enterContent(finalHtml);
      await page.waitForTimeout(1000);

      const publicationManager = new NaverPublicationManager(page);
      await publicationManager.publish(tags, category);

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
