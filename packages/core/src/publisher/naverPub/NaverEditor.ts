/// <reference lib="dom" />
import { Page } from "playwright";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { PexelsService } from "../../services/pexelImageService";

/**
 * 🎨 스타일 상수
 */
const CONTENT_LAYOUT_STYLE: string = `
  max-width: 520px;
  margin: 0 auto;
  padding: 0 20px;
  line-height: 2.2;
  word-break: keep-all;
  font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  color: #333;
  font-weight: 400;
  letter-spacing: -0.3px;
  font-size: 15px;
`.replace(/\n/g, "");

const PARAGRAPH_STYLE: string = `
  display: block;
  margin-bottom: 30px;
  font-size: 15px;
  line-height: 2.2;
  color: #333;
  font-weight: normal !important;
`.replace(/\n/g, "");

const VERTICAL_BAR_HEADING_STYLE: string = `
  display: block;
  border-left: 5px solid #222;
  padding-left: 12px;
  margin: 50px 0 20px 0;
  font-size: 19px;
  font-weight: bold;
  color: #111;
  line-height: 1.3;
  letter-spacing: -0.5px;
  font-family: 'Apple SD Gothic Neo', sans-serif;
  clear: both;
`.replace(/\n/g, "");

const SIDE_BAR_QUOTE_STYLE: string = `
  border-left: 4px solid #ccc;
  padding-left: 15px;
  margin: 30px 0;
  color: #666;
  font-style: normal;
  background-color: transparent;
  font-weight: normal;
`.replace(/\n/g, "");

interface TextBlock {
  type:
    | "separator"
    | "empty-line"
    | "blockquote-heading"
    | "blockquote-paragraph"
    | "heading"
    | "table"
    | "list"
    | "image"
    | "paragraph";
  text?: string;
  html?: string;
  keyword?: string;
}

export class NaverEditor {
  private pexelsService: PexelsService;
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
    this.pexelsService = new PexelsService();
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

  private wrapParagraph(html: string): string {
    if (!html || html.trim() === "") return "";

    if (html.startsWith("<p")) {
      return html.replace(/<p/g, `<p style="${PARAGRAPH_STYLE}"`);
    }

    return `<p style="${PARAGRAPH_STYLE}">${html}</p>`;
  }

  private styleTable(html: string): string {
    const $ = cheerio.load(html, { xmlMode: false }, false);

    $("table").css({
      "border-collapse": "collapse",
      width: "100%",
      margin: "30px 0",
      "border-top": "2px solid #333",
      "font-size": "13px",
      "font-weight": "normal",
      "table-layout": "fixed",
    });

    $("th").css({
      padding: "10px 5px",
      "border-bottom": "1px solid #ccc",
      "background-color": "#f9f9f9",
      "font-weight": "bold",
      color: "#333",
      "text-align": "center",
      "word-break": "keep-all",
      "font-size": "13px",
      "letter-spacing": "-0.5px",
    });

    $("td").css({
      padding: "10px 5px",
      "border-bottom": "1px solid #eee",
      color: "#555",
      "line-height": "1.4",
      "font-weight": "normal",
      "word-break": "keep-all",
      "vertical-align": "middle",
      "font-size": "13px",
    });

    return $.html() || html;
  }

  private async pasteHtml(htmlContent: string): Promise<void> {
    await this.page.evaluate((html: string) => {
      const type = "text/html";
      const blob = new Blob([html], { type });
      const data = [new ClipboardItem({ [type]: blob })];
      return navigator.clipboard.write(data);
    }, htmlContent);

    const isMac = process.platform === "darwin";
    const modifier = isMac ? "Meta" : "Control";
    await this.page.keyboard.press(`${modifier}+V`);
    await this.page.waitForTimeout(200);
  }

  public async clearPopups(): Promise<void> {
    const CANCEL_SELECTOR = ".se-popup-button.se-popup-button-cancel";
    try {
      const cancelBtn = await this.page.waitForSelector(CANCEL_SELECTOR, {
        timeout: 3000,
      });
      if (cancelBtn) await cancelBtn.click();
    } catch (e) {}
    await this.page.keyboard.press("Escape");
  }

