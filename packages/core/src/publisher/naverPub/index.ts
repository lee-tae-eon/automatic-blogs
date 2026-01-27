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
    // 1. 변수를 try 외부에서 선언 (Scope 확장)
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

        // 1. 발행 확인이나 저장 관련은 무조건 '확인(accept)'
        if (
          message.includes("발행") ||
          message.includes("등록") ||
          message.includes("저장") ||
          dialog.type() === "beforeunload"
        ) {
          console.log("   ✅ 다이얼로그 승인(accept)");
          await dialog.accept();
        }
        // 2. 그 외(오류 알림 등)는 내용을 확인하기 위해 일단 수용하거나 상황에 따라 처리
        else {
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

        // 이제 try 밖에서 선언한 currentTaskName을 안전하게 사용 가능
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

        const actualText = await page
          .locator(titleSelector)
          .first()
          .evaluate((el: HTMLElement) => el.innerText.trim());

        console.log(`      예상: "${title}"`);
        console.log(`      실제: "${actualText}"`);

        // 이모지 정규화 비교
        const normalize = (str: string) => {
          return (
            str
              // .replace(/[\uFE00-\uFE0F]/g, "") // Variation Selectors 전체 제거
              // .replace(/[\u200B-\u200D\uFEFF]/g, "") // Zero-width 문자 제거
              // .normalize("NFC") // 유니코드 정규화
              .trim()
          );
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
          console.log(`   [테이블] 클립보드 붙여넣기 시도...`);

          // 1. 클립보드에 HTML 쓰기 (브라우저 API 사용)
          await page.evaluate((html) => {
            const type = "text/html";
            const blob = new Blob([html], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            return navigator.clipboard.write(data);
          }, block.text);

          // 2. 붙여넣기 단축키 (Ctrl+V / Cmd+V)
          const isMac = process.platform === "darwin";
          const modifier = isMac ? "Meta" : "Control";
          await page.keyboard.press(`${modifier}+V`);

          await page.waitForTimeout(1000);

          // 3. 커서 정리 (표 아래로 이동)
          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter");
          await page.waitForTimeout(50);
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
              $child.find("li").each((idx, li) => {
                // 리스트 내부 텍스트에 이미 번호나 불렛이 있다면 제거
                const text = $(li).text().trim();
                // .replace(/^(\d+[\.\)]|[-•*])\s+/, "");
                if (text) {
                  const prefix = childTag === "ol" ? `  ${idx + 1}. ` : "  • ";
                  blocks.push({ type: "list", text, prefix });
                }
              });
              blocks.push({ type: "empty-line", text: "" }); // 리스트 아래 빈 줄
              return;
            }

            // Blockquote 안의 테이블
            if (childTag === "table") {
              $child.find("tr").each((idx, tr) => {
                const cells: string[] = [];
                $(tr)
                  .find("th, td")
                  .each((_, cell) => {
                    cells.push($(cell).text().trim());
                  });

                if (cells.length > 0) {
                  const rowText = cells.join(" │ "); // 세로선으로 구분
                  blocks.push({ type: "table-row", text: rowText });
                }
              });
              blocks.push({ type: "empty-line", text: "" }); // 테이블 아래 빈 줄
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

        // 일반 리스트 (blockquote 밖)
        if (tagName === "ul" || tagName === "ol") {
          $el.find("li").each((idx, li) => {
            // 리스트 내부 텍스트에 이미 번호나 불렛이 있다면 제거 (중복 방지)
            const text = $(li).text().trim();
            // .replace(/^(\d+[\.\)]|[-•*])\s+/, "");
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
          // 테이블은 HTML 통째로 저장하여 붙여넣기 처리
          // 네이버 에디터 호환성을 위해 불필요한 속성 제거
          $el
            .find("*")
            .removeAttr("class")
            .removeAttr("style")
            .removeAttr("id");
          $el.removeAttr("class").removeAttr("style").removeAttr("id");

          // ✅ 스타일 강제 주입 (네이버 에디터가 인식하도록)
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
  private async publish(page: Page, tags: string[] = [], category?: string) {
    console.log("\n🚀 발행 프로세스 시작...");

    try {
      // 1. 에디터 상태 안정화 (불필요한 팝업/포커스 제거)
      await page.keyboard.press("Escape");
      await page.evaluate(() => window.scrollTo(0, 0)); // 최상단으로 스크롤하여 버튼 노출 보장
      await page.waitForTimeout(1000);

      // 2. 우측 상단 '발행' 버튼 클릭
      // .btn_publish 클래스나 "발행" 텍스트를 가진 버튼을 찾습니다.
      const openPublishLayerBtn = page
        .locator('button:has-text("발행"), .btn_publish')
        .first();
      await openPublishLayerBtn.waitFor({ state: "visible", timeout: 10000 });

      // Playwright의 click이 타임아웃 날 경우를 대비해 evaluate 클릭 병행
      await openPublishLayerBtn.click({ force: true }).catch(async () => {
        console.warn("   ⚠️ 일반 클릭 실패, JS 주입 클릭 시도...");
        await openPublishLayerBtn.evaluate((el: HTMLElement) => el.click());
      });
      console.log("   발행 설정 레이어 호출 완료");

      // 3. 레이어 감지 (텍스트 기반 검증)
      // 네이버 레이어는 .publish_layer 또는 .section_publish 등 클래스가 자주 바뀜
      const layerSelector =
        ".publish_layer, .section_publish, .publish_layer_container";
      const categoryLabel = page
        .locator(
          `${layerSelector} span:has-text("카테고리"), ${layerSelector} label:has-text("카테고리")`,
        )
        .first();

      try {
        await categoryLabel.waitFor({ state: "visible", timeout: 8000 });
        console.log("   ✅ 발행 설정 레이어 감지 성공");
      } catch (e) {
        console.warn("   ⚠️ 레이어 미감지, 재클릭 시도...");
        await openPublishLayerBtn.evaluate((el: HTMLElement) => el.click());
        await categoryLabel.waitFor({ state: "visible", timeout: 5000 });
      }

      // 4. 카테고리 선택
      if (category) {
        console.log(`   카테고리 선택 시도: ${category}`);
        // 레이어 내부의 카테고리 셀렉트 박스
        const categorySelect = page
          .locator(`${layerSelector} .selectbox-source`)
          .first();
        await categorySelect.click({ force: true });
        await page.waitForTimeout(1000);

        // 정확히 카테고리 텍스트와 일치하는 아이템 선택 (RegExp ^$ 사용)
        const item = page
          .locator(".selectbox-item, .list_category li")
          .filter({ hasText: new RegExp(`^${category}$`) })
          .first();

        if (await item.isVisible()) {
          await item.click();
          console.log(`   ✅ 카테고리 변경 완료: ${category}`);
        } else {
          console.warn(
            `   ⚠️ [${category}]를 목록에서 찾을 수 없어 기본 설정 유지`,
          );
          await categorySelect.click(); // 다시 눌러서 닫기
        }
      }

      // 5. 태그 입력
      if (tags && tags.length > 0) {
        const tagInput = page
          .locator(
            `${layerSelector} .tag_input, ${layerSelector} input[placeholder*="태그"]`,
          )
          .first();
        await tagInput.scrollIntoViewIfNeeded();
        await tagInput.click({ force: true });

        for (const tag of tags) {
          // 태그 한 글자씩 입력하는 대신 한꺼번에 입력 후 엔터 (속도 및 안정성)
          await page.keyboard.type(tag, { delay: 30 });
          await page.keyboard.press("Enter");
          await page.waitForTimeout(200);
        }
        console.log("   ✅ 태그 입력 완료");
      }

      // 6. 최종 '발행' 버튼 (초록색 버튼)
      // 레이어 내부에 있는 버튼 중 '발행' 텍스트를 가진 마지막 버튼을 찾습니다.
      const finalBtn = page
        .locator(
          `${layerSelector} button.btn_confirm, ${layerSelector} button:has-text("발행")`,
        )
        .last();

      await finalBtn.waitFor({ state: "visible" });
      await finalBtn.click({ force: true });

      console.log("✅ 최종 발행 완료 버튼 클릭 성공!");

      // 7. 발행 후 완료 페이지 이동 대기 (URL 변화 또는 특정 요소 사라짐 대기)
      await page.waitForTimeout(5000);
    } catch (error) {
      throw error;
    }
  }
}
