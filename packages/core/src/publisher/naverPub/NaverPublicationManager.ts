/// <reference lib="dom" />
import { Page } from "playwright";

export class NaverPublicationManager {
  constructor(private page: Page) {}

  public async publish(tags: string[] = [], category?: string) {
    console.log("\n🚀 발행 프로세스 시작...");

    try {
      await this.page.evaluate(() => window.scrollTo(0, 0));
      await this.page.keyboard.press("Escape");
      await this.page.waitForTimeout(500);

      // 1. 상단 '발행' 버튼 클릭 시도
      const publishButtonSelectors = [
        "button[class*='publish_btn']",
        'button:has-text("발행")',
        ".btn_publish",
        '[data-testid="publish-button"]',
      ];

      let publishButton = null;
      for (const selector of publishButtonSelectors) {
        try {
          publishButton = await this.page.waitForSelector(selector, {
            state: "visible",
            timeout: 3000,
          });
          if (publishButton) break;
        } catch (e) { continue; }
      }

      if (!publishButton) {
        publishButton = await this.page.locator("button").filter({ hasText: "발행" }).first();
      }

      await publishButton.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(500);
      await publishButton.click({ force: true });
      await this.page.waitForTimeout(1500);

      // 2. 발행 설정 레이어 찾기
      const layerSelectors = [
        "div[class*='publish_layer']",
        ".publish_layer_container",
        ".section_publish",
        "div[role='dialog']",
      ];

      let layerFound = false;
      let layerSelector = "";

      for (const selector of layerSelectors) {
        try {
          const element = await this.page.waitForSelector(selector, {
            state: "visible",
            timeout: 2000,
          });
          if (element) {
            layerSelector = selector;
            layerFound = true;
            break;
          }
        } catch (e) { continue; }
      }

      if (!layerFound) {
        console.warn("   ⚠️ 발행 설정 레이어를 찾을 수 없음. 기본 바디에서 시도...");
        layerSelector = "body";
      }

      // 3. 카테고리 설정
      if (category) {
        try {
          // 카테고리 영역 텍스트로 찾기
          const categoryGroup = this.page.locator(`${layerSelector} .form_group, ${layerSelector} div`).filter({ hasText: "카테고리" }).first();
          const categoryTrigger = categoryGroup.locator("button, select").first();

          if (await categoryTrigger.isVisible({ timeout: 3000 })) {
            const tagName = await categoryTrigger.evaluate(el => el.tagName.toUpperCase());
            
            if (tagName === "SELECT") {
              await categoryTrigger.selectOption({ label: category });
            } else {
              await categoryTrigger.click({ force: true });
              await this.page.waitForTimeout(500);
              
              // 드롭다운에서 정확한 카테고리명 찾기 (정규식 사용)
              const categoryItem = this.page.locator("li, div").filter({ hasText: new RegExp(`^${category}$|^${category}\\s*\\(`) }).last();
              await categoryItem.click({ force: true });
            }
            console.log(`   ✅ 카테고리 설정 완료: ${category}`);
          }
        } catch (e) {
          console.warn(`   ⚠️ 카테고리 설정 중 오류 (무시하고 진행): ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // 4. 태그 입력
      if (tags && tags.length > 0) {
        try {
          // 태그 입력창 찾기 (더 넓은 범위의 셀렉터)
          const tagInputSelectors = [
            "input[placeholder*='태그']",
            ".tag_input",
            "div[contenteditable='true'][aria-placeholder*='태그']",
            "input[class*='tag']"
          ];

          let tagInput = null;
          for (const sel of tagInputSelectors) {
            try {
              tagInput = await this.page.waitForSelector(`${layerSelector} ${sel}`, { timeout: 1500 });
              if (tagInput) break;
            } catch (e) { continue; }
          }

          if (tagInput) {
            await tagInput.click({ force: true });
            await this.page.waitForTimeout(300);
            
            for (const tag of tags.slice(0, 10)) { // 최대 10개
              const cleanTag = tag.replace(/[^a-zA-Z0-9가-힣]/g, "");
              if (cleanTag.length > 0) {
                await this.page.keyboard.type(cleanTag, { delay: 30 });
                await this.page.keyboard.press("Enter");
                await this.page.waitForTimeout(100);
              }
            }
            console.log(`   ✅ 태그 입력 완료 (${tags.length}개)`);
          }
        } catch (e) {
          console.warn("   ⚠️ 태그 입력 실패 (무시하고 진행)");
        }
      }

      // 5. 최종 '발행' 버튼 클릭
      console.log("   🖱️ 최종 발행 버튼 클릭 시도...");
      const finalPublishBtn = this.page.locator(`${layerSelector} button`).filter({ hasText: /^발행$/ }).last();
      
      await finalPublishBtn.waitFor({ state: "visible", timeout: 5000 });
      await finalPublishBtn.click({ force: true });

      // 6. 결과 확인
      await this.page.waitForTimeout(3000);
      const currentUrl = this.page.url();
      if (!currentUrl.includes("postwrite")) {
        console.log("✅ 발행 성공! (페이지 이동 감지)");
      } else {
        console.log("ℹ️ 발행 버튼 클릭 완료 (작성 페이지 체류 중, 발행 여부 확인 필요)");
      }

    } catch (error) {
      console.error("❌ 발행 프로세스 실패:", error);
      throw error;
    }
  }
}