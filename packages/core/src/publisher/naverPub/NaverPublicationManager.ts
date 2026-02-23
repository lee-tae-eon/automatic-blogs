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
        } catch (e) {
          continue;
        }
      }

      if (!layerFound) {
        console.warn(
          "   ⚠️ 발행 설정 레이어를 찾을 수 없음. 기본 바디에서 시도...",
        );
        layerSelector = "body";
      }

      // 3. 카테고리 설정
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
      // if (category) {
      //   try {
      //     // 카테고리 영역 텍스트로 찾기
      //     const categoryGroup = this.page
      //       .locator(`${layerSelector} .form_group, ${layerSelector} div`)
      //       .filter({ hasText: "카테고리" })
      //       .first();
      //     const categoryTrigger = categoryGroup
      //       .locator("button, select")
      //       .first();

      //     if (await categoryTrigger.isVisible({ timeout: 3000 })) {
      //       const tagName = await categoryTrigger.evaluate((el) =>
      //         el.tagName.toUpperCase(),
      //       );

      //       if (tagName === "SELECT") {
      //         await categoryTrigger.selectOption({ label: category });
      //       } else {
      //         await categoryTrigger.click({ force: true });
      //         await this.page.waitForTimeout(500);

      //         // 드롭다운에서 정확한 카테고리명 찾기 (정규식 사용)
      //         const categoryItem = this.page
      //           .locator("li, div")
      //           .filter({
      //             hasText: new RegExp(`^${category}$|^${category}\\s*\\(`),
      //           })
      //           .last();
      //         await categoryItem.click({ force: true });
      //       }
      //       console.log(`   ✅ 카테고리 설정 완료: ${category}`);
      //     }
      //   } catch (e) {
      //     console.warn(
      //       `   ⚠️ 카테고리 설정 중 오류 (무시하고 진행): ${e instanceof Error ? e.message : String(e)}`,
      //     );
      //   }
      // }

      // 4. 태그 입력
      if (tags && tags.length > 0) {
        try {
          // 태그 입력창 찾기 (더 넓은 범위의 셀렉터)
          const tagInputSelectors = [
            "input[placeholder*='태그']",
            ".tag_input",
            "div[contenteditable='true'][aria-placeholder*='태그']",
            "input[class*='tag']",
          ];

          let tagInput = null;
          for (const sel of tagInputSelectors) {
            try {
              tagInput = await this.page.waitForSelector(
                `${layerSelector} ${sel}`,
                { timeout: 1500 },
              );
              if (tagInput) break;
            } catch (e) {
              continue;
            }
          }

          if (tagInput) {
            await tagInput.click({ force: true });
            await this.page.waitForTimeout(300);

            for (const tag of tags.slice(0, 10)) {
              // 최대 10개
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
      console.log("   Status: Clicking final publish button...");

      const finalPublishBtn = this.page
        .locator(`${layerSelector} button`)
        .filter({ hasText: /^발행$/ })
        .last();
      await finalPublishBtn.waitFor({ state: "visible", timeout: 5000 });

      // 클릭 시도 (강제 클릭 및 대기)
      await Promise.all([
        this.page
          .waitForNavigation({ waitUntil: "networkidle", timeout: 30000 })
          .catch(() => null),
        finalPublishBtn.click({ force: true }),
      ]);

      // 6. 결과 확인 (URL 변화로 확실히 검증)
      await this.page.waitForTimeout(3000);
      let currentUrl = this.page.url();

      if (
        !currentUrl.includes("postwrite") &&
        !currentUrl.includes("nid.naver.com")
      ) {
        console.log("✅ 발행 성공! (페이지 이동 완료)");
        return currentUrl; // ✅ [v5.2] URL 반환
      } else {
        // 아직 글쓰기 페이지라면 한 번 더 클릭 시도 (팝업 등이 원인일 수 있음)
        console.warn("   ⚠️ 아직 글쓰기 페이지에 체류 중. 재시도합니다...");
        await this.page.keyboard.press("Enter"); // 엔터로 발행 시도
        await this.page.waitForTimeout(5000);
        currentUrl = this.page.url();

        if (!currentUrl.includes("postwrite")) {
          console.log("✅ 발행 성공! (2차 시도 완료)");
          return currentUrl; // ✅ [v5.2] URL 반환
        } else {
          throw new Error(
            "최종 발행에 실패했습니다. (페이지가 여전히 글쓰기 모드임)",
          );
        }
      }
    } catch (error) {
      console.error("❌ 발행 프로세스 실패:", error);
      throw error;
    }
  }
}
