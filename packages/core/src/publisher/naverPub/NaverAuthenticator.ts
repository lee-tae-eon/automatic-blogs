import { Page } from "playwright";

export class NaverAuthenticator {
  constructor(private page: Page) {}

  public async login(id: string, pw: string) {
    try {
      console.log("🔐 로그인 진행 중...");

      const isMac = process.platform === "darwin";
      const pasteKey = isMac ? "Meta+V" : "Control+V";

      await this.page.waitForSelector("#id", { timeout: 10000 });

      console.log("   아이디 입력 중...");
      await this.page.click("#id");
      await this.page.evaluate((text) => {
        return navigator.clipboard.writeText(text);
      }, id);
      await this.page.waitForTimeout(500);
      await this.page.keyboard.press(pasteKey);
      await this.page.waitForTimeout(800);

      const idValue = await this.page.inputValue("#id");
      console.log(`   입력된 아이디: ${idValue}`);

      console.log("   비밀번호 입력 중...");
      await this.page.click("#pw");
      await this.page.evaluate((text) => {
        return navigator.clipboard.writeText(text);
      }, pw);
      await this.page.waitForTimeout(500);
      await this.page.keyboard.press(pasteKey);
      await this.page.waitForTimeout(800);

      const loginButtonSelector = ".btn_login";
      await this.page.waitForSelector(loginButtonSelector, { timeout: 5000 });
      await this.page.click(loginButtonSelector);

      console.log("   ✅ 로그인 버튼 클릭 완료, 리다이렉트 대기 중...");
    } catch (error) {
      console.error("❌ 자동 로그인 실패:", error);
      throw new Error("자동 로그인 실패. 수동으로 로그인해주세요.");
    }
  }
}