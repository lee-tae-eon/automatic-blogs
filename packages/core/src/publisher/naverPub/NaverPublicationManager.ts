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

      const publishButtonSelectors = [
        "button.publish_btn__m2fHR",
        'button:has-text("발행")',
        ".btn_publish",
        'button[class*="publish"]',
        '[data-testid="publish-button"]',
      ];

      let publishButton = null;
      for (const selector of publishButtonSelectors) {
        try {
          publishButton = await this.page.waitForSelector(selector, {
            state: "visible",
            timeout: 3000,
          });
          if (publishButton) {
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!publishButton) {
        publishButton = await this.page
          .locator("button")
          .filter({ hasText: "발행" })
          .first();
      }

      await publishButton.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(500);

      try {
        await publishButton.click({ timeout: 5000 });
      } catch (e) {
        console.warn("   ⚠️ 일반 클릭 실패, JS 주입 클릭 시도...");
        await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("button"));
          const publishBtn = buttons.find(
            (btn) =>
              btn.textContent?.includes("발행") ||
              btn.className.includes("publish"),
          );
          if (publishBtn) {
            (publishBtn as HTMLElement).click();
          }
        });
      }

      await this.page.waitForTimeout(1000);

      const layerSelectors = [
        ".publish_layer_container",
        ".publish_layer",
        ".section_publish",
        '[class*="publish"][class*="layer"]',
        '[class*="PublishLayer"]',
      ];

      let layerFound = false;
      let layerSelector = "";

      for (const selector of layerSelectors) {
        try {
          const element = await this.page.waitForSelector(selector, {
            state: "visible",
            timeout: 3000,
          });
          if (element) {
            layerSelector = selector;
            layerFound = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!layerFound) {
        console.warn("   ⚠️ 레이어를 찾을 수 없음. 기본 진행...");
        layerSelector = "body";
      }

      if (category) {
        try {
          const categoryTrigger = this.page.locator(
            [
              `${layerSelector} .form_group:has-text(\"카테고리\") button`,
              `${layerSelector} .form_group:has-text(\"카테고리\") select`,
              `${layerSelector} [class*=\"category\"] button`,
              `${layerSelector} [class*=\"category\"] select`,
            ].join(", "),
          );

          if (!(await categoryTrigger.first().isVisible({ timeout: 3000 }))) {
            throw new Error("카테고리 선택 UI를 찾을 수 없습니다.");
          }

          const selectElement = categoryTrigger.first();
          const tagName = await selectElement.evaluate((el) =>
            el.tagName.toUpperCase(),
          );

          if (tagName === "SELECT") {
            await selectElement.selectOption({ label: category });
          } else {
            await selectElement.click();
            await this.page.waitForTimeout(300);

            const categoryItem = this.page
              .getByText(new RegExp(`^${category}(\\s*\\(\\d+\\))?$`))
              .first();

            try {
              await categoryItem.waitFor({ state: "visible", timeout: 5000 });
              await categoryItem.click();
            } catch (e) {
              console.warn(
                `   ⚠️ 드롭다운에서 [${category}] 항목을 찾을 수 없거나 클릭에 실패했습니다.`, 
              );
              await this.page.keyboard.press("Escape").catch(() => {});
            }
          }
          console.log(`   ✅ 카테고리 설정 완료: ${category}`);
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.warn(`   ⚠️ 카테고리 선택 실패: ${errorMessage}`);
        }
      }

      if (tags && tags.length > 0) {
        try {
          const tagInput = await this.page.waitForSelector(
            `${layerSelector} input[placeholder*=\"태그\"], .tag_input`,
            { timeout: 3000 },
          );

          if (tagInput) {
            await tagInput.click({ force: true });
            for (const tag of tags) {
              const cleanTag = tag.replace(/[^a-zA-Z0-9가-힣]/g, "");
              if (cleanTag.length > 0) {
                await this.page.keyboard.type(cleanTag, { delay: 50 });
                await this.page.keyboard.press("Enter");
                await this.page.waitForTimeout(50);
              }
            }
            console.log(`   ✅ 태그 입력 완료 (${tags.length}개)`);
          }
        } catch (e) {
          console.warn(`   ⚠️ 태그 입력 실패:`, e);
        }
      }

      let published = false;

      try {
        const finalBtn = this.page
          .locator(`${layerSelector} button`)
          .filter({ hasText: /^발행$/ })
          .filter({ visible: true })
          .first();

        await finalBtn.waitFor({ state: "visible", timeout: 5000 });
        await finalBtn.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(500);
        await finalBtn.click({ force: true });
        published = true;
      } catch (e) {
        console.error("   ❌ 일반 클릭 실패, JS 주입으로 강제 클릭 시도...");
        const jsSuccess = await this.page.evaluate((selector) => {
          const buttons = Array.from(
            document.querySelectorAll(`${selector} button`),
          );
          const realPublishBtn = buttons.find((btn) => {
            const style = window.getComputedStyle(btn);
            return (
              btn.textContent?.trim() === "발행" &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              (btn as HTMLButtonElement).disabled === false
            );
          });

          if (realPublishBtn) {
            (realPublishBtn as HTMLElement).click();
            return true;
          }
          return false;
        }, layerSelector);

        if (jsSuccess) {
          published = true;
        }
      }

      if (!published) {
        throw new Error(
          "발행 버튼을 찾을 수 없거나 클릭에 실패했습니다 (모든 시도 실패)",
        );
      }

      await this.page.waitForTimeout(1500);

      try {
        await this.page.waitForURL(/.*\/\d+/, { timeout: 10000 });
        console.log("✅ 발행 완료! 포스트 URL로 이동됨");
      } catch (e) {
        const currentUrl = this.page.url();
        if (currentUrl.includes("/postwrite")) {
          console.warn("   ⚠️ 아직 작성 페이지에 있음. 발행 상태 불명확");
        } else {
          console.log("✅ 발행 완료 (URL 변경 감지)");
        }
      }
    } catch (error) {
      console.error("❌ 발행 프로세스 실패:", error);

      try {
        await this.page.screenshot({
          path: `publish-error-${Date.now()}.png`,
          fullPage: true,
        });
        console.log("   📸 에러 스크린샷 저장됨");
      } catch (e) {
        // 스크린샷 실패는 무시
      }

      throw error;
    }
  }
}
