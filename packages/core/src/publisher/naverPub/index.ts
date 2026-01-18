import { chromium, BrowserContext, Page } from "playwright";
import path from "path";

export class NaverPublisher {
  private userDataDir: string;

  constructor() {
    // 로그인 세션을 저장할 폴더 경로 (루트의 .auth 폴더)
    this.userDataDir = path.join(process.cwd(), "../../.auth/naver");
  }

  /**
   * 브라우저를 실행하고 로그인 세션을 유지한 채로 페이지를 엽니다.
   */
  async getContext(): Promise<BrowserContext> {
    return await chromium.launchPersistentContext(this.userDataDir, {
      headless: false, // 눈으로 확인하기 위해 false로 설정
      args: ["--disable-blink-features=AutomationControlled"], // 자동화 탐지 우회
    });
  }

  /**
   * 네이버 블로그 글쓰기 페이지로 이동합니다.
   */
  async postToBlog(title: string, htmlContent: string) {
    const context = await this.getContext();
    const page = await context.newPage();

    try {
      // 1. 네이버 블로그 글쓰기 주소로 이동
      await page.goto("https://blog.naver.com/내아이디/postwrite");

      // 2. 로그인 여부 확인 (로그인이 안 되어 있다면 여기서 멈추고 수동 로그인 필요)
      if (page.url().includes("nid.naver.com")) {
        console.log(
          "⚠️ 로그인이 필요합니다. 브라우저에서 로그인을 완료해 주세요.",
        );
        // 사용자가 로그인할 때까지 대기하거나 안내 후 종료
        return;
      }

      console.log("📝 글쓰기 에디터 진입 중...");

      // 네이버 스마트에디터는 iframe이나 복잡한 구조로 되어 있어
      // 추가적인 셀렉터 작업이 필요합니다. (다음 단계에서 진행)
    } catch (error) {
      console.error("Naver Publish Error:", error);
    }
  }
}