  public async enterTitle(
    title: string,
    maxRetries: number = 3,
  ): Promise<void> {
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

  public async enterContent(htmlContent: string): Promise<void> {
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
        if (block.html) block.html = this.cleanContent(block.html);
        if (block.text) block.text = this.cleanContent(block.text);

        if (
          !block.html &&
          !block.text &&
          block.type !== "separator" &&
          block.type !== "empty-line" &&
          block.type !== "image"
        ) {
          continue;
        }

        switch (block.type) {
          case "separator":
            await this.page.keyboard.type("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            await this.page.keyboard.press("Enter");
            break;

          case "empty-line":
            break;

          case "blockquote-heading":
          case "heading":
            if (!block.text) break;
            await this.pasteHtml(`<div>${block.text}</div>`);
            await this.page.keyboard.press("Enter");
            break;

          case "blockquote-paragraph":
            if (!block.html) break;
            const content = block.html
              .replace(/<p>/g, "")
              .replace(/<\/p>/g, "");
            await this.pasteHtml(`<blockquote>${content}</blockquote>`);
            await this.page.keyboard.press("Enter");
            break;

          case "table":
            if (!block.html) break;
            const styledTable = this.styleTable(block.html);
            await this.pasteHtml(styledTable);
            await this.page.keyboard.press("Enter");
            break;

          case "list":
            if (!block.html) break;
            await this.pasteHtml(block.html);
            await this.page.keyboard.press("Enter");
            break;

          case "image":
            if (this.persona === "hollywood-reporter") break;
            if (imageCount >= MAX_IMAGES) break;

            const rawKeyword = block.keyword || this.topic;
            let cleanKeyword = rawKeyword
              .replace(/[\[\]]/g, "")
              .replace(/이미지\s*:/, "")
              .replace(/[^\w\s가-힣]/g, " ")
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .join(" ");

            if (!cleanKeyword || cleanKeyword.length < 2) {
              cleanKeyword = `${this.topic} ${cleanKeyword}`;
            }

            if (usedKeywords.has(cleanKeyword)) break;

            try {
              const imagePath = await this.pexelsService.downloadImage(
                cleanKeyword,
                this.tempDir,
              );
              if (imagePath) {
                await this.uploadImage(this.page, imagePath);
                await this.page.waitForTimeout(500);
                await this.page.keyboard.press("ArrowDown");
                await this.page.keyboard.press("Enter");
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
            await this.pasteHtml(`<p>${block.html}</p>`);
            await this.page.keyboard.press("Enter");
            break;
        }
        await this.page.waitForTimeout(80);
      }

      // ✅ 핵심: 모든 콘텐츠 입력 완료 후 스타일 주입
      console.log("\n🎨 스타일 적용 중...");
      await this.applyCustomStyles();
      console.log("✅ 스타일 적용 완료\n");
    } catch (error) {
      console.error("❌ 본문 입력 중 오류:", error);
    }
  }

  /**
   * ✅ DOM에 직접 스타일 주입 (네이버 필터링 우회)
   */
  private async applyCustomStyles(): Promise<void> {
    await this.page.evaluate(
      (styles: {
        layout: string;
        paragraph: string;
        heading: string;
        quote: string;
      }) => {
        const editor = document.querySelector('[data-a11y-title="본문"]');
        if (!editor) {
          console.warn("본문 영역을 찾을 수 없음");
          return;
        }

        // 1. 전체 콘텐츠를 520px 래퍼로 감싸기
        const existingWrapper = editor.querySelector(".custom-layout-wrapper");
        if (!existingWrapper) {
          const wrapper = document.createElement("div");
          wrapper.className = "custom-layout-wrapper";
          wrapper.setAttribute("style", styles.layout);

          while (editor.firstChild) {
            wrapper.appendChild(editor.firstChild);
          }

          editor.appendChild(wrapper);
          console.log("✓ 520px Layout wrapper 적용");
        }

        // 2. 모든 문단(p)에 스타일 적용
        const paragraphs = editor.querySelectorAll("p");
        paragraphs.forEach((p) => {
          p.setAttribute("style", styles.paragraph);
        });
        console.log(`✓ 문단 스타일 적용 (${paragraphs.length}개)`);

        // 3. 모든 div (소제목용)에 스타일 적용
        const divs = editor.querySelectorAll("div:not(.custom-layout-wrapper)");
        divs.forEach((div) => {
          // 소제목으로 보이는 div만 (텍스트가 있고, 이미지/테이블 아님)
          const hasText = div.textContent && div.textContent.trim().length > 0;
          const hasNoImage = !div.querySelector("img");
          const hasNoTable = !div.querySelector("table");

          if (hasText && hasNoImage && hasNoTable) {
            div.setAttribute("style", styles.heading);
          }
        });
        console.log("✓ 소제목 스타일 적용");

        // 4. 모든 blockquote에 스타일 적용
        const blockquotes = editor.querySelectorAll("blockquote");
        blockquotes.forEach((bq) => {
          bq.setAttribute("style", styles.quote);
        });
        console.log(`✓ Blockquote 스타일 적용 (${blockquotes.length}개)`);

        // 5. 리스트에 스타일 적용
        const lists = editor.querySelectorAll("ul, ol");
        lists.forEach((list) => {
          list.setAttribute(
            "style",
            "font-weight: normal; line-height: 2.2; font-size: 15px; margin-bottom: 30px;",
          );
        });
        console.log(`✓ 리스트 스타일 적용 (${lists.length}개)`);
      },
      {
        layout: CONTENT_LAYOUT_STYLE,
        paragraph: PARAGRAPH_STYLE,
        heading: VERTICAL_BAR_HEADING_STYLE,
        quote: SIDE_BAR_QUOTE_STYLE,
      },
    );

    await this.page.waitForTimeout(500);
  }

  private htmlToTextBlocks(html: string): TextBlock[] {
    const blocks: TextBlock[] = [];
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
        $el.children().each((_, child) => {
          const $child = $(child);
          const childTagName = child.tagName?.toLowerCase();
          const cText = $child.text().trim();

          if (childTagName?.match(/^h[1-6]$/)) {
            blocks.push({
              type: "heading",
              text: cText,
              html: $child.html() || undefined,
            });
          } else {
            blocks.push({
              type: "blockquote-paragraph",
              text: cText,
              html: $.html($child),
            });
          }
        });
      } else if (tagName?.match(/^h[1-6]$/)) {
        blocks.push({ type: "heading", text: textContent, html: rawHtml });
      } else if (tagName === "ul" || tagName === "ol") {
        blocks.push({ type: "list", text: textContent, html: $.html($el) });
      } else if (tagName === "table") {
        blocks.push({ type: "table", text: $el.text(), html: $.html($el) });
      } else {
        blocks.push({ type: "paragraph", text: textContent, html: rawHtml });
      }
    });
    return blocks;
  }

  private async uploadImage(
    page: Page,
    imagePath: string | null,
  ): Promise<void> {
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

      const selectors = [
        'button[data-log="image"]',
        ".se-image-toolbar-button",
        'button[aria-label="사진"]',
      ];

      let clicked = false;
      for (const selector of selectors) {
        const btn = page.locator(selector).first();
        const isVisible = await btn.isVisible().catch(() => false);
        if (isVisible) {
          await btn.click({ force: true });
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        await page
          .locator('button[data-log="image"]')
          .first()
          .click({ force: true });
      }

      const fileChooser = await fileChooserPromise;
      if (fileChooser) {
        await fileChooser.setFiles(imagePath);
        await page.waitForFunction(
          (prevCount: number) =>
            document.querySelectorAll("img").length > prevCount,
          beforeCount,
          { timeout: 10000 },
        );
        console.log("✅ 이미지 업로드 성공");
      }
    } catch (e) {
      console.error("업로드 실패", e);
    }
  }
}
// /// <reference lib="dom" />
// import { Page } from "playwright";
// import * as cheerio from "cheerio";
// import fs from "fs";
// import path from "path";
// import { PexelsService } from "../../services/pexelImageService";

