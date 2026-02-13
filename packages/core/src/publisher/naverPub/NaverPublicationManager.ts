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
          console.log(`   📂 카테고리 설정 시도: ${category}`);
          
          // 1단계: 카테고리 선택 드롭다운 열기
          // '카테고리'라는 글자가 포함된 영역 근처의 버튼을 찾습니다.
          const categorySection = this.page.locator('.se-publish-item').filter({ hasText: '카테고리' });
          const categoryBtn = categorySection.locator('button').first();
          
          await categoryBtn.waitFor({ state: 'visible', timeout: 3000 });
          await categoryBtn.click({ force: true });
          await this.page.waitForTimeout(1000); // 목록 렌더링 대기

          // 2단계: 목록에서 해당 카테고리 클릭
          // 텍스트가 정확히 일치하거나, 뒤에 숫자가 붙은 경우를 모두 찾습니다.
          const listItems = this.page.locator('.se-publish-category-picker-item, .item_text, li');
          const targetItem = listItems.filter({ hasText: new RegExp(`^${category}(\\s*\\(\\d+\\))?$`) }).last();

          if (await targetItem.isVisible({ timeout: 2000 })) {
            await targetItem.click({ force: true });
            console.log(`   ✅ 카테고리 선택 완료: ${category}`);
          } else {
            console.warn(`   ⚠️ '${category}'를 목록에서 찾을 수 없어 텍스트 포함 검색으로 재시도...`);
            // 텍스트 포함 검색으로 한 번 더 시도
            const fuzzyItem = listItems.filter({ hasText: category }).last();
            if (await fuzzyItem.isVisible()) {
              await fuzzyItem.click({ force: true });
              console.log(`   ✅ 카테고리 선택 완료 (유연한 매칭): ${category}`);
            } else {
              throw new Error("카테고리 목록에서 해당 항목을 찾을 수 없습니다.");
            }
          }
        } catch (e) {
          console.warn(`   ⚠️ 카테고리 설정 실패 (기본값 유지): ${e instanceof Error ? e.message : String(e)}`);
          await this.page.keyboard.press("Escape"); // 열려있을지 모르는 창 닫기
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
      
      // 클릭 시도 (강제 클릭 및 대기)
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: "networkidle", timeout: 30000 }).catch(() => null),
        finalPublishBtn.click({ force: true })
      ]);

      // 6. 결과 확인 (URL 변화로 확실히 검증)
      await this.page.waitForTimeout(3000);
      const currentUrl = this.page.url();
      
      if (!currentUrl.includes("postwrite") && !currentUrl.includes("nid.naver.com")) {
        console.log("✅ 발행 성공! (페이지 이동 완료)");
      } else {
        // 아직 글쓰기 페이지라면 한 번 더 클릭 시도 (팝업 등이 원인일 수 있음)
        console.warn("   ⚠️ 아직 글쓰기 페이지에 체류 중. 재시도합니다...");
        await this.page.keyboard.press("Enter"); // 엔터로 발행 시도
        await this.page.waitForTimeout(5000);
        
        if (!this.page.url().includes("postwrite")) {
          console.log("✅ 발행 성공! (2차 시도 완료)");
        } else {
          throw new Error("최종 발행에 실패했습니다. (페이지가 여전히 글쓰기 모드임)");
        }
      }

    } catch (error) {
      console.error("❌ 발행 프로세스 실패:", error);
      throw error;
    }
  }
}