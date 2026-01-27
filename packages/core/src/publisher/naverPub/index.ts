// packages/core/src/publisher/naverPublisher.ts
/// <reference lib="dom" />
import { chromium, Page, BrowserContext } from "playwright";
import path from "path";
import * as cheerio from "cheerio";
import { findProjectRoot } from "../../util/findProjectRoot";

export interface NaverPostInput {
  blogId: string;
  title: string;
  htmlContent: string;
  password?: string;
  tags?: string[];
  category?: string;
}

export class NaverPublisher {
  private userDataDir: string;

  constructor() {
    const projectRoot = findProjectRoot(__dirname);
    this.userDataDir = path.join(projectRoot, ".auth/naver");
  }

  async postToBlog({
    blogId,
    title,
    htmlContent,
    password,
    tags = [],
    category,
  }: NaverPostInput) {
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let currentTaskName = title;

    try {
      context = await chromium.launchPersistentContext(this.userDataDir, {
        headless: false,
        args: ["--disable-blink-features=AutomationControlled"],
        permissions: ["clipboard-read", "clipboard-write"],
      });

      page = await context.newPage();
      page.on("dialog", async (dialog) => {
        const message = dialog.message();
        console.log(`🔔 다이얼로그 감지: ${message}`);

        if (
          message.includes("발행") ||
          message.includes("등록") ||
          message.includes("저장") ||
          dialog.type() === "beforeunload"
        ) {
          console.log("   ✅ 다이얼로그 승인(accept)");
          await dialog.accept();
        } else {
          console.log("   ℹ️ 기타 다이얼로그 승인 처리");
          await dialog.accept();
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
          timeout: 100000,
        });
        console.log("✅ 로그인 완료 감지");

        await page.waitForTimeout(2000);

        console.log("📝 글쓰기 페이지 재진입 중...");
        await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
      }

      await this.clearPopups(page);

      console.log("⏳ 에디터 로딩 대기 중...");
      await page.waitForTimeout(2000);

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
        await page.waitForTimeout(1000);

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

      // 발행 로직 실행
      await this.publish(page, tags, category);
    } catch (error: any) {
      console.error("❌ 네이버 발행 오류:", error);

      if (page) {
        const fs = require("fs");
        const path = require("path");

        const logPath = path.join(process.cwd(), "error-log.txt");
        const timestamp = new Date().toLocaleString("ko-KR");

        const errorEntry = `
==================================================
[${timestamp}]
📍 대상 포스트: ${currentTaskName}
❌ 에러 메시지: ${error.message || error}
🔗 발생 URL: ${page.url()}
--------------------------------------------------
`;

        try {
          fs.appendFileSync(logPath, errorEntry, "utf8");
          console.log(`📝 에러 로그 저장 완료: ${logPath}`);
        } catch (err) {
          console.error("💾 로그 파일 저장 실패:", err);
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

        const actualText = (
          await page.locator(titleSelector).first().innerText()
        ).trim();

        console.log(`      예상: "${title}"`);
        console.log(`      실제: "${actualText}"`);

        const normalize = (str: string) => {
          return str.trim();
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
   * ✅ 인용구 blockquote 문제 해결: > 문자 직접 타이핑
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
          await page.keyboard.press("Enter");
          await page.waitForTimeout(50);
        } else if (block.type === "empty-line") {
          await page.keyboard.press("Enter");
        } else if (block.type === "blockquote-heading") {
          // ✅ 핵심 수정: 네이버 에디터에서 인용구를 만들려면 > 문자를 직접 타이핑해야 함
          console.log(`   [인용구 제목] ${block.text.substring(0, 30)}...`);

          // > 문자를 타이핑하면 네이버가 자동으로 인용구 블록으로 변환
          await page.keyboard.type("> ", { delay: 50 });
          await page.waitForTimeout(300);

          // 그 다음 제목 텍스트 입력
          await page.keyboard.type(`${block.prefix}${block.text}`, {
            delay: 15,
          });
          await page.keyboard.press("Enter");
          await page.keyboard.press("Enter"); // 인용구 빠져나오기
          await page.waitForTimeout(50);
        } else if (block.type === "heading") {
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
          console.log(`   [테이블] 클립보드 붙여넣기 시도...`);

          await page.evaluate((html) => {
            const type = "text/html";
            const blob = new Blob([html], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            return navigator.clipboard.write(data);
          }, block.text);

          const isMac = process.platform === "darwin";
          const modifier = isMac ? "Meta" : "Control";
          await page.keyboard.press(`${modifier}+V`);

          await page.waitForTimeout(1000);

          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter");
          await page.waitForTimeout(50);
        } else if (block.type === "blockquote-paragraph") {
          // ✅ 인용구 안의 일반 문단도 > 로 시작
          await page.keyboard.type("> ", { delay: 50 });
          await page.waitForTimeout(200);
          await page.keyboard.type(block.text, { delay: 15 });
          await page.keyboard.press("Enter");
          await page.keyboard.press("Enter"); // 인용구 빠져나오기
          await page.waitForTimeout(50);
        } else if (block.type === "paragraph") {
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

      console.log(`\n   === 검증 결과 ===`);
      console.log(
        `   제목: "${verification.titleText}" (${verification.titleLength}자)`,
      );
      console.log(`   본문 길이: ${verification.bodyLength}자`);

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

    $("body")
      .children()
      .each((_, element) => {
        const $el = $(element);
        const tagName = element.tagName?.toLowerCase();

        if (tagName === "hr") {
          blocks.push({
            type: "separator",
            text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          });
          blocks.push({ type: "empty-line", text: "" });
          return;
        }

        // Blockquote 처리
        if (tagName === "blockquote") {
          $el.children().each((_, child) => {
            const $child = $(child);
            const childTag = child.tagName?.toLowerCase();

            if (childTag && childTag.match(/^h[1-6]$/)) {
              const text = $child.text().trim();
              if (text) {
                let prefix = "";
                if (childTag === "h1") prefix = "■ ";
                else if (childTag === "h2") prefix = "▶ ";
                else prefix = "• ";

                blocks.push({ type: "blockquote-heading", text, prefix });
                blocks.push({ type: "empty-line", text: "" });
                blocks.push({ type: "empty-line", text: "" });
                blocks.push({ type: "empty-line", text: "" });
              }
              return;
            }

            if (childTag === "ul" || childTag === "ol") {
              $child.find("li").each((idx, li) => {
                const text = $(li).text().trim();
                if (text) {
                  const prefix = childTag === "ol" ? `  ${idx + 1}. ` : "  • ";
                  blocks.push({ type: "list", text, prefix });
                }
              });
              blocks.push({ type: "empty-line", text: "" });
              return;
            }

            if (childTag === "table") {
              $child.find("tr").each((idx, tr) => {
                const cells: string[] = [];
                $(tr)
                  .find("th, td")
                  .each((_, cell) => {
                    cells.push($(cell).text().trim());
                  });

                if (cells.length > 0) {
                  const rowText = cells.join(" │ ");
                  blocks.push({ type: "table-row", text: rowText });
                }
              });
              blocks.push({ type: "empty-line", text: "" });
              return;
            }

            const text = $child.text().trim();
            if (text) {
              blocks.push({ type: "blockquote-paragraph", text });
              blocks.push({ type: "empty-line", text: "" });
            }
          });
          return;
        }

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

        if (tagName === "ul" || tagName === "ol") {
          $el.find("li").each((idx, li) => {
            const text = $(li).text().trim();
            if (text) {
              const prefix = tagName === "ol" ? `${idx + 1}. ` : "• ";
              blocks.push({ type: "list", text, prefix });
            }
          });
          blocks.push({ type: "empty-line", text: "" });
          return;
        }

        if (tagName === "table") {
          $el
            .find("*")
            .removeAttr("class")
            .removeAttr("style")
            .removeAttr("id");
          $el.removeAttr("class").removeAttr("style").removeAttr("id");

          $el.attr("border", "1");
          $el.attr("style", "border-collapse: collapse; width: 100%;");
          $el
            .find("th, td")
            .attr("style", "border: 1px solid #ccc; padding: 10px;");

          const tableHtml = $.html($el);
          blocks.push({ type: "table", text: tableHtml });
          blocks.push({ type: "empty-line", text: "" });
          return;
        }

        const text = $el.text().trim();
        if (text) {
          blocks.push({ type: "paragraph", text });
          blocks.push({ type: "empty-line", text: "" });
        }
      });

    return blocks;
  }

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

  /**
   * ✅ 발행 로직 대폭 개선
   */
  private async publish(page: Page, tags: string[] = [], category?: string) {
    console.log("\n🚀 발행 프로세스 시작...");

    try {
      // 1. 화면 최상단으로 스크롤
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1500);

      // 2. 발행 버튼 찾기 (여러 셀렉터 시도)
      const publishButtonSelectors = [
        "button.publish_btn__m2fHR", // 최신 클래스명
        'button:has-text("발행")',
        ".btn_publish",
        'button[class*="publish"]',
        '[data-testid="publish-button"]',
      ];

      let publishButton = null;
      for (const selector of publishButtonSelectors) {
        try {
          publishButton = await page.waitForSelector(selector, {
            state: "visible",
            timeout: 3000,
          });
          if (publishButton) {
            console.log(`   ✅ 발행 버튼 발견: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!publishButton) {
        // 마지막 수단: 텍스트로 버튼 찾기
        publishButton = await page
          .locator("button")
          .filter({ hasText: "발행" })
          .first();
      }

      // 버튼 클릭
      await publishButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      try {
        await publishButton.click({ timeout: 5000 });
      } catch (e) {
        console.warn("   ⚠️ 일반 클릭 실패, JS 주입 클릭 시도...");
        // publishButton이 Locator일 수도 있고 ElementHandle일 수도 있으므로
        // page.$eval을 사용하여 안전하게 클릭
        await page.evaluate(() => {
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

      console.log("   발행 설정 레이어 호출 완료");
      await page.waitForTimeout(2000);

      // 3. 발행 레이어 감지 (더 유연한 셀렉터)
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
          const element = await page.waitForSelector(selector, {
            state: "visible",
            timeout: 3000,
          });
          if (element) {
            layerSelector = selector;
            layerFound = true;
            console.log(`   ✅ 발행 레이어 감지: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!layerFound) {
        console.warn("   ⚠️ 레이어를 찾을 수 없음. 기본 진행...");
        layerSelector = "body"; // 폴백
      }

      // 4. 카테고리 선택
      if (category) {
        console.log(`   카테고리 선택 시도: ${category}`);
        try {
          // 셀렉트박스 찾기
          const categorySelectSelectors = [
            `${layerSelector} select`,
            `${layerSelector} .selectbox-source`,
            `${layerSelector} [class*="category"] select`,
            'select[class*="category"]',
          ];

          let categorySelect = null;
          for (const selector of categorySelectSelectors) {
            try {
              categorySelect = await page.waitForSelector(selector, {
                timeout: 2000,
              });
              if (categorySelect) break;
            } catch (e) {
              continue;
            }
          }

          if (categorySelect) {
            await categorySelect.click({ force: true });
            await page.waitForTimeout(1000);

            // 카테고리 아이템 선택
            const categoryItem = page
              .locator(".selectbox-item, .list_category li, option")
              .filter({ hasText: new RegExp(`^${category}$`) })
              .first();

            if (await categoryItem.isVisible()) {
              await categoryItem.click();
              console.log(`   ✅ 카테고리 변경 완료: ${category}`);
            } else {
              console.warn(`   ⚠️ [${category}] 미발견, 기본값 유지`);
            }
          }
        } catch (e) {
          console.warn(`   ⚠️ 카테고리 선택 실패:`, e);
        }
      }

      // 5. 태그 입력
      if (tags && tags.length > 0) {
        console.log(`   태그 입력 시작...`);
        try {
          const tagInputSelectors = [
            `${layerSelector} input[placeholder*="태그"]`,
            `${layerSelector} .tag_input`,
            'input[class*="tag"]',
            'input[placeholder*="태그"]',
          ];

          let tagInput = null;
          for (const selector of tagInputSelectors) {
            try {
              tagInput = await page.waitForSelector(selector, {
                timeout: 2000,
              });
              if (tagInput) break;
            } catch (e) {
              continue;
            }
          }

          if (tagInput) {
            await tagInput.scrollIntoViewIfNeeded();
            await tagInput.click({ force: true });
            await page.waitForTimeout(500);

            for (const tag of tags) {
              await page.keyboard.type(tag, { delay: 30 });
              await page.keyboard.press("Enter");
              await page.waitForTimeout(300);
            }
            console.log("   ✅ 태그 입력 완료");
          }
        } catch (e) {
          console.warn(`   ⚠️ 태그 입력 실패:`, e);
        }
      }

      // 6. 최종 발행 버튼 클릭 (여러 시도)
      console.log("   최종 발행 버튼 클릭 시도...");

      const finalPublishSelectors = [
        `${layerSelector} button.btn_confirm`,
        `${layerSelector} button:has-text("발행")`,
        "button.btn_confirm",
        'button[class*="confirm"]',
        'button:has-text("발행")',
      ];

      let published = false;
      for (const selector of finalPublishSelectors) {
        try {
          const btn = await page.waitForSelector(selector, {
            state: "visible",
            timeout: 3000,
          });

          if (btn) {
            await btn.scrollIntoViewIfNeeded();
            await page.waitForTimeout(300);

            try {
              await btn.click({ force: true });
              console.log(`   ✅ 발행 버튼 클릭 성공: ${selector}`);
              published = true;
              break;
            } catch (e) {
              // ElementHandle의 evaluate 타입 이슈를 피하기 위해 page.evaluate 사용
              await page.$eval(selector, (el) => (el as HTMLElement).click());
              console.log(`   ✅ 발행 버튼 클릭 성공 (JS 주입): ${selector}`);
              published = true;
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (!published) {
        // 최후의 수단: 모든 버튼 중 "발행" 텍스트 찾기
        const allButtons = await page.locator("button").all();
        for (const btn of allButtons) {
          const text = await btn.textContent();
          if (text && text.includes("발행")) {
            try {
              await btn.click({ force: true });
              console.log("   ✅ 발행 버튼 클릭 성공 (텍스트 검색)");
              published = true;
              break;
            } catch (e) {
              continue;
            }
          }
        }
      }

      if (!published) {
        throw new Error("발행 버튼을 찾을 수 없거나 클릭에 실패했습니다");
      }

      // 7. 발행 완료 대기
      await page.waitForTimeout(3000);

      // URL 변경 또는 성공 메시지 확인
      try {
        await page.waitForURL(/.*\/\d+/, { timeout: 10000 });
        console.log("✅ 발행 완료! 포스트 URL로 이동됨");
      } catch (e) {
        // URL이 변경되지 않았더라도 다이얼로그나 메시지로 성공 확인
        const currentUrl = page.url();
        if (currentUrl.includes("/postwrite")) {
          console.warn("   ⚠️ 아직 작성 페이지에 있음. 발행 상태 불명확");
        } else {
          console.log("✅ 발행 완료 (URL 변경 감지)");
        }
      }
    } catch (error) {
      console.error("❌ 발행 프로세스 실패:", error);

      // 디버깅을 위한 스크린샷 저장
      try {
        await page.screenshot({
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
// // packages/core/src/publisher/naverPublisher.ts
// /// <reference lib="dom" />
// import { chromium, Page, BrowserContext } from "playwright";
// import path from "path";
// import * as cheerio from "cheerio";
// import { findProjectRoot } from "../../util/findProjectRoot";

// export interface NaverPostInput {
//   blogId: string;
//   title: string;
//   htmlContent: string;
//   password?: string;
//   tags?: string[];
//   category?: string;
// }

// export class NaverPublisher {
//   private userDataDir: string;

//   constructor() {
//     const projectRoot = findProjectRoot(__dirname);
//     this.userDataDir = path.join(projectRoot, ".auth/naver");
//   }

//   async postToBlog({
//     blogId,
//     title,
//     htmlContent,
//     password,
//     tags = [],
//     category,
//   }: NaverPostInput) {
//     let context: BrowserContext | null = null;
//     let page: Page | null = null;
//     let currentTaskName = title;

//     try {
//       context = await chromium.launchPersistentContext(this.userDataDir, {
//         headless: false,
//         args: ["--disable-blink-features=AutomationControlled"],
//         permissions: ["clipboard-read", "clipboard-write"],
//       });

//       page = await context.newPage();
//       page.on("dialog", async (dialog) => {
//         const message = dialog.message();
//         console.log(`🔔 다이얼로그 감지: ${message}`);

//         if (
//           message.includes("발행") ||
//           message.includes("등록") ||
//           message.includes("저장") ||
//           dialog.type() === "beforeunload"
//         ) {
//           console.log("   ✅ 다이얼로그 승인(accept)");
//           await dialog.accept();
//         } else {
//           console.log("   ℹ️ 기타 다이얼로그 승인 처리");
//           await dialog.accept();
//         }
//       });

//       console.log("🌐 글쓰기 페이지로 이동 중...");
//       await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
//         waitUntil: "domcontentloaded",
//         timeout: 30000,
//       });

//       await page.waitForTimeout(2000);

//       // 로그인 체크
//       if (page.url().includes("nid.naver.com")) {
//         console.log("🔐 로그인 필요 감지");

//         if (password) {
//           console.log("🤖 자동 로그인 시도 중...");
//           await this.login(page, blogId, password);
//         } else {
//           console.log(
//             "👉 로그인이 필요합니다. 브라우저에서 로그인을 완료해 주세요 (2분 대기).",
//           );
//         }

//         await page.waitForURL("https://blog.naver.com/**", {
//           timeout: 100000,
//         });
//         console.log("✅ 로그인 완료 감지");

//         await page.waitForTimeout(2000);

//         console.log("📝 글쓰기 페이지 재진입 중...");
//         await page.goto(`https://blog.naver.com/${blogId}/postwrite`, {
//           waitUntil: "domcontentloaded",
//           timeout: 20000,
//         });
//       }

//       await this.clearPopups(page);

//       console.log("⏳ 에디터 로딩 대기 중...");
//       await page.waitForTimeout(2000);

//       await page.keyboard.press("Escape");
//       await page.waitForTimeout(1000);

//       try {
//         // 제목 입력
//         await this.enterTitle(page, title);
//         await page.waitForTimeout(1000);

//         // 제목 최종 확인
//         const titleCheck = await page.evaluate(() => {
//           const titleEl = document.querySelector(
//             ".se-title-text",
//           ) as HTMLElement;
//           return titleEl?.innerText?.trim() || "";
//         });
//         console.log(`✅ 제목 최종 확인: "${titleCheck}"`);

//         // 본문 입력
//         await this.enterContent(page, htmlContent);
//         await page.waitForTimeout(1000);

//         // 최종 검증
//         console.log("\n🔍 최종 검증 중...");
//         const validation = await page.evaluate(() => {
//           const titleEl = document.querySelector(
//             ".se-title-text",
//           ) as HTMLElement;
//           const bodyModule = document.querySelector(
//             '[data-a11y-title="본문"]',
//           ) as HTMLElement;

//           return {
//             title: titleEl?.innerText.trim() || "",
//             contentLength: bodyModule?.textContent?.trim().length || 0,
//           };
//         });

//         console.log(`   제목: "${validation.title}"`);
//         console.log(`   본문 길이: ${validation.contentLength}자`);

//         console.log("✅ 작성 완료!");
//       } catch (error) {
//         console.error("❌ 입력 처리 실패:", error);
//         throw error;
//       }

//       // 발행 로직 실행
//       await this.publish(page, tags, category);
//     } catch (error: any) {
//       console.error("❌ 네이버 발행 오류:", error);

//       if (page) {
//         const fs = require("fs");
//         const path = require("path");

//         const logPath = path.join(process.cwd(), "error-log.txt");
//         const timestamp = new Date().toLocaleString("ko-KR");

//         const errorEntry = `
// ==================================================
// [${timestamp}]
// 📍 대상 포스트: ${currentTaskName}
// ❌ 에러 메시지: ${error.message || error}
// 🔗 발생 URL: ${page.url()}
// --------------------------------------------------
// `;

//         try {
//           fs.appendFileSync(logPath, errorEntry, "utf8");
//           console.log(`📝 에러 로그 저장 완료: ${logPath}`);
//         } catch (err) {
//           console.error("💾 로그 파일 저장 실패:", err);
//         }
//       }
//       throw error;
//     } finally {
//       if (context) {
//         await context.close();
//       }
//     }
//   }

//   private async clearPopups(page: Page) {
//     console.log("🧹 팝업 청소 시작...");
//     const CANCEL_SELECTOR = ".se-popup-button.se-popup-button-cancel";

//     try {
//       const cancelBtn = await page.waitForSelector(CANCEL_SELECTOR, {
//         timeout: 3000,
//       });
//       if (cancelBtn) {
//         await cancelBtn.click();
//         console.log("✅ 임시저장 불러오기 취소 완료");
//       }
//     } catch (e) {
//       console.log("ℹ️ 활성화된 임시저장 팝업 없음");
//     }

//     await page.keyboard.press("Escape");
//   }

//   /**
//    * 제목 입력 - 이모지 정규화
//    */
//   private async enterTitle(page: Page, title: string, maxRetries = 3) {
//     for (let attempt = 1; attempt <= maxRetries; attempt++) {
//       console.log(`\n📝 제목 입력 시도 ${attempt}/${maxRetries}...`);

//       try {
//         const titleSelector = ".se-title-text";
//         const elementCount = await page.locator(titleSelector).count();

//         if (elementCount === 0) {
//           throw new Error(`${titleSelector} 요소를 찾을 수 없음`);
//         }

//         console.log(`   ✅ 제목 요소 발견`);

//         await page.locator(titleSelector).first().scrollIntoViewIfNeeded();
//         await page.waitForTimeout(500);
//         await page.locator(titleSelector).first().click({ force: true });
//         await page.waitForTimeout(1000);

//         console.log("   키보드 입력 시도");

//         const isMac = process.platform === "darwin";
//         await page.keyboard.press(isMac ? "Meta+A" : "Control+A");
//         await page.waitForTimeout(300);
//         await page.keyboard.press("Backspace");
//         await page.waitForTimeout(300);
//         await page.keyboard.type(title, { delay: 30 });
//         await page.waitForTimeout(1000);

//         const actualText = await page
//           .locator(titleSelector)
//           .first()
//           .evaluate((el: HTMLElement) => el.innerText.trim());

//         console.log(`      예상: "${title}"`);
//         console.log(`      실제: "${actualText}"`);

//         const normalize = (str: string) => {
//           return str.trim();
//         };

//         const normalizedTitle = normalize(title);
//         const normalizedActual = normalize(actualText);

//         if (normalizedActual === normalizedTitle) {
//           console.log(`   ✅ 제목 입력 성공!`);
//           await page.keyboard.press("Escape");
//           await page.waitForTimeout(500);
//           return;
//         } else if (
//           normalizedActual.replace(/[^\w\s가-힣]/g, "") ===
//           normalizedTitle.replace(/[^\w\s가-힣]/g, "")
//         ) {
//           console.log(`   ⚠️ 이모지 불일치 무시 (텍스트 일치)`);
//           await page.keyboard.press("Escape");
//           await page.waitForTimeout(500);
//           return;
//         } else {
//           throw new Error("제목 검증 실패");
//         }
//       } catch (error) {
//         console.log(
//           `   ❌ 시도 ${attempt} 실패:`,
//           error instanceof Error ? error.message : error,
//         );

//         if (attempt < maxRetries) {
//           console.log(`   🔄 3초 후 재시도...`);
//           await page.waitForTimeout(3000);
//         }
//       }
//     }

//     throw new Error(`제목 입력 ${maxRetries}회 모두 실패`);
//   }

//   /**
//    * 본문 입력 - 구조 보존 타이핑
//    * ✅ 인용구 blockquote 문제 해결: > 문자 직접 타이핑
//    */
//   private async enterContent(page: Page, htmlContent: string) {
//     console.log("\n📄 본문 입력 중...");

//     try {
//       await page.keyboard.press("Escape");
//       await page.waitForTimeout(500);

//       // 본문 영역 클릭
//       const bodySelectors = [
//         '[data-a11y-title="본문"] .se-text-paragraph',
//         '[data-a11y-title="본문"] .se-module-text',
//         ".se-component.se-text .se-text-paragraph",
//       ];

//       let clicked = false;
//       for (const selector of bodySelectors) {
//         try {
//           const element = await page.waitForSelector(selector, {
//             state: "visible",
//             timeout: 3000,
//           });

//           if (element) {
//             await element.click({ force: true });
//             await page.waitForTimeout(500);
//             clicked = true;
//             console.log(`   ✅ 본문 영역 클릭 성공`);
//             break;
//           }
//         } catch (e) {
//           continue;
//         }
//       }

//       if (!clicked) {
//         throw new Error("본문 영역을 찾을 수 없음");
//       }

//       await page.keyboard.press("ArrowDown");
//       await page.waitForTimeout(300);

//       console.log("   HTML 파싱 중...");
//       const textBlocks = this.htmlToTextBlocks(htmlContent);

//       console.log(`   총 ${textBlocks.length}개 블록 입력 시작...\n`);

//       // 각 블록 타이핑
//       for (let i = 0; i < textBlocks.length; i++) {
//         const block = textBlocks[i];

//         if (block.type === "separator") {
//           console.log(`   [구분선]`);
//           await page.keyboard.type(block.text, { delay: 10 });
//           await page.keyboard.press("Enter");
//           await page.keyboard.press("Enter");
//           await page.waitForTimeout(50);
//         } else if (block.type === "empty-line") {
//           await page.keyboard.press("Enter");
//         } else if (block.type === "blockquote-heading") {
//           // ✅ 핵심 수정: 네이버 에디터에서 인용구를 만들려면 > 문자를 직접 타이핑해야 함
//           console.log(`   [인용구 제목] ${block.text.substring(0, 30)}...`);

//           // > 문자를 타이핑하면 네이버가 자동으로 인용구 블록으로 변환
//           await page.keyboard.type("> ", { delay: 50 });
//           await page.waitForTimeout(300);

//           // 그 다음 제목 텍스트 입력
//           await page.keyboard.type(`${block.prefix}${block.text}`, { delay: 15 });
//           await page.keyboard.press("Enter");
//           await page.keyboard.press("Enter"); // 인용구 빠져나오기
//           await page.waitForTimeout(50);
//         } else if (block.type === "heading") {
//           console.log(`   [제목] ${block.prefix}${block.text.substring(0, 30)}...`);
//           await page.keyboard.type(`${block.prefix}${block.text}`, { delay: 15 });
//           await page.keyboard.press("Enter");
//           await page.waitForTimeout(50);
//         } else if (block.type === "list") {
//           console.log(`   [리스트] ${block.text.substring(0, 30)}...`);
//           await page.keyboard.type(`${block.prefix || ""}${block.text}`, { delay: 15 });
//           await page.keyboard.press("Enter");
//           await page.waitForTimeout(50);
//         } else if (block.type === "table") {
//           console.log(`   [테이블] 클립보드 붙여넣기 시도...`);

//           await page.evaluate((html) => {
//             const type = "text/html";
//             const blob = new Blob([html], { type });
//             const data = [new ClipboardItem({ [type]: blob })];
//             return navigator.clipboard.write(data);
//           }, block.text);

//           const isMac = process.platform === "darwin";
//           const modifier = isMac ? "Meta" : "Control";
//           await page.keyboard.press(`${modifier}+V`);

//           await page.waitForTimeout(1000);

//           await page.keyboard.press("ArrowDown");
//           await page.keyboard.press("Enter");
//           await page.waitForTimeout(50);
//         } else if (block.type === "blockquote-paragraph") {
//           // ✅ 인용구 안의 일반 문단도 > 로 시작
//           await page.keyboard.type("> ", { delay: 50 });
//           await page.waitForTimeout(200);
//           await page.keyboard.type(block.text, { delay: 15 });
//           await page.keyboard.press("Enter");
//           await page.keyboard.press("Enter"); // 인용구 빠져나오기
//           await page.waitForTimeout(50);
//         } else if (block.type === "paragraph") {
//           await page.keyboard.type(block.text, { delay: 15 });
//           await page.keyboard.press("Enter");
//           await page.waitForTimeout(50);
//         } else {
//           await page.keyboard.type(block.text, { delay: 15 });
//           await page.keyboard.press("Enter");
//           await page.waitForTimeout(50);
//         }
//       }

//       console.log("\n   ✅ 타이핑 완료");
//       await page.waitForTimeout(2000);

//       // 검증
//       const verification = await page.evaluate(() => {
//         const titleEl = document.querySelector(".se-title-text") as HTMLElement;
//         const bodyModule = document.querySelector(
//           '[data-a11y-title="본문"]',
//         ) as HTMLElement;

//         return {
//           titleText: titleEl?.textContent?.trim() || "",
//           titleLength: titleEl?.textContent?.trim().length || 0,
//           bodyText: bodyModule?.textContent?.trim() || "",
//           bodyLength: bodyModule?.textContent?.trim().length || 0,
//         };
//       });

//       console.log(`\n   === 검증 결과 ===`);
//       console.log(
//         `   제목: "${verification.titleText}" (${verification.titleLength}자)`,
//       );
//       console.log(`   본문 길이: ${verification.bodyLength}자`);

//       if (verification.titleLength > 150) {
//         throw new Error(
//           `제목이 비정상적으로 김 (${verification.titleLength}자)`,
//         );
//       }

//       if (verification.bodyLength < 100) {
//         throw new Error(`본문이 너무 짧음 (${verification.bodyLength}자)`);
//       }

//       console.log("✅ 본문 입력 및 검증 완료");

//       await page.keyboard.press("Escape");
//       await page.waitForTimeout(1000);
//     } catch (error) {
//       console.error("❌ 본문 입력 실패:", error);
//       throw error;
//     }
//   }

//   /**
//    * HTML을 텍스트 블록으로 변환 - 구조 보존 강화
//    */
//   private htmlToTextBlocks(html: string): Array<{
//     type:
//       | "heading"
//       | "paragraph"
//       | "list"
//       | "table"
//       | "table-row"
//       | "separator"
//       | "blockquote-heading"
//       | "blockquote-paragraph"
//       | "text"
//       | "empty-line";
//     text: string;
//     prefix?: string;
//   }> {
//     const blocks: Array<{
//       type:
//         | "heading"
//         | "paragraph"
//         | "list"
//         | "table"
//         | "table-row"
//         | "separator"
//         | "blockquote-heading"
//         | "blockquote-paragraph"
//         | "text"
//         | "empty-line";
//       text: string;
//       prefix?: string;
//     }> = [];

//     const $ = cheerio.load(html);

//     $("body")
//       .children()
//       .each((_, element) => {
//         const $el = $(element);
//         const tagName = element.tagName?.toLowerCase();

//         if (tagName === "hr") {
//           blocks.push({
//             type: "separator",
//             text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
//           });
//           blocks.push({ type: "empty-line", text: "" });
//           return;
//         }

//         // Blockquote 처리
//         if (tagName === "blockquote") {
//           $el.children().each((_, child) => {
//             const $child = $(child);
//             const childTag = child.tagName?.toLowerCase();

//             if (childTag && childTag.match(/^h[1-6]$/)) {
//               const text = $child.text().trim();
//               if (text) {
//                 let prefix = "";
//                 if (childTag === "h1") prefix = "■ ";
//                 else if (childTag === "h2") prefix = "▶ ";
//                 else prefix = "• ";

//                 blocks.push({ type: "blockquote-heading", text, prefix });
//                 blocks.push({ type: "empty-line", text: "" });
//                 blocks.push({ type: "empty-line", text: "" });
//                 blocks.push({ type: "empty-line", text: "" });
//               }
//               return;
//             }

//             if (childTag === "ul" || childTag === "ol") {
//               $child.find("li").each((idx, li) => {
//                 const text = $(li).text().trim();
//                 if (text) {
//                   const prefix = childTag === "ol" ? `  ${idx + 1}. ` : "  • ";
//                   blocks.push({ type: "list", text, prefix });
//                 }
//               });
//               blocks.push({ type: "empty-line", text: "" });
//               return;
//             }

//             if (childTag === "table") {
//               $child.find("tr").each((idx, tr) => {
//                 const cells: string[] = [];
//                 $(tr)
//                   .find("th, td")
//                   .each((_, cell) => {
//                     cells.push($(cell).text().trim());
//                   });

//                 if (cells.length > 0) {
//                   const rowText = cells.join(" │ ");
//                   blocks.push({ type: "table-row", text: rowText });
//                 }
//               });
//               blocks.push({ type: "empty-line", text: "" });
//               return;
//             }

//             const text = $child.text().trim();
//             if (text) {
//               blocks.push({ type: "blockquote-paragraph", text });
//               blocks.push({ type: "empty-line", text: "" });
//             }
//           });
//           return;
//         }

//         if (tagName && tagName.match(/^h[1-6]$/)) {
//           const text = $el.text().trim();
//           if (text) {
//             let prefix = "";
//             if (tagName === "h1") prefix = "■ ";
//             else if (tagName === "h2") prefix = "▶ ";
//             else prefix = "• ";

//             blocks.push({ type: "heading", text, prefix });
//             blocks.push({ type: "empty-line", text: "" });
//           }
//           return;
//         }

//         if (tagName === "ul" || tagName === "ol") {
//           $el.find("li").each((idx, li) => {
//             const text = $(li).text().trim();
//             if (text) {
//               const prefix = tagName === "ol" ? `${idx + 1}. ` : "• ";
//               blocks.push({ type: "list", text, prefix });
//             }
//           });
//           blocks.push({ type: "empty-line", text: "" });
//           return;
//         }

//         if (tagName === "table") {
//           $el
//             .find("*")
//             .removeAttr("class")
//             .removeAttr("style")
//             .removeAttr("id");
//           $el.removeAttr("class").removeAttr("style").removeAttr("id");

//           $el.attr("border", "1");
//           $el.attr("style", "border-collapse: collapse; width: 100%;");
//           $el
//             .find("th, td")
//             .attr("style", "border: 1px solid #ccc; padding: 10px;");

//           const tableHtml = $.html($el);
//           blocks.push({ type: "table", text: tableHtml });
//           blocks.push({ type: "empty-line", text: "" });
//           return;
//         }

//         const text = $el.text().trim();
//         if (text) {
//           blocks.push({ type: "paragraph", text });
//           blocks.push({ type: "empty-line", text: "" });
//         }
//       });

//     return blocks;
//   }

//   private async login(page: Page, id: string, pw: string) {
//     try {
//       console.log("🔐 로그인 진행 중...");

//       const isMac = process.platform === "darwin";
//       const pasteKey = isMac ? "Meta+V" : "Control+V";

//       await page.waitForSelector("#id", { timeout: 10000 });

//       console.log("   아이디 입력 중...");
//       await page.click("#id");
//       await page.evaluate((text) => {
//         return navigator.clipboard.writeText(text);
//       }, id);
//       await page.waitForTimeout(500);
//       await page.keyboard.press(pasteKey);
//       await page.waitForTimeout(800);

//       const idValue = await page.inputValue("#id");
//       console.log(`   입력된 아이디: ${idValue}`);

//       console.log("   비밀번호 입력 중...");
//       await page.click("#pw");
//       await page.evaluate((text) => {
//         return navigator.clipboard.writeText(text);
//       }, pw);
//       await page.waitForTimeout(500);
//       await page.keyboard.press(pasteKey);
//       await page.waitForTimeout(800);

//       const loginButtonSelector = ".btn_login";
//       await page.waitForSelector(loginButtonSelector, { timeout: 5000 });
//       await page.click(loginButtonSelector);

//       console.log("   ✅ 로그인 버튼 클릭 완료, 리다이렉트 대기 중...");
//     } catch (error) {
//       console.error("❌ 자동 로그인 실패:", error);
//       throw new Error("자동 로그인 실패. 수동으로 로그인해주세요.");
//     }
//   }

//   /**
//    * ✅ 발행 로직 대폭 개선
//    */
//   private async publish(page: Page, tags: string[] = [], category?: string) {
//     console.log("\n🚀 발행 프로세스 시작...");

//     try {
//       // 1. 화면 최상단으로 스크롤
//       await page.evaluate(() => window.scrollTo(0, 0));
//       await page.keyboard.press("Escape");
//       await page.waitForTimeout(1500);

//       // 2. 발행 버튼 찾기 (여러 셀렉터 시도)
//       const publishButtonSelectors = [
//         'button.publish_btn__m2fHR', // 최신 클래스명
//         'button:has-text("발행")',
//         '.btn_publish',
//         'button[class*="publish"]',
//         '[data-testid="publish-button"]'
//       ];

//       let publishButton = null;
//       for (const selector of publishButtonSelectors) {
//         try {
//           publishButton = await page.waitForSelector(selector, {
//             state: "visible",
//             timeout: 3000
//           });
//           if (publishButton) {
//             console.log(`   ✅ 발행 버튼 발견: ${selector}`);
//             break;
//           }
//         } catch (e) {
//           continue;
//         }
//       }

//       if (!publishButton) {
//         // 마지막 수단: 텍스트로 버튼 찾기
//         publishButton = await page.locator('button').filter({ hasText: '발행' }).first();
//       }

//       // 버튼 클릭
//       await publishButton.scrollIntoViewIfNeeded();
//       await page.waitForTimeout(500);

//       try {
//         await publishButton.click({ timeout: 5000 });
//       } catch (e) {
//         console.warn("   ⚠️ 일반 클릭 실패, JS 주입 클릭 시도...");
//         await publishButton.evaluate((el: any) => el.click());
//       }

//       console.log("   발행 설정 레이어 호출 완료");
//       await page.waitForTimeout(2000);

//       // 3. 발행 레이어 감지 (더 유연한 셀렉터)
//       const layerSelectors = [
//         '.publish_layer_container',
//         '.publish_layer',
//         '.section_publish',
//         '[class*="publish"][class*="layer"]',
//         '[class*="PublishLayer"]'
//       ];

//       let layerFound = false;
//       let layerSelector = '';

//       for (const selector of layerSelectors) {
//         try {
//           const element = await page.waitForSelector(selector, {
//             state: "visible",
//             timeout: 3000
//           });
//           if (element) {
//             layerSelector = selector;
//             layerFound = true;
//             console.log(`   ✅ 발행 레이어 감지: ${selector}`);
//             break;
//           }
//         } catch (e) {
//           continue;
//         }
//       }

//       if (!layerFound) {
//         console.warn("   ⚠️ 레이어를 찾을 수 없음. 기본 진행...");
//         layerSelector = 'body'; // 폴백
//       }

//       // 4. 카테고리 선택
//       if (category) {
//         console.log(`   카테고리 선택 시도: ${category}`);
//         try {
//           // 셀렉트박스 찾기
//           const categorySelectSelectors = [
//             `${layerSelector} select`,
//             `${layerSelector} .selectbox-source`,
//             `${layerSelector} [class*="category"] select`,
//             'select[class*="category"]'
//           ];

//           let categorySelect = null;
//           for (const selector of categorySelectSelectors) {
//             try {
//               categorySelect = await page.waitForSelector(selector, { timeout: 2000 });
//               if (categorySelect) break;
//             } catch (e) {
//               continue;
//             }
//           }

//           if (categorySelect) {
//             await categorySelect.click({ force: true });
//             await page.waitForTimeout(1000);

//             // 카테고리 아이템 선택
//             const categoryItem = page
//               .locator('.selectbox-item, .list_category li, option')
//               .filter({ hasText: new RegExp(`^${category}$`) })
//               .first();

//             if (await categoryItem.isVisible()) {
//               await categoryItem.click();
//               console.log(`   ✅ 카테고리 변경 완료: ${category}`);
//             } else {
//               console.warn(`   ⚠️ [${category}] 미발견, 기본값 유지`);
//             }
//           }
//         } catch (e) {
//           console.warn(`   ⚠️ 카테고리 선택 실패:`, e);
//         }
//       }

//       // 5. 태그 입력
//       if (tags && tags.length > 0) {
//         console.log(`   태그 입력 시작...`);
//         try {
//           const tagInputSelectors = [
//             `${layerSelector} input[placeholder*="태그"]`,
//             `${layerSelector} .tag_input`,
//             'input[class*="tag"]',
//             'input[placeholder*="태그"]'
//           ];

//           let tagInput = null;
//           for (const selector of tagInputSelectors) {
//             try {
//               tagInput = await page.waitForSelector(selector, { timeout: 2000 });
//               if (tagInput) break;
//             } catch (e) {
//               continue;
//             }
//           }

//           if (tagInput) {
//             await tagInput.scrollIntoViewIfNeeded();
//             await tagInput.click({ force: true });
//             await page.waitForTimeout(500);

//             for (const tag of tags) {
//               await page.keyboard.type(tag, { delay: 30 });
//               await page.keyboard.press("Enter");
//               await page.waitForTimeout(300);
//             }
//             console.log("   ✅ 태그 입력 완료");
//           }
//         } catch (e) {
//           console.warn(`   ⚠️ 태그 입력 실패:`, e);
//         }
//       }

//       // 6. 최종 발행 버튼 클릭 (여러 시도)
//       console.log("   최종 발행 버튼 클릭 시도...");

//       const finalPublishSelectors = [
//         `${layerSelector} button.btn_confirm`,
//         `${layerSelector} button:has-text("발행")`,
//         'button.btn_confirm',
//         'button[class*="confirm"]',
//         'button:has-text("발행")'
//       ];

//       let published = false;
//       for (const selector of finalPublishSelectors) {
//         try {
//           const btn = await page.waitForSelector(selector, {
//             state: "visible",
//             timeout: 3000
//           });

//           if (btn) {
//             await btn.scrollIntoViewIfNeeded();
//             await page.waitForTimeout(300);

//             try {
//               await btn.click({ force: true, timeout: 3000 });
//             } catch (e) {
//               await btn.evaluate((el: any) => el.click());
//             }

//             console.log(`   ✅ 발행 버튼 클릭 성공: ${selector}`);
//             published = true;
//             break;
//           }
//         } catch (e) {
//           continue;
//         }
//       }

//       if (!published) {
//         // 최후의 수단: 모든 버튼 중 "발행" 텍스트 찾기
//         const allButtons = await page.locator('button').all();
//         for (const btn of allButtons) {
//           const text = await btn.textContent();
//           if (text && text.includes('발행')) {
//             try {
//               await btn.click({ force: true });
//               console.log("   ✅ 발행 버튼 클릭 성공 (텍스트 검색)");
//               published = true;
//               break;
//             } catch (e) {
//               continue;
//             }
//           }
//         }
//       }

//       if (!published) {
//         throw new Error("발행 버튼을 찾을 수 없거나 클릭에 실패했습니다");
//       }

//       // 7. 발행 완료 대기
//       await page.waitForTimeout(3000);

//       // URL 변경 또는 성공 메시지 확인
//       try {
//         await page.waitForURL(/.*\/\d+/, { timeout: 10000 });
//         console.log("✅ 발행 완료! 포스트 URL로 이동됨");
//       } catch (e) {
//         // URL이 변경되지 않았더라도 다이얼로그나 메시지로 성공 확인
//         const currentUrl = page.url();
//         if (currentUrl.includes('/postwrite')) {
//           console.warn("   ⚠️ 아직 작성 페이지에 있음. 발행 상태 불명확");
//         } else {
//           console.log("✅ 발행 완료 (URL 변경 감지)");
//         }
//       }

//     } catch (error) {
//       console.error("❌ 발행 프로세스 실패:", error);

//       // 디버깅을 위한 스크린샷 저장
//       try {
//         await page.screenshot({
//           path: `publish-error-${Date.now()}.png`,
//           fullPage: true
//         });
//         console.log("   📸 에러 스크린샷 저장됨");
//       } catch (e) {
//         // 스크린샷 실패는 무시
//       }

//       throw error;
//     }
//   }
// }