// /**
//  * 🎨 [1] 전체 레이아웃
//  * - font-size: 15px (기존 대비 1~2px 축소)
//  * - line-height: 2.2 (시원시원하게)
//  */
// const CONTENT_LAYOUT_STYLE = `
//   max-width: 520px;
//   margin: 0 auto;
//   padding: 0 20px;
//   line-height: 2.2;
//   word-break: keep-all;
//   font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
//   color: #333;
//   font-weight: 400;
//   letter-spacing: -0.3px;
//   font-size: 15px;
// `.replace(/\n/g, "");

// /**
//  * 🎨 [2] 문단 스타일 (덩어리감 형성)
//  * - margin-bottom: 30px (문단 덩어리 사이를 확실히 띄움)
//  * - display: block (블록 요소 강제)
//  */
// const PARAGRAPH_STYLE = `
//   display: block;
//   margin-bottom: 30px;
//   font-size: 15px;
//   line-height: 2.2;
//   color: #333;
//   font-weight: normal !important;
// `.replace(/\n/g, "");

// /**
//  * 🎨 [3] 소제목 스타일 (19px 유지)
//  */
// const VERTICAL_BAR_HEADING_STYLE = `
//   display: block;
//   border-left: 5px solid #222;
//   padding-left: 12px;
//   margin: 50px 0 20px 0;
//   font-size: 19px;
//   font-weight: bold;
//   color: #111;
//   line-height: 1.3;
//   letter-spacing: -0.5px;
//   font-family: 'Apple SD Gothic Neo', sans-serif;
//   clear: both;
// `.replace(/\n/g, "");

