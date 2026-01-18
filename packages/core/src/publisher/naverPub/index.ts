// packages/core/src/publisher/naverPublisher.ts

import { chromium } from "playwright";
import path from "path";

export class NaverPublisher {
  private userDataDir: string = path.join(process.cwd(), "../../.auth/naver");

  async postToBlog(blogId: string, title: string, htmlContent: string) {
    // context와 page는 playwright가 자동으로 타입을 추론해줍니다.
    const context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: false, // 직접 눈으로 확인하며 진행
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const page = await context.newPage();

    try {
      // 1. 글쓰기 페이지 진입
      await page.goto(`https://blog.naver.com/${blogId}/postwrite`);

      // 2. 로그인 세션 체크
      if (page.url().includes("nid.naver.com")) {
        console.log(
          "👉 로그인이 필요합니다. 브라우저에서 로그인을 완료해 주세요 (2분 대기).",
        );
        await page.waitForURL("**/postwrite**", { timeout: 120000 });
      }

      console.log("📝 에디터 로딩 중...");
      // 가끔 뜨는 도움말 팝업 닫기
      await page.keyboard.press("Escape");

      // 3. 제목 입력
      const titleSelector =
        ".se-placeholder.__se_placeholder.se-ff-nanumbarungothic";
      await page.waitForSelector(titleSelector);
      await page.click(titleSelector);
      await page.keyboard.type(title);
      console.log("✅ 제목 입력 완료");

      // 4. 본문 주입 (중요: 에디터 영역 클릭 후 주입)
      await page.click(".se-content");
      await page.evaluate((html: string) => {
        const editor = document.querySelector(".se-content");
        if (editor) {
          editor.innerHTML = html;
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }, htmlContent);
      console.log("✅ 본문 주입 완료");

      console.log(
        "🚀 모든 작업이 끝났습니다. 브라우저에서 '발행' 버튼을 직접 눌러보세요!",
      );
    } catch (error) {
      console.error("❌ 네이버 발행 오류:", error);
    }
  }
}
