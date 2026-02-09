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
    persona: string = "informative"
  ) {
    this.tempDir = path.join(projectRoot, "temp_images");
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    this.topic = topic;
    this.tags = tags;
    this.persona = persona;
  }

  /**
   * 텍스트와 HTML에서 가비지 문구를 제거하는 유틸리티
   * (이미지 태그는 이제 처리하므로 삭제하지 않음)
   */
  private cleanContent(content: string): string {
    const garbageRegex =
      /(\(Image suggestion.*?\)|image suggestion:.*?\n?)/gi;
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
    await this.page.waitForTimeout(100); // 안정적인 붙여넣기 대기
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
      let imageCount = 0;
      const MAX_IMAGES = 3;
      const usedKeywords = new Set<string>(); // 중복 키워드 방지

      for (const block of textBlocks) {
        // 타이핑 전 가비지 제거
        if (block.html) block.html = this.cleanContent(block.html);
        if (block.text) block.text = this.cleanContent(block.text);

        if (
          !block.html &&
          !block.text && // text도 체크
          block.type !== "separator" &&
          block.type !== "empty-line" &&
          block.type !== "image" // image 타입 예외 허용
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
            // markdownToHtml에서 이미 스타일링된 block.html 사용
            await this.pasteHtml(`<blockquote>${block.html}</blockquote>`);
            await this.page.keyboard.press("ArrowDown");
            await this.page.keyboard.press("Enter");
            break;

          case "blockquote-paragraph":
            // markdownToHtml에서 이미 스타일링된 block.html 사용
            await this.pasteHtml(`<blockquote>${block.html}</blockquote>`);
            await this.page.keyboard.press("ArrowDown");
            await this.page.keyboard.press("Enter");
            break;

          case "heading":
            // 이미 <h1>~<h3> 태그와 스타일이 포함된 html 사용
            const headingHtml = block.html.startsWith("<h") ? block.html : `<h3>${block.html}</h3>`;
            await this.pasteHtml(headingHtml);
            await this.page.keyboard.press("Enter");
            break;

          case "table":
            await this.pasteHtml(block.html);
            await this.page.keyboard.press("ArrowDown");
            await this.page.keyboard.press("Enter");
            break;

          case "list":
            // 리스트도 이미 스타일링된 상태
            await this.pasteHtml(block.html);
            await this.page.keyboard.press("Enter");
            break;

          case "image":
            // ... (기존 이미지 로직 유지)
            // ... (이미지 로직 생략)
            // ✅ 헐리우드 특파원 페르소나는 이미지 검색 생략 (스톡 이미지 부적절)
            if (this.persona === "hollywood-reporter") {
              console.log("ℹ️ [NaverEditor] 'hollywood-reporter' 페르소나는 Pexels 이미지 검색을 생략합니다.");
              break;
            }

            // ✅ 이미지 개수 제한 및 키워드 처리
            if (imageCount >= MAX_IMAGES) {
              console.log(
                `⚠️ 이미지 제한(${MAX_IMAGES}개) 도달로 건너뜀: ${block.keyword}`,
              );
              break;
            }

            // 키워드 정제: 2어절까지만 사용, 특수문자 제거
            let rawKeyword = block.keyword || this.topic;
            // 대괄호, 특수문자 제거 및 앞쪽 2단어 추출
            let cleanKeyword = rawKeyword
              .replace(/[\[\]]/g, "")
              .replace(/이미지\s*:/, "")
              .replace(/[^\w\s가-힣]/g, " ") // 특수문자는 공백으로 치환
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .join(" ");

            if (!cleanKeyword || cleanKeyword.length < 2) {
                // 키워드가 너무 짧거나 없으면 토픽과 결합
                cleanKeyword = `${this.topic} ${cleanKeyword}`;
            }

            if (usedKeywords.has(cleanKeyword)) {
              console.log(`⚠️ 중복된 이미지 키워드 건너뜀: ${cleanKeyword}`);
              break;
            }

            console.log(`🖼️ 이미지 검색 시도 (${imageCount + 1}/${MAX_IMAGES}): "${cleanKeyword}"`);
            
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
              } else {
                console.warn(`⚠️ 적절한 이미지를 찾지 못해 건너뜀: ${cleanKeyword}`);
              }
            } catch (e) {
              console.error("❌ 이미지 처리 중 오류:", e);
            }
            break;

          case "paragraph":
          default:
            // markdownToHtml에서 이미 스타일링된 block.html 사용
            await this.pasteHtml(block.html);
            await this.page.keyboard.press("Enter");
            break;
        }
        await this.page.waitForTimeout(10);
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
        const textContent = $el.text().trim();

        // ✅ 이미지 태그 감지 로직 (블록 전체가 이미지 태그인 경우)
        // 예: [이미지: 키워드] 또는 > [이미지: 키워드]
        const imageRegex = /\[이미지\s*:\s*(.*?)\]/i;
        const imageMatch = textContent.match(imageRegex);

        if (imageMatch) {
            blocks.push({
                type: "image",
                keyword: imageMatch[1].trim()
            });
            return; // 이미지 블록으로 처리하고 다음 루프로
        }

        if (tagName === "hr") {
          blocks.push({ type: "separator", text: "" });
        } else if (tagName === "blockquote") {
          // 인용구 내부에서도 이미지 태그가 있을 수 있음
          $el.children().each((_, child) => {
            const $child = $(child);
            const childTagName = child.tagName?.toLowerCase();
            const cText = $child.text().trim();
            const cMatch = cText.match(imageRegex);
            
            if (cMatch) {
                 blocks.push({
                    type: "image",
                    keyword: cMatch[1].trim()
                });
            } else {
                if (childTagName?.match(/^h[1-6]$/)) {
                  blocks.push({
                    type: "blockquote-heading",
                    text: cText,
                    html: $child.html(),
                  });
                } else {
                  // ✅ 핵심: $.html($child)를 사용하여 태그 자체를 포함한 HTML을 보존 (링크 유실 방지)
                  blocks.push({
                    type: "blockquote-paragraph",
                    text: cText,
                    html: $.html($child), 
                  });
                }
            }
          });
        } else if (tagName?.match(/^h[1-6]$/)) {
          let prefix = tagName === "h1" ? "■ " : tagName === "h2" ? "▶ " : "• ";
          blocks.push({
            type: "heading",
            text: textContent,
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
            text: textContent,
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
      await page.waitForTimeout(200); // 팝업이 사라지는 애니메이션 등을 고려한 짧은 대기

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