// const SIDE_BAR_QUOTE_STYLE = `
//   border-left: 4px solid #ccc;
//   padding-left: 15px;
//   margin: 30px 0;
//   color: #666;
//   font-style: normal;
//   background-color: transparent;
//   font-weight: normal;
// `.replace(/\n/g, "");

// export class NaverEditor {
//   private pexelsService = new PexelsService();
//   private tempDir: string;
//   private topic: string;
//   private tags: string[];
//   private persona: string;

//   constructor(
//     private page: Page,
//     projectRoot: string,
//     topic: string,
//     tags: string[] = [],
//     persona: string = "informative",
//   ) {
//     this.tempDir = path.join(projectRoot, "temp_images");
//     if (!fs.existsSync(this.tempDir)) {
//       fs.mkdirSync(this.tempDir, { recursive: true });
//     }
//     this.topic = topic;
//     this.tags = tags;
//     this.persona = persona;
//   }

//   private cleanContent(content: string): string {
//     const garbageRegex = /(\(Image suggestion.*?\)|image suggestion:.*?\n?)/gi;
//     return content.replace(garbageRegex, "").trim();
//   }

//   /**
//    * ⚡️ [Algorithm] 텍스트 재조립 함수
//    * AI가 생성한 HTML 문단을 네이버 에디터 스타일에 맞게 래핑합니다.
//    */
//   private wrapParagraph(html: string): string {
//     if (!html || html.trim() === "") return "";

//     // 이미 <p> 태그로 감싸져 있다면 스타일만 주입, 아니면 새로 감쌈
//     if (html.startsWith("<p")) {
//       return html.replace(/<p/g, `<p style="${PARAGRAPH_STYLE}"`);
//     }

//     return `<p style="${PARAGRAPH_STYLE}">${html}</p>`;
//   }

//   private styleTable(html: string): string {
//     const $ = cheerio.load(html, { xmlMode: false }, false);

//     $("table").css({
//       "border-collapse": "collapse",
//       width: "100%",
//       margin: "30px 0",
//       "border-top": "2px solid #333",
//       "font-size": "13px",
//       "font-weight": "normal",
//       "table-layout": "fixed",
//     });

//     $("th").css({
//       padding: "10px 5px", // 좌우 패딩을 줄여서 공간 확보
//       "border-bottom": "1px solid #ccc",
//       "background-color": "#f9f9f9",
//       "font-weight": "bold",
//       color: "#333",
//       "text-align": "center",
//       "word-break": "keep-all",
//       "font-size": "13px",
//       "letter-spacing": "-0.5px", // 자간을 좁혀서 더 많이 들어가게
//     });

//     $("td").css({
//       padding: "10px 5px",
//       "border-bottom": "1px solid #eee",
//       color: "#555",
//       "line-height": "1.4", // 테이블 내부는 줄간격 좁힘
//       "font-weight": "normal",
//       "word-break": "keep-all", // 단어 중간에 끊기지 않도록
//       "vertical-align": "middle",
//       "font-size": "13px",
//     });

//     return $.html() || html;
//   }

//   private async pasteHtml(
//     htmlContent: string,
//     useDefaultLayout: boolean = true,
//   ) {
//     let finalHtml = htmlContent;

//     if (
//       useDefaultLayout &&
//       !htmlContent.startsWith('<div style="') &&
//       !htmlContent.includes(CONTENT_LAYOUT_STYLE)
//     ) {
//       finalHtml = `<div style="${CONTENT_LAYOUT_STYLE}">${htmlContent}</div>`;
//     }

//     await this.page.evaluate((html) => {
//       const type = "text/html";
//       const blob = new Blob([html], { type });
//       const data = [new ClipboardItem({ [type]: blob })];
//       return navigator.clipboard.write(data);
//     }, finalHtml);

