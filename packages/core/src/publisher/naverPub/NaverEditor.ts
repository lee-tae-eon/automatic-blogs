/// <reference lib="dom" />
import { Page } from "playwright";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { PexelsService } from "../../services/pexelImageService";

export class NaverEditor {
  private pexelsService = new PexelsService();
  private tempDir: string;
  private topic: string;
  private tags: string[];
  private persona: string;

  constructor(
    private page: Page,
    projectRoot: string,
    topic: string,
    tags: string[] = [],
    persona: string = "informative",
  ) {
    this.tempDir = path.join(projectRoot, "temp_images");
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    this.topic = topic;
    this.tags = tags;
    this.persona = persona;
  }

  private cleanContent(content: string): string {
    const garbageRegex = /(\(Image suggestion.*?\)|image suggestion:.*?\n?)/gi;
    return content.replace(garbageRegex, "").trim();
  }

  private async pasteHtml(htmlContent: string) {
    await this.page.evaluate((html) => {
      const type = "text/html";
      const blob = new Blob([html], { type });
      const data = [new ClipboardItem({ [type]: blob })];
      return navigator.clipboard.write(data);
    }, htmlContent);

    const isMac = process.platform === "darwin";
    const modifier = isMac ? "Meta" : "Control";
    await this.page.keyboard.press(`${modifier}+V`);
    await this.page.waitForTimeout(300); // 붙여넣기 안정화 대기
  }

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

