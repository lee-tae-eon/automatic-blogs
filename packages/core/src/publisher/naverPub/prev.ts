// packages/core/src/publisher/naverPublisher.ts
/// <reference lib="dom" />
import { chromium, Page, BrowserContext } from "playwright";
import path from "path";
import * as cheerio from "cheerio";

export interface NaverPostInput {
  blogId: string;
  title: string;
  htmlContent: string;
  password?: string;
  tags?: string[];
}

export class NaverPublisher {
  private userDataDir: string = path.join(process.cwd(), "../../.auth/naver");

  async postToBlog({
    blogId,
    title,
    htmlContent,
    password,
    tags = [],
  }: NaverPostInput) {
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      context = await chromium.launchPersistentContext(this.userDataDir, {
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
        permissions: ["clipboard-read", "clipboard-write"],
      });

      page = await context.newPage();

      page.on("dialog", async (dialog) => {
        console.log(`🔔 다이얼로그 감지: ${dialog.message()}`);
        if (dialog.type() === "beforeunload") {
          await dialog.accept();
        } else {
          await dialog.dismiss();
        }
      });

      console.log("🌐 글쓰기 페이지로 이동 중...");
      await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await page.waitForTimeout(2000);

      // 로그인 체크
      if (page.url().includes("nid.naver.com")) {
        console.log("🔐 로그인 필요 감지");

        if (password) {
          console.log("🤖 자동 로그인 시도 중...");
          await this.login(page, blogId, password);
        } else {
          console.log(
            "👉 로그인이 필요합니다. 브라우저에서 로그인을 완료해 주세요 (2분 대기).",
          );
        }

        await page.waitForURL("https://blog.naver.com/**", {
          timeout: 120000,
        });
        console.log("✅ 로그인 완료 감지");

        await page.waitForTimeout(3000);

        console.log("📝 글쓰기 페이지 재진입 중...");
        await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
      }

      await this.clearPopups(page);

      console.log("⏳ 에디터 로딩 대기 중...");
      await page.waitForTimeout(5000);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);

      try {
        // 제목 입력
        await this.enterTitle(page, title);
        await page.waitForTimeout(1000);

        // 제목 최종 확인
        const titleCheck = await page.evaluate(() => {
          const titleEl = document.querySelector(
            ".se-title-text",
          ) as HTMLElement;
          return titleEl?.innerText?.trim() || "";
        });
        console.log(`✅ 제목 최종 확인: "${titleCheck}"`);

        // 본문 입력
        await this.enterContent(page, htmlContent);
        await page.waitForTimeout(2000);

        // 최종 검증
        console.log("\n🔍 최종 검증 중...");
        const validation = await page.evaluate(() => {
          const titleEl = document.querySelector(
            ".se-title-text",
          ) as HTMLElement;
          const bodyModule = document.querySelector(
            '[data-a11y-title="본문"]',
          ) as HTMLElement;

          return {
            title: titleEl?.innerText.trim() || "",
            contentLength: bodyModule?.textContent?.trim().length || 0,
          };
        });

        console.log(`   제목: "${validation.title}"`);
        console.log(`   본문 길이: ${validation.contentLength}자`);

        console.log("✅ 작성 완료!");
      } catch (error) {
        console.error("❌ 입력 처리 실패:", error);
        throw error;
      }

      console.log(
        "\n🎉 모든 작업이 완료되었습니다!\n👉 브라우저에서 '발행' 버튼을 직접 눌러주세요.",
      );