//     const isMac = process.platform === "darwin";
//     const modifier = isMac ? "Meta" : "Control";
//     await this.page.keyboard.press(`${modifier}+V`);
//     await this.page.waitForTimeout(200);
//   }

//   public async clearPopups() {
//     const CANCEL_SELECTOR = ".se-popup-button.se-popup-button-cancel";
//     try {
//       const cancelBtn = await this.page.waitForSelector(CANCEL_SELECTOR, {
//         timeout: 3000,
//       });
//       if (cancelBtn) await cancelBtn.click();
//     } catch (e) {}
//     await this.page.keyboard.press("Escape");
//   }

//   public async enterTitle(title: string, maxRetries = 3) {
//     for (let attempt = 1; attempt <= maxRetries; attempt++) {
//       try {
//         const titleSelector = ".se-title-text";
//         await this.page.locator(titleSelector).first().click({ force: true });
//         await this.page.waitForTimeout(500);

//         const isMac = process.platform === "darwin";
//         await this.page.keyboard.press(isMac ? "Meta+A" : "Control+A");
//         await this.page.keyboard.press("Backspace");
//         await this.page.keyboard.type(title, { delay: 30 });
//         return;
//       } catch (error) {
//         if (attempt === maxRetries) throw error;
//         await this.page.waitForTimeout(2000);
//       }
//     }
//   }

//   public async enterContent(htmlContent: string) {
//     try {
//       await this.page.keyboard.press("Escape");
//       const bodySelector = '[data-a11y-title="본문"] .se-text-paragraph';
//       await this.page.waitForSelector(bodySelector, { timeout: 5000 });
//       await this.page.click(bodySelector, { force: true });
//       await this.page.keyboard.press("ArrowDown");

//       const textBlocks = this.htmlToTextBlocks(htmlContent);
//       let imageCount = 0;
//       const MAX_IMAGES = 3;
//       const usedKeywords = new Set<string>();

//       for (const block of textBlocks) {
//         if (block.html) block.html = this.cleanContent(block.html);
//         if (block.text) block.text = this.cleanContent(block.text);

//         if (
//           !block.html &&
//           !block.text &&
//           block.type !== "separator" &&
//           block.type !== "empty-line" &&
//           block.type !== "image"
//         )
//           continue;

//         switch (block.type) {
//           case "separator":
//             await this.page.keyboard.type("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
//             await this.page.keyboard.press("Enter");
//             break;

//           case "empty-line":
//             // 재조립 로직이 마진을 처리하므로 빈 줄 입력은 최소화
//             break;

//           case "blockquote-heading":
//           case "heading":
//             if (!block.text) break;
//             const headingHtml = `<div style="${VERTICAL_BAR_HEADING_STYLE}">${block.text}</div>`;
//             await this.pasteHtml(headingHtml, false);
//             await this.page.keyboard.press("Enter");
//             break;

//           case "blockquote-paragraph":
//             if (!block.html) break;
//             const content = block.html
//               .replace(/<p>/g, "")
//               .replace(/<\/p>/g, "");
//             await this.pasteHtml(
//               `<blockquote style="${SIDE_BAR_QUOTE_STYLE}">${content}</blockquote>`,
//               false,
//             );
//             await this.page.keyboard.press("Enter");
//             break;

//           case "table":
//             if (!block.html) break;
//             const styledTable = this.styleTable(block.html);
//             await this.pasteHtml(styledTable);
//             await this.page.keyboard.press("Enter");
//             break;

//           case "list":
//             const listHtml = `<div style="font-weight: normal; line-height: 2.2; font-size: 15px;">${block.html}</div>`;
//             await this.pasteHtml(listHtml, true);
//             await this.page.keyboard.press("Enter");
//             break;

//           case "image":
//             if (this.persona === "hollywood-reporter") break;
//             if (imageCount >= MAX_IMAGES) break;
//             let rawKeyword = block.keyword || this.topic;
//             let cleanKeyword = rawKeyword
//               .replace(/[\[\]]/g, "")
//               .replace(/이미지\s*:/, "")
//               .replace(/[^\w\s가-힣]/g, " ")
//               .trim()
//               .split(/\s+/)
//               .slice(0, 2)
//               .join(" ");
//             if (!cleanKeyword || cleanKeyword.length < 2)
//               cleanKeyword = `${this.topic} ${cleanKeyword}`;
//             if (usedKeywords.has(cleanKeyword)) break;

