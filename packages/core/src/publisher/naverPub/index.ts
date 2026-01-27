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
      // 1. 우측 상단 '발행' 버튼 (텍스트로 찾기)
      const openPublishLayerBtn = page
        .getByRole("button", { name: "발행" })
        .first();
      await openPublishLayerBtn.waitFor({ state: "visible", timeout: 5000 });
      await openPublishLayerBtn.click();
      console.log("   발행 설정 레이어 열기 성공");
      await page.waitForTimeout(1000);

      // 2. 카테고리 선택
      if (category) {
        try {
          console.log(`   카테고리 선택 시도: ${category}`);

          // 발행 레이어 내의 카테고리 선택 버튼 찾기 (.selectbox-source 클래스 사용)
          const categoryButton = page
            .locator(".publish_layer .selectbox-source")
            .first();

          await categoryButton.waitFor({ state: "visible", timeout: 3000 });

          const currentCategory = await categoryButton.innerText();
          console.log(`   현재 설정된 카테고리: [${currentCategory.trim()}]`);

          // 이미 선택된 카테고리와 같다면 변경 스킵
          if (currentCategory.trim() === category) {
            console.log(`   ✅ 이미 선택된 카테고리입니다. 변경을 건너뜁니다.`);
          } else {
            await categoryButton.click();
            await page.waitForTimeout(500);

            // 드롭다운 목록에서 항목 찾기
            const item = page
              .locator(".selectbox-list .selectbox-item")
              .filter({ hasText: category })
              .first();

            if ((await item.count()) > 0) {
              await item.click();
              console.log(`   ✅ 카테고리 변경 완료`);
            } else {
              console.warn(
                `   ⚠️ 목록에서 "${category}"를 찾을 수 없습니다. 기본값 유지.`,
              );
              // 드롭다운 닫기 위해 다시 클릭
              await categoryButton.click();
            }
          }
        } catch (e) {
          console.warn(`   ⚠️ 카테고리 선택 중 오류 발생 (무시하고 진행):`, e);
        }
      }

      // 3. 태그 입력 (입력 후 엔터)
      if (tags.length > 0) {
        console.log(`   태그 입력 시도: ${tags.join(", ")}`);
        const tagInput = page.locator(".tag_input").first();
        await tagInput.click(); // 포커스 확보
        await page.waitForTimeout(500);

        for (const tag of tags) {
          await page.keyboard.type(tag, { delay: 50 }); // 타이핑 시뮬레이션
          await page.keyboard.press("Enter");
          await page.waitForTimeout(300);
        }
      }

      // 4. 진짜 '발행' 버튼 클릭 (레이어 하단의 초록색 버튼)
      // 클래스명보다는 '발행'이라는 글자가 들어간 confirm 버튼을 찾는 게 정확함
      const finalBtn = page.locator(
        '.publish_layer .btn_confirm, .publish_layer button:has-text("발행")',
      );
      await finalBtn.waitFor({ state: "visible" });
      await finalBtn.click();

      console.log("✅ 최종 발행 성공!");
      await page.waitForTimeout(5000); // 실제 반영 대기
    } catch (error) {
      console.error("❌ 발행 중 에러:", error);
      // 에러 시 스크린샷을 찍어두면 디버깅하기 편함
      await page.screenshot({ path: `error-publish-${Date.now()}.png` });
      throw error;
    }
  }
}
