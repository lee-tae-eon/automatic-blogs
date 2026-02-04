import { Page } from "playwright";

export class NaverAuthenticator {
  constructor(private page: Page) {}

  public async login(id: string, pw: string) {
    try {
      console.log("🔐 로그인 진행 중...");

      const isMac = process.platform === "darwin";
      const pasteKey = isMac ? "Meta+V" : "Control+V";

      await this.page.waitForSelector("#id", { timeout: 10000 });

      await this.page.click("#id");
      await this.page.evaluate((text) => {
        return navigator.clipboard.writeText(text);
      }, id);
      await this.page.waitForTimeout(500);
      await this.page.keyboard.press(pasteKey);
      await this.page.waitForTimeout(800);

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

      console.log("   ✅ 네이버 로그인 시도 완료");
    } catch (error) {
      console.error("❌ 자동 로그인 실패:", error);
      throw new Error("자동 로그인 실패. 수동으로 로그인해주세요.");
    }
  }
}