  public async enterContent(htmlContent: string) {
    try {
      await this.page.keyboard.press("Escape");
      const bodySelector = '[data-a11y-title="본문"] .se-text-paragraph';
      await this.page.waitForSelector(bodySelector, { timeout: 5000 });
      await this.page.click(bodySelector, { force: true });
      await this.page.keyboard.press("ArrowDown");

      const textBlocks = this.htmlToTextBlocks(htmlContent);
      let imageCount = 0;
      const MAX_IMAGES = 3;
      const usedKeywords = new Set<string>();

      for (const block of textBlocks) {
        // 1. 내용 정제
        if (block.html) block.html = this.cleanContent(block.html);
        if (block.text) block.text = this.cleanContent(block.text);

        // 빈 블록 스킵 (단, 구분선 등은 제외)
        if (
          !block.html &&
          !block.text &&
          block.type !== "separator" &&
          block.type !== "image"
        )
          continue;

        // 2. 블록 타입별 처리
        switch (block.type) {
          case "separator":
            await this.page.keyboard.type("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            await this.page.keyboard.press("Enter");
            await this.page.keyboard.press("Enter"); // 여백 확보
            break;

          case "heading":
            // 제목은 굵게, 위아래 엔터로 구분
            if (!block.text) break;
            await this.page.keyboard.press("Enter"); // 위 여백
            await this.pasteHtml(`<h3>${block.text}</h3>`); // H3 태그 사용 (네이버 에디터가 소제목으로 인식)
            await this.page.keyboard.press("Enter"); // 아래 여백
            break;

          case "blockquote-paragraph":
          case "blockquote-heading":
            if (!block.html) break;
            // 인용구는 그대로 붙여넣기
            await this.pasteHtml(`<blockquote>${block.html}</blockquote>`);
            await this.page.keyboard.press("Enter");
            break;

          case "table":
            if (!block.html) break;
            // 표는 그대로 붙여넣기 (스타일 없이)
            await this.pasteHtml(block.html);
            await this.page.keyboard.press("Enter");
            await this.page.keyboard.press("Enter"); // 표 아래 여백
            break;

          case "list":
            // 리스트는 HTML 그대로
            await this.pasteHtml(block.html);
            await this.page.keyboard.press("Enter");
            break;

          case "image":
            if (imageCount >= MAX_IMAGES) break;
            let rawKeyword = block.keyword || this.topic;
            let cleanKeyword = rawKeyword
              .replace(/[\[\]]/g, "")
              .replace(/이미지\s*:/, "")
              .replace(/[^\w\s가-힣]/g, " ")
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .join(" ");
            if (!cleanKeyword || cleanKeyword.length < 2)
              cleanKeyword = `${this.topic} ${cleanKeyword}`;
            if (usedKeywords.has(cleanKeyword)) break;

            try {
              const imagePath = await this.pexelsService.downloadImage(
                cleanKeyword,
                this.tempDir,
              );
              if (imagePath) {
                await this.page.keyboard.press("Enter"); // 이미지 위 여백
                await this.uploadImage(this.page, imagePath);
                await this.page.waitForTimeout(500);
                await this.page.keyboard.press("ArrowDown"); // 이미지 선택 해제
                await this.page.keyboard.press("Enter"); // 이미지 아래 여백
                imageCount++;
                usedKeywords.add(cleanKeyword);
              }
            } catch (e) {
              console.error(e);
            }
            break;

          case "paragraph":
          default:
            if (!block.html) break;
            // 일반 문단: 스타일 없이 붙여넣고 엔터로 숨쉬기
            await this.pasteHtml(`<p>${block.text || block.html}</p>`);
            await this.page.keyboard.press("Enter");
            await this.page.keyboard.press("Enter"); // 문단 간격 (Chunking)
            break;
        }
        await this.page.waitForTimeout(50); // 타이핑 안정화
      }
    } catch (error) {
      console.error("❌ 본문 입력 중 오류:", error);
    }
  }

  private htmlToTextBlocks(html: string) {
    const blocks: any[] = [];
    const $ = cheerio.load(html);
    const $root =
      $(".post-content").length > 0 ? $(".post-content") : $("body");

    $root.children().each((_, element) => {
      const $el = $(element);
      const tagName = element.tagName?.toLowerCase();
      const rawHtml = $el.html() || "";
      const textContent = $el.text().trim();
      const imageRegex = /\[이미지\s*:\s*(.*?)\]/i;
      const imageMatch = textContent.match(imageRegex);

      if (imageMatch) {
        blocks.push({ type: "image", keyword: imageMatch[1].trim() });
        return;
      }

      if (tagName === "hr") {
        blocks.push({ type: "separator", text: "" });
      } else if (tagName === "blockquote") {
        blocks.push({
          type: "blockquote-paragraph",
          html: $.html($el), // 인용구 전체 유지
        });
      } else if (tagName?.match(/^h[1-6]$/)) {
        blocks.push({ type: "heading", text: textContent, html: rawHtml });
      } else if (tagName === "ul" || tagName === "ol") {
        blocks.push({ type: "list", text: textContent, html: $.html($el) });
      } else if (tagName === "table") {
        blocks.push({ type: "table", text: $el.text(), html: $.html($el) });
      } else {
        // 문단은 p 태그로 감싸져 있다고 가정하되, 내용만 추출
        blocks.push({ type: "paragraph", text: textContent, html: rawHtml });
      }
    });
    return blocks;
  }

  private async uploadImage(page: Page, imagePath: string | null) {
    if (!imagePath || !fs.existsSync(imagePath)) return;
    try {
      await page.keyboard.press("Escape");
      await this.clearPopups();
      await page.waitForTimeout(200);
      const beforeCount = await page.evaluate(
        () => document.querySelectorAll("img").length,
      );
      const fileChooserPromise = page
        .waitForEvent("filechooser", { timeout: 10000 })
        .catch(() => null);
      
      // 이미지 버튼 셀렉터 단순화
      const btn = page.locator('button[data-log="image"], .se-image-toolbar-button').first();
      if (await btn.isVisible()) {
        await btn.click({ force: true });
      }
      
      const fileChooser = await fileChooserPromise;
      if (fileChooser) {
        await fileChooser.setFiles(imagePath);
        await page.waitForFunction(
          (prevCount) => document.querySelectorAll("img").length > prevCount,
          beforeCount,
          { timeout: 10000 },
        );
      }
    } catch (e) {
      console.error("업로드 실패", e);
    }
  }
}