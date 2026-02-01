/// <reference lib="dom" />
import { Page } from "playwright";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { PexelsService } from "../../services/pexelImageService";

export class NaverEditor {
  private pexelsService = new PexelsService();
  private tempDir: string;

  constructor(
    private page: Page,
    projectRoot: string,
  ) {
    this.tempDir = path.join(projectRoot, "temp_images");
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 텍스트와 HTML에서 가비지 문구를 제거하는 유틸리티
   */
  private cleanContent(content: string): string {
    const garbageRegex =
      /(\(Image suggestion.*?\)|\[이미지.*?\]|\[사진.*?\]|이미지 삽입|삽입 위치|image suggestion:.*?\n?)/gi;
    return content.replace(garbageRegex, "").trim();
  }

  /**
   * 클립보드를 통해 HTML을 에디터에 붙여넣는 공통 함수
   */
  private async pasteHtml(html: string) {
    await this.page.evaluate((htmlContent) => {
      const type = "text/html";
      const blob = new Blob([htmlContent], { type });
      const data = [new ClipboardItem({ [type]: blob })];
      return navigator.clipboard.write(data);
    }, html);

    const isMac = process.platform === "darwin";
    const modifier = isMac ? "Meta" : "Control";
    await this.page.keyboard.press(`${modifier}+V`);
    await this.page.waitForTimeout(500); // 안정적인 붙여넣기 대기
  }
  // 팝업 클린
  public async clearPopups() {
    const CANCEL_SELECTOR = ".se-popup-button.se-popup-button-cancel";
    try {
      const cancelBtn = await this.page.waitForSelector(CANCEL_SELECTOR, {
        timeout: 3000,
      });
      if (cancelBtn) await cancelBtn.click();
    } catch (e) {}
    await this.page.keyboard.press("Escape");
  }
  // 타이틀
  public async enterTitle(title: string, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const titleSelector = ".se-title-text";
        await this.page.locator(titleSelector).first().click({ force: true });
        await this.page.waitForTimeout(500);

        const isMac = process.platform === "darwin";
        await this.page.keyboard.press(isMac ? "Meta+A" : "Control+A");
        await this.page.keyboard.press("Backspace");
        await this.page.keyboard.type(title, { delay: 30 });
        return;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await this.page.waitForTimeout(2000);
      }
    }
  }
  // 컨텐츠 삽입
  public async enterContent(htmlContent: string) {
    try {
      await this.page.keyboard.press("Escape");
      const bodySelector = '[data-a11y-title="본문"] .se-text-paragraph';
      await this.page.waitForSelector(bodySelector, { timeout: 5000 });
      await this.page.click(bodySelector, { force: true });
      await this.page.keyboard.press("ArrowDown");

      const textBlocks = this.htmlToTextBlocks(htmlContent);

      for (const block of textBlocks) {
        // 타이핑 전 가비지 제거
        block.html = this.cleanContent(block.html);
        block.text = this.cleanContent(block.text);

        if (
          !block.html &&
          block.type !== "separator" &&
          block.type !== "empty-line"
        )
          continue;

        switch (block.type) {
          case "separator":
            await this.page.keyboard.type("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            await this.page.keyboard.press("Enter");
            break;

          case "empty-line":
            await this.page.keyboard.press("Enter");
            break;

          case "blockquote-heading":
            const bqHeadHtml = `<blockquote><h2>${block.text}</h2></blockquote>`;
            await this.pasteHtml(bqHeadHtml);
            await this.page.keyboard.press("ArrowDown");
            await this.page.keyboard.press("Enter");

            // 이미지 업로드 로직
            const searchQuery = block.text
              .replace(/[^\w\s가-힣]/g, "")
              .split(" ")
              .slice(0, 2)
              .join(" ");

            const imagePath = await this.pexelsService.downloadImage(
              searchQuery,
              this.tempDir,
            );
            if (imagePath) {
              await this.uploadImage(this.page, imagePath);
              await this.page.waitForTimeout(1000);
              await this.page.keyboard.press("ArrowDown");
              await this.page.keyboard.press("Enter");
            }
            break;

          case "blockquote-paragraph":
            await this.pasteHtml(
              `<blockquote><p>${block.html}</p></blockquote>`,
            );
            await this.page.keyboard.press("ArrowDown");
            await this.page.keyboard.press("Enter");
            break;

          case "heading":
            const tag =
              block.prefix === "■ "
                ? "h1"
                : block.prefix === "▶ "
                  ? "h2"
                  : "h3";
            await this.pasteHtml(`<${tag}>${block.text}</${tag}>`);
            await this.page.keyboard.press("Enter");
            break;

          case "table":
            await this.pasteHtml(block.html);
            await this.page.keyboard.press("ArrowDown");
            await this.page.keyboard.press("Enter");
            break;

          // ✅ [복구 및 수정] 리스트 케이스 분리
          case "list":
            await this.pasteHtml(block.html);
            await this.page.keyboard.press("Enter");
            break;

          case "paragraph":

          default:
            // ✅ 핵심: 일반 문단과 리스트도 HTML로 붙여넣어 강조(**) 유지
            await this.pasteHtml(`<p>${block.html}</p>`);
            await this.page.keyboard.press("Enter");
            break;
        }
        await this.page.waitForTimeout(200);
      }
    } catch (error) {
      console.error("❌ 본문 입력 중 오류:", error);
    }
  }
  // html 을 text block 으로 변환
  private htmlToTextBlocks(html: string) {
    const blocks: any[] = [];
    const $ = cheerio.load(html);

    $("body")
      .children()
      .each((_, element) => {
        const $el = $(element);
        const tagName = element.tagName?.toLowerCase();
        const rawHtml = $el.html() || "";

        if (tagName === "hr") {
          blocks.push({ type: "separator", text: "" });
        } else if (tagName === "blockquote") {
          $el.children().each((_, child) => {
            const $child = $(child);
            const cTag = child.tagName?.toLowerCase();
            if (cTag?.match(/^h[1-6]$/)) {
              blocks.push({
                type: "blockquote-heading",
                text: $child.text().trim(),
                html: $child.html(),
              });
            } else {
              blocks.push({
                type: "blockquote-paragraph",
                text: $child.text().trim(),
                html: $child.html(),
              });
            }
          });
        } else if (tagName?.match(/^h[1-6]$/)) {
          let prefix = tagName === "h1" ? "■ " : tagName === "h2" ? "▶ " : "• ";
          blocks.push({
            type: "heading",
            text: $el.text().trim(),
            prefix,
            html: rawHtml,
          });
        } else if (tagName === "ul" || tagName === "ol") {
          $el.find("li").each((_, li) => {
            blocks.push({
              type: "list",
              text: $(li).text().trim(),
              html: $(li).html(),
            });
          });
        } else if (tagName === "table") {
          blocks.push({ type: "table", text: $el.text(), html: $.html($el) });
        } else {
          blocks.push({
            type: "paragraph",
            text: $el.text().trim(),
            html: rawHtml,
          });
        }
      });
    return blocks;
  }
  // 이미지 업로드
  private async uploadImage(page: Page, imagePath: string | null) {
    if (!imagePath || !fs.existsSync(imagePath)) {
      console.warn("⚠️ 이미지 파일이 존재하지 않습니다:", imagePath);
      return;
    }

    try {
      // ✅ 1단계: 이미지 업로드 직전에 팝업 및 모든 포커스 해제
      await page.keyboard.press("Escape"); // 현재 포커스 해제
      await this.clearPopups(); // ✅ 핵심 추가: 팝업 제거 함수 호출
      await page.waitForTimeout(500); // 팝업이 사라지는 애니메이션 등을 고려한 짧은 대기

      const beforeCount = await page.evaluate(
        () => document.querySelectorAll("img").length,
      );

      // ✅ 2단계: 에러 방지를 위한 Promise 핸들링 추가
      const fileChooserPromise = page
        .waitForEvent("filechooser", { timeout: 10000 })
        .catch(() => null);

      // ✅ 3단계: 버튼 클릭 성공률 높이기 (여러 셀렉터 시도)
      const selectors = [
        'button[data-log="image"]',
        ".se-image-toolbar-button",
        'button[aria-label="사진"]',
      ];

      let clicked = false;
      for (const selector of selectors) {
        const btn = page.locator(selector).first();
        if (await btn.isVisible()) {
          await btn.click({ force: true });
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        // 기본 시도
        await page
          .locator('button[data-log="image"]')
          .first()
          .click({ force: true });
      }

      const fileChooser = await fileChooserPromise;
      if (!fileChooser) {
        console.warn("⚠️ 파일 선택창이 열리지 않아 업로드를 건너뜁니다.");
        return;
      }

      await fileChooser.setFiles(imagePath);

      // 이미지가 실제로 업로드되어 DOM에 추가될 때까지 대기
      await page.waitForFunction(
        (prevCount) => document.querySelectorAll("img").length > prevCount,
        beforeCount,
        { timeout: 10000 },
      );

      console.log("✅ 이미지 업로드 성공:", imagePath);
    } catch (error) {
      console.error("❌ 이미지 업로드 실패:", error);
    }
  }
}