//             try {
//               const imagePath = await this.pexelsService.downloadImage(
//                 cleanKeyword,
//                 this.tempDir,
//               );
//               if (imagePath) {
//                 await this.uploadImage(this.page, imagePath);
//                 await this.page.waitForTimeout(500);
//                 await this.page.keyboard.press("ArrowDown");
//                 await this.page.keyboard.press("Enter");
//                 imageCount++;
//                 usedKeywords.add(cleanKeyword);
//               }
//             } catch (e) {
//               console.error(e);
//             }
//             break;

//           // ✅ AI가 생성한 문단 구조를 최대한 보존
//           case "paragraph":
//           default:
//             if (!block.html) break;

//             const wrappedHtml = this.wrapParagraph(block.html);

//             if (wrappedHtml) {
//               await this.pasteHtml(wrappedHtml, true);
//               await this.page.keyboard.press("Enter");
//             }
//             break;
//         }
//         await this.page.waitForTimeout(80);
//       }
//     } catch (error) {
//       console.error("❌ 본문 입력 중 오류:", error);
//     }
//   }

//   private htmlToTextBlocks(html: string) {
//     const blocks: any[] = [];
//     const $ = cheerio.load(html);
//     const $root =
//       $(".post-content").length > 0 ? $(".post-content") : $("body");

//     $root.children().each((_, element) => {
//       const $el = $(element);
//       const tagName = element.tagName?.toLowerCase();
//       const rawHtml = $el.html() || "";
//       const textContent = $el.text().trim();
//       const imageRegex = /\[이미지\s*:\s*(.*?)\]/i;
//       const imageMatch = textContent.match(imageRegex);

//       if (imageMatch) {
//         blocks.push({ type: "image", keyword: imageMatch[1].trim() });
//         return;
//       }

//       if (tagName === "hr") {
//         blocks.push({ type: "separator", text: "" });
//       } else if (tagName === "blockquote") {
//         $el.children().each((_, child) => {
//           const $child = $(child);
//           const childTagName = child.tagName?.toLowerCase();
//           const cText = $child.text().trim();

//           if (childTagName?.match(/^h[1-6]$/)) {
//             blocks.push({ type: "heading", text: cText, html: $child.html() });
//           } else {
//             blocks.push({
//               type: "blockquote-paragraph",
//               text: cText,
//               html: $.html($child),
//             });
//           }
//         });
//       } else if (tagName?.match(/^h[1-6]$/)) {
//         blocks.push({ type: "heading", text: textContent, html: rawHtml });
//       } else if (tagName === "ul" || tagName === "ol") {
//         blocks.push({ type: "list", text: textContent, html: $.html($el) });
//       } else if (tagName === "table") {
//         blocks.push({ type: "table", text: $el.text(), html: $.html($el) });
//       } else {
//         blocks.push({ type: "paragraph", text: textContent, html: rawHtml });
//       }
//     });
//     return blocks;
//   }

//   private async uploadImage(page: Page, imagePath: string | null) {
//     if (!imagePath || !fs.existsSync(imagePath)) return;
//     try {
//       await page.keyboard.press("Escape");
//       await this.clearPopups();
//       await page.waitForTimeout(200);
//       const beforeCount = await page.evaluate(
//         () => document.querySelectorAll("img").length,
//       );
//       const fileChooserPromise = page
//         .waitForEvent("filechooser", { timeout: 10000 })
//         .catch(() => null);
//       const selectors = [
//         'button[data-log="image"]',
//         ".se-image-toolbar-button",
//         'button[aria-label="사진"]',
//       ];
//       let clicked = false;
//       for (const selector of selectors) {
//         const btn = page.locator(selector).first();
//         if (await btn.isVisible()) {
//           await btn.click({ force: true });
//           clicked = true;
//           break;
//         }
//       }
//       if (!clicked)
//         await page
//           .locator('button[data-log="image"]')
//           .first()
//           .click({ force: true });
//       const fileChooser = await fileChooserPromise;
//       if (fileChooser) {
//         await fileChooser.setFiles(imagePath);
//         await page.waitForFunction(
//           (prevCount) => document.querySelectorAll("img").length > prevCount,
//           beforeCount,
//           { timeout: 10000 },
//         );
//         console.log("✅ 이미지 업로드 성공");
//       }
//     } catch (e) {
//       console.error("업로드 실패", e);
//     }
//   }
// }