      console.log("⏰ 브라우저는 5분 후 자동 종료됩니다...");
      await page.waitForTimeout(300000);
    } catch (error) {
      console.error("❌ 네이버 발행 오류:", error);

      if (page) {
        const screenshotPath = path.join(
          process.cwd(),
          `error-${Date.now()}.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 에러 스크린샷 저장: ${screenshotPath}`);

        try {
          await page.goto("about:blank", { timeout: 3000 });
        } catch (e) {
          // 무시
        }
      }

      throw error;
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  private async clearPopups(page: Page) {
    console.log("🧹 팝업 청소 시작...");
    const CANCEL_SELECTOR = ".se-popup-button.se-popup-button-cancel";

    try {
      const cancelBtn = await page.waitForSelector(CANCEL_SELECTOR, {
        timeout: 3000,
      });
      if (cancelBtn) {
        await cancelBtn.click();
        console.log("✅ 임시저장 불러오기 취소 완료");
      }
    } catch (e) {
      console.log("ℹ️ 활성화된 임시저장 팝업 없음");
    }

    await page.keyboard.press("Escape");
  }

  /**
   * 제목 입력 - 이모지 정규화
   */
  private async enterTitle(page: Page, title: string, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n📝 제목 입력 시도 ${attempt}/${maxRetries}...`);

      try {
        const titleSelector = ".se-title-text";
        const elementCount = await page.locator(titleSelector).count();

        if (elementCount === 0) {
          throw new Error(`${titleSelector} 요소를 찾을 수 없음`);
        }

        console.log(`   ✅ 제목 요소 발견`);

        await page.locator(titleSelector).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.locator(titleSelector).first().click({ force: true });
        await page.waitForTimeout(1000);

        console.log("   키보드 입력 시도");

        const isMac = process.platform === "darwin";
        await page.keyboard.press(isMac ? "Meta+A" : "Control+A");
        await page.waitForTimeout(300);
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(300);
        await page.keyboard.type(title, { delay: 30 });
        await page.waitForTimeout(1000);

        const actualText = await page
          .locator(titleSelector)
          .first()
          .evaluate((el: HTMLElement) => el.innerText.trim());

        console.log(`      예상: "${title}"`);
        console.log(`      실제: "${actualText}"`);

        // 이모지 정규화 비교
        const normalize = (str: string) => {
          return str
            .replace(/[\uFE00-\uFE0F]/g, "") // Variation Selectors 전체 제거
            .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width 문자 제거
            .normalize("NFC") // 유니코드 정규화
            .trim();
        };

        const normalizedTitle = normalize(title);
        const normalizedActual = normalize(actualText);

        if (normalizedActual === normalizedTitle) {
          console.log(`   ✅ 제목 입력 성공!`);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
          return;
        } else if (
          normalizedActual.replace(/[^\w\s가-힣]/g, "") ===
          normalizedTitle.replace(/[^\w\s가-힣]/g, "")
        ) {
          console.log(`   ⚠️ 이모지 불일치 무시 (텍스트 일치)`);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);
          return;
        } else {
          throw new Error("제목 검증 실패");
        }
      } catch (error) {
        console.log(
          `   ❌ 시도 ${attempt} 실패:`,
          error instanceof Error ? error.message : error,
        );

        if (attempt < maxRetries) {
          console.log(`   🔄 3초 후 재시도...`);
          await page.waitForTimeout(3000);
        }
      }
    }

    throw new Error(`제목 입력 ${maxRetries}회 모두 실패`);
  }

  /**
   * 본문 입력 - 구조 보존 타이핑
   */
  private async enterContent(page: Page, htmlContent: string) {
    console.log("\n📄 본문 입력 중...");

    try {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      // 본문 영역 클릭
      const bodySelectors = [
        '[data-a11y-title="본문"] .se-text-paragraph',
        '[data-a11y-title="본문"] .se-module-text',
        ".se-component.se-text .se-text-paragraph",
      ];

      let clicked = false;
      for (const selector of bodySelectors) {
        try {
          const element = await page.waitForSelector(selector, {
            state: "visible",
            timeout: 3000,
          });

          if (element) {
            await element.click({ force: true });
            await page.waitForTimeout(500);
            clicked = true;
            console.log(`   ✅ 본문 영역 클릭 성공`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!clicked) {
        throw new Error("본문 영역을 찾을 수 없음");
      }

      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(300);

      console.log("   HTML 파싱 중...");
      const textBlocks = this.htmlToTextBlocks(htmlContent);

      console.log(`   총 ${textBlocks.length}개 블록 입력 시작...\n`);

      // 각 블록 타이핑
      for (let i = 0; i < textBlocks.length; i++) {
        const block = textBlocks[i];

        if (block.type === "separator") {
          console.log(`   [구분선]`);
          await page.keyboard.type(block.text, { delay: 10 });
          await page.keyboard.press("Enter");
          await page.keyboard.press("Enter"); // 구분선 아래 여백
          await page.waitForTimeout(50);
        } else if (block.type === "empty-line") {
          // 빈 줄은 Enter만
          await page.keyboard.press("Enter");
        } else if (
          block.type === "blockquote-heading" ||
          block.type === "heading"
        ) {
          console.log(
            `   [제목] ${block.prefix}${block.text.substring(0, 30)}...`,
          );
          await page.keyboard.type(`${block.prefix}${block.text}`, {
            delay: 15,
          });
          await page.keyboard.press("Enter");
          await page.waitForTimeout(50);
        } else if (block.type === "list") {
          console.log(`   [리스트] ${block.text.substring(0, 30)}...`);
          await page.keyboard.type(`${block.prefix || ""}${block.text}`, {
            delay: 15,
          });
          await page.keyboard.press("Enter");
          await page.waitForTimeout(50);
        } else if (block.type === "table") {
          console.log(`   [테이블] DOM 직접 삽입`);

          await page.evaluate((html) => {
            const editor = document.querySelector(".se-content");
            if (!editor) return;

            const wrapper = document.createElement("div");
            wrapper.innerHTML = html;

            editor.appendChild(wrapper.firstElementChild!);
          }, block.text);

          await page.keyboard.press("Enter");
          await page.waitForTimeout(300);
        } else if (
          block.type === "blockquote-paragraph" ||
          block.type === "paragraph"
        ) {
          // 문단은 로그 생략 (너무 많아서)
          await page.keyboard.type(block.text, { delay: 15 });
          await page.keyboard.press("Enter");
          await page.waitForTimeout(50);
        } else {
          await page.keyboard.type(block.text, { delay: 15 });
          await page.keyboard.press("Enter");
          await page.waitForTimeout(50);
        }
      }

      console.log("\n   ✅ 타이핑 완료");
      await page.waitForTimeout(2000);

      // 검증
      const verification = await page.evaluate(() => {
        const titleEl = document.querySelector(".se-title-text") as HTMLElement;
        const bodyModule = document.querySelector(
          '[data-a11y-title="본문"]',
        ) as HTMLElement;

        return {
          titleText: titleEl?.textContent?.trim() || "",
          titleLength: titleEl?.textContent?.trim().length || 0,
          bodyText: bodyModule?.textContent?.trim() || "",
          bodyLength: bodyModule?.textContent?.trim().length || 0,
        };
      });

      console.log(
        `  제목: "${verification.titleText}" (${verification.titleLength}자) \n  본문 길이: ${verification.bodyLength}자`,
      );

      if (verification.titleLength > 150) {
        throw new Error(
          `제목이 비정상적으로 김 (${verification.titleLength}자)`,
        );
      }

      if (verification.bodyLength < 100) {
        throw new Error(`본문이 너무 짧음 (${verification.bodyLength}자)`);
      }

      console.log("✅ 본문 입력 및 검증 완료");

      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    } catch (error) {
      console.error("❌ 본문 입력 실패:", error);
      throw error;
    }
  }

  /**
   * HTML을 텍스트 블록으로 변환 - 구조 보존 강화
   */
  private htmlToTextBlocks(html: string): Array<{
    type:
      | "heading"
      | "paragraph"
      | "list"
      | "table"
      | "table-row"
      | "separator"
      | "blockquote-heading"
      | "blockquote-paragraph"
      | "text"
      | "empty-line";
    text: string;
    prefix?: string;
  }> {
    const blocks: Array<{
      type:
        | "heading"
        | "paragraph"
        | "list"
        | "table"
        | "table-row"
        | "separator"
        | "blockquote-heading"
        | "blockquote-paragraph"
        | "text"
        | "empty-line";
      text: string;
      prefix?: string;
    }> = [];

    const $ = cheerio.load(html);

    // body의 모든 자식 요소 순회
    $("body")
      .children()
      .each((_, element) => {
        const $el = $(element);
        const tagName = element.tagName?.toLowerCase();

        // HR 태그는 구분선으로 (AI 프롬프트 요구사항)
        if (tagName === "hr") {
          blocks.push({
            type: "separator",
            text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          });
          blocks.push({ type: "empty-line", text: "" }); // 구분선 아래 빈 줄
          return;
        }

        // Blockquote 처리 (AI가 소제목을 > ## 형식으로 감쌈)
        if (tagName === "blockquote") {
          $el.children().each((_, child) => {
            const $child = $(child);
            const childTag = child.tagName?.toLowerCase();

            // Blockquote 안의 제목
            if (childTag && childTag.match(/^h[1-6]$/)) {
              const text = $child.text().trim();
              if (text) {
                let prefix = "";
                if (childTag === "h1") prefix = "■ ";
                else if (childTag === "h2") prefix = "▶ ";
                else prefix = "• ";

                blocks.push({ type: "blockquote-heading", text, prefix });
                blocks.push({ type: "empty-line", text: "" }); // 제목 아래 빈 줄
              }
              return;
            }

            // Blockquote 안의 리스트
            if (childTag === "ul" || childTag === "ol") {
              $child.find("li").each((_, li) => {
                let text = $(li).text().trim();

                if (text) {
                  // 인용구 내부임을 나타내기 위해 앞에 공백 2칸 추가
                  // const prefix = childTag === "ol" ? `  ${idx + 1}. ` : "  • ";
                  blocks.push({ type: "list", text });
                }
              });
              blocks.push({ type: "empty-line", text: "" });
              return;
            }

            // Blockquote 안의 테이블
            if (childTag === "table") {
              // 모든 스타일/클래스를 날려야 네이버가 표로 인식함
              $child
                .find("*")
                .removeAttr("class")
                .removeAttr("style")
                .removeAttr("id");
              const tableHtml = $.html($child);
              blocks.push({ type: "table", text: tableHtml });
              blocks.push({ type: "empty-line", text: "" });
              return;
            }

            // Blockquote 안의 일반 문단
            const text = $child.text().trim();
            if (text) {
              blocks.push({ type: "blockquote-paragraph", text });
              blocks.push({ type: "empty-line", text: "" }); // 문단 아래 빈 줄
            }
          });
          return;
        }

        // 일반 제목 태그 (blockquote 밖)
        if (tagName && tagName.match(/^h[1-6]$/)) {
          const text = $el.text().trim();
          if (text) {
            let prefix = "";
            if (tagName === "h1") prefix = "■ ";
            else if (tagName === "h2") prefix = "▶ ";
            else prefix = "• ";

            blocks.push({ type: "heading", text, prefix });
            blocks.push({ type: "empty-line", text: "" });
          }
          return;
        }

        // 일반 리스트도 동일하게
        if (tagName === "ul" || tagName === "ol") {
          $el.find("li").each((idx, li) => {
            let text = $(li).text().trim();

            text = text.replace(/^(\d+[\.\)]\s*|[•\-\*\u2022]\s*)+/g, "");

            if (text) {
              const prefix = tagName === "ol" ? `${idx + 1}. ` : "• ";
              blocks.push({ type: "list", text, prefix });
            }
          });
          blocks.push({ type: "empty-line", text: "" });
          return;
        }

        // 일반 테이블 (blockquote 밖)
        if (tagName === "table") {
          // 모든 속성을 다 날리고 순수한 구조만 남깁니다.
          $el
            .find("*")
            .removeAttr("style")
            .removeAttr("class")
            .removeAttr("id");

          // 네이버 에디터가 좋아하는 아주 기본적인 구조로 재조립
          const cleanTableHtml = `<table>${$el.html()}</table>`;

          blocks.push({ type: "table", text: cleanTableHtml });
          blocks.push({ type: "empty-line", text: "" });
          return;
        }

        // 일반 문단
        const text = $el.text().trim();
        if (text) {
          blocks.push({ type: "paragraph", text });
          blocks.push({ type: "empty-line", text: "" });
        }
      });

    return blocks;
  }
  // 로그인
  private async login(page: Page, id: string, pw: string) {
    try {
      console.log("🔐 로그인 진행 중...");

      const isMac = process.platform === "darwin";
      const pasteKey = isMac ? "Meta+V" : "Control+V";

      await page.waitForSelector("#id", { timeout: 10000 });

      console.log("   아이디 입력 중...");
      await page.click("#id");
      await page.evaluate((text) => {
        return navigator.clipboard.writeText(text);
      }, id);
      await page.waitForTimeout(500);
      await page.keyboard.press(pasteKey);
      await page.waitForTimeout(800);

      const idValue = await page.inputValue("#id");
      console.log(`   입력된 아이디: ${idValue}`);

      console.log("   비밀번호 입력 중...");
      await page.click("#pw");
      await page.evaluate((text) => {
        return navigator.clipboard.writeText(text);
      }, pw);
      await page.waitForTimeout(500);
      await page.keyboard.press(pasteKey);
      await page.waitForTimeout(800);

      const loginButtonSelector = ".btn_login";
      await page.waitForSelector(loginButtonSelector, { timeout: 5000 });
      await page.click(loginButtonSelector);

      console.log("   ✅ 로그인 버튼 클릭 완료, 리다이렉트 대기 중...");
    } catch (error) {
      console.error("❌ 자동 로그인 실패:", error);
      throw new Error("자동 로그인 실패. 수동으로 로그인해주세요.");
    }
  }
}
//!---------------------------------------------------------

// private async publish(page: Page, tags: string[] = []) {
//   console.log("\n🚀 발행 프로세스 시작...");

//   try {
//     // 1. 상단 '발행' 버튼 클릭
//     const openPublishLayerBtn = ".is_active.btn_publish"; // 발행 레이어를 여는 버튼
//     await page.waitForSelector(openPublishLayerBtn, {
//       state: "visible",
//       timeout: 5000,
//     });
//     await page.click(openPublishLayerBtn);
//     console.log("   발행 설정 레이어 열기 성공");

//     // 레이어가 애니메이션으로 뜨는 시간 대기
//     await page.waitForTimeout(1000);

//     // 2. 태그 입력 (옵션)
//     if (tags && tags.length > 0) {
//       console.log(`   태그 입력 중: ${tags.join(", ")}`);
//       const tagInputSelector = ".tag_input"; // 태그 입력창

//       for (const tag of tags) {
//         await page.click(tagInputSelector);
//         await page.keyboard.type(tag);
//         await page.keyboard.press("Enter");
//         await page.waitForTimeout(200);
//       }
//     }

//     // 3. 최종 '발행' 버튼 클릭
//     // 네이버는 이 버튼에 .btn_confirm 또는 .publish_btn 등의 클래스를 씁니다.
//     const finalPublishBtn = ".confirm_btn___v9_6W, .btn_confirm";

//     await page.waitForSelector(finalPublishBtn, {
//       state: "visible",
//       timeout: 5000,
//     });

//     // 실제 발행을 원하시면 아래 주석을 해제하세요.
//     // 현재는 안전을 위해 버튼이 있는지 확인만 하고 로그를 남깁니다.
//     /*
//   await page.click(finalPublishBtn);
//   console.log("✅ 최종 발행 완료!");
//   */

//     console.log(
//       "📢 [안내] 실제 발행 버튼 클릭 직전입니다. 코드를 확인하고 주석을 해제하세요.",
//     );
//   } catch (error) {
//     console.error("❌ 발행 중 에러 발생:", error);
//     throw error;
//   }
// }
