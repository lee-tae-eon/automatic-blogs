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

      // ✅ 3. 로그인 상태 유지 체크 (Persistence 강화)
      try {
        // 여러 가능한 셀렉터 시도
        const keepSelectors = ["label[for='keep']", "#keep", ".keep_check"];
        let clicked = false;
        for (const selector of keepSelectors) {
          const el = await this.page.$(selector);
          if (el && await el.isVisible()) {
            await el.click();
            clicked = true;
            console.log(`   📌 로그인 상태 유지 체크 완료 (Selector: ${selector})`);
            break;
          }
        }
        if (!clicked) console.warn("   ⚠️ 로그인 상태 유지 체크박스를 찾지 못했습니다.");
      } catch (e) {
        console.warn("   ⚠️ 로그인 상태 유지 처리 중 오류:", e);
      }

      const loginButtonSelector = ".btn_login";
      await this.page.waitForSelector(loginButtonSelector, { timeout: 5000 });
      await this.page.click(loginButtonSelector);

      // ✅ 4. 로그인 후 "이 기기를 등록하시겠습니까?" 팝업 처리
      try {
        // 팝업이 나타날 때까지 짧게 대기
        await this.page.waitForTimeout(2000);
        
        // "등록" 버튼 (id="new.save") 또는 "저장" 버튼 탐색
        const registerBtnSelector = "#new\\.save"; // 네이버 기기등록 버튼 ID
        if (await this.page.$(registerBtnSelector)) {
          await this.page.click(registerBtnSelector);
          console.log("   ✅ 이 기기 등록(저장) 완료");
        }
      } catch (e) {
        // 팝업이 안 뜨는 경우(이미 등록된 경우 등)는 정상 진행
      }

      console.log("   ✅ 네이버 로그인 시도 완료");
    } catch (error) {
      console.error("❌ 자동 로그인 실패:", error);
      throw new Error("자동 로그인 실패. 수동으로 로그인해주세요.");
    }
  }
}