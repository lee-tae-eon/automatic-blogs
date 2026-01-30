/// <reference lib="dom" />
import { Page } from "playwright";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { UnsplashService } from "../../services/unsplashService";
import { PexelsService } from "../../services/pexelImageService";

export class NaverEditor {
  private unsplashService = new UnsplashService();
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

  public async clearPopups() {
    console.log("🧹 팝업 청소 시작...");
    const CANCEL_SELECTOR = ".se-popup-button.se-popup-button-cancel";

    try {
      const cancelBtn = await this.page.waitForSelector(CANCEL_SELECTOR, {
        timeout: 3000,
      });
      if (cancelBtn) {
        await cancelBtn.click();
        console.log("✅ 임시저장 불러오기 취소 완료");
      }
    } catch (e) {
      console.log("ℹ️ 활성화된 임시저장 팝업 없음");
    }

    await this.page.keyboard.press("Escape");
  }

  public async enterTitle(title: string, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n📝 제목 입력 시도 ${attempt}/${maxRetries}...`);

      try {
        const titleSelector = ".se-title-text";
        const elementCount = await this.page.locator(titleSelector).count();

        if (elementCount === 0) {
          throw new Error(`${titleSelector} 요소를 찾을 수 없음`);
        }

        console.log(`   ✅ 제목 요소 발견`);

        await this.page.locator(titleSelector).first().scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(500);
        await this.page.locator(titleSelector).first().click({ force: true });
        await this.page.waitForTimeout(1000);

        console.log("   키보드 입력 시도");

        const isMac = process.platform === "darwin";
        await this.page.keyboard.press(isMac ? "Meta+A" : "Control+A");
        await this.page.waitForTimeout(300);
        await this.page.keyboard.press("Backspace");
        await this.page.waitForTimeout(300);
        await this.page.keyboard.type(title, { delay: 30 });
        await this.page.waitForTimeout(1000);

        const actualText = (
          await this.page.locator(titleSelector).first().innerText()
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
          await this.page.keyboard.press("Escape");
          await this.page.waitForTimeout(500);
          return;
        } else if (
          normalizedActual.replace(/[^\w\s가-힣]/g, "") ===
          normalizedTitle.replace(/[^\w\s가-힣]/g, "")
        ) {
          console.log(`   ⚠️ 이모지 불일치 무시 (텍스트 일치)`);
          await this.page.keyboard.press("Escape");
          await this.page.waitForTimeout(500);
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
          await this.page.waitForTimeout(3000);
        }
      }
    }

    throw new Error(`제목 입력 ${maxRetries}회 모두 실패`);
  }

  public async enterContent(htmlContent: string) {
    console.log("\n📄 본문 입력 중...");

    try {
      await this.page.keyboard.press("Escape");
      await this.page.waitForTimeout(500);

      const bodySelectors = [
        '[data-a11y-title="본문"] .se-text-paragraph',
        '[data-a11y-title="본문"] .se-module-text',
        ".se-component.se-text .se-text-paragraph",
      ];

      let clicked = false;
      for (const selector of bodySelectors) {
        try {
          const element = await this.page.waitForSelector(selector, {
            state: "visible",
            timeout: 3000,
          });

          if (element) {
            await element.click({ force: true });
            await this.page.waitForTimeout(500);
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

      await this.page.keyboard.press("ArrowDown");
      await this.page.waitForTimeout(300);

      console.log("   HTML 파싱 중...");
      const textBlocks = this.htmlToTextBlocks(htmlContent);

      console.log(`   총 ${textBlocks.length}개 블록 입력 시작...\n`);

      for (let i = 0; i < textBlocks.length; i++) {
        const block = textBlocks[i];

        if (block.type === "separator") {
          console.log(`   [구분선]`);
          await this.page.keyboard.type(block.text, { delay: 10 });
          await this.page.keyboard.press("Enter");
          await this.page.keyboard.press("Enter");
          await this.page.waitForTimeout(50);
        } else if (block.type === "empty-line") {
          await this.page.keyboard.press("Enter");
        } else if (block.type === "blockquote-heading") {
          console.log(`   [인용구 제목] ${block.text.substring(0, 30)}...`);

          const cleanText = block.text
            .replace(/^>\s*/, "")
            .replace(/^#+\s*/, "")
            .trim();

          // ✅ HTML 형식으로 클립보드에 복사
          const htmlContent = `<blockquote><h2>${cleanText}</h2></blockquote>`;

          await this.page.evaluate((html) => {
            const type = "text/html";
            const blob = new Blob([html], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            return navigator.clipboard.write(data);
          }, htmlContent);

          // 붙여넣기
          const isMac = process.platform === "darwin";
          const modifier = isMac ? "Meta" : "Control";
          await this.page.keyboard.press(`${modifier}+V`);
          await this.page.waitForTimeout(800);

          // 아래로 이동 (다음 입력 준비)
          await this.page.keyboard.press("ArrowDown");
          await this.page.keyboard.press("Enter");
          await this.page.keyboard.press("Enter");
          await this.page.waitForTimeout(300);

          // 이미지 업로드
          const searchQuery = block.text
            .replace(/[0-9]년|[0-9]월|[0-9]일/g, "")
            .replace(/[^\w\s가-힣]/g, "")
            .split(" ")
            .filter((word) => word.length > 1)
            .slice(0, 2)
            .join(" ");

          console.log(`🔍 이미지 검색 키워드: ${searchQuery}`);

          const imagePath = await this.pexelsService.downloadImage(
            searchQuery,
            this.tempDir,
          );

          if (imagePath) {
            await this.uploadImage(this.page, imagePath);

            // ✅ 이미지 아래로 확실히 이동
            await this.page.waitForTimeout(1000);
            await this.page.keyboard.press("Escape");
            await this.page.waitForTimeout(300);
            await this.page.keyboard.press("ArrowDown");
            await this.page.keyboard.press("ArrowDown");
            await this.page.keyboard.press("Enter");
            await this.page.keyboard.press("Enter");
          } else {
            console.log("   ℹ️ 적절한 이미지가 없어 업로드를 생략합니다.");
          }

          await this.page.waitForTimeout(200);
        } else if (block.type === "blockquote-paragraph") {
          console.log(`   [인용구 문단] ${block.text.substring(0, 30)}...`);

          // ✅ HTML 형식으로 붙여넣기
          const htmlContent = `<blockquote><p>${block.text}</p></blockquote>`;

          await this.page.evaluate((html) => {
            const type = "text/html";
            const blob = new Blob([html], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            return navigator.clipboard.write(data);
          }, htmlContent);

          const isMac = process.platform === "darwin";
          const modifier = isMac ? "Meta" : "Control";
          await this.page.keyboard.press(`${modifier}+V`);
          await this.page.waitForTimeout(500);

          await this.page.keyboard.press("ArrowDown");
          await this.page.keyboard.press("Enter");
          await this.page.keyboard.press("Enter");
          await this.page.waitForTimeout(200);
        } else if (block.type === "heading") {
          console.log(
            `   [제목] ${block.prefix}${block.text.substring(0, 30)}...`,
          );

          // H1, H2, H3 등 태그 결정
          let tag = "h2";
          if (block.prefix === "■ ") tag = "h1";
          else if (block.prefix === "▶ ") tag = "h2";
          else tag = "h3";

          const htmlContent = `<${tag}>${block.text}</${tag}>`;

          await this.page.evaluate((html) => {
            const type = "text/html";
            const blob = new Blob([html], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            return navigator.clipboard.write(data);
          }, htmlContent);

          const isMac = process.platform === "darwin";
          const modifier = isMac ? "Meta" : "Control";
          await this.page.keyboard.press(`${modifier}+V`);
          await this.page.waitForTimeout(300);

          await this.page.keyboard.press("Enter");
          await this.page.waitForTimeout(50);
        } else if (block.type === "list") {
          console.log(`   [리스트] ${block.text.substring(0, 30)}...`);
          await this.page.keyboard.type(`${block.prefix || ""}${block.text}`, {
            delay: 15,
          });
          await this.page.keyboard.press("Enter");
          await this.page.waitForTimeout(50);
        } else if (block.type === "table") {
          console.log(`   [테이블] 클립보드 붙여넣기 시도...`);

          await this.page.evaluate((html) => {
            const type = "text/html";
            const blob = new Blob([html], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            return navigator.clipboard.write(data);
          }, block.text);

          const isMac = process.platform === "darwin";
          const modifier = isMac ? "Meta" : "Control";
          await this.page.keyboard.press(`${modifier}+V`);

          await this.page.waitForTimeout(1000);

          await this.page.keyboard.press("ArrowDown");
          await this.page.keyboard.press("Enter");
          await this.page.waitForTimeout(50);
        } else if (block.type === "paragraph") {
          await this.page.keyboard.type(block.text, { delay: 15 });
          await this.page.keyboard.press("Enter");
          await this.page.waitForTimeout(50);
        } else {
          await this.page.keyboard.type(block.text, { delay: 15 });
          await this.page.keyboard.press("Enter");
          await this.page.waitForTimeout(50);
        }
      }

      console.log("\n   ✅ 타이핑 완료");
      await this.page.waitForTimeout(2000);

      const verification = await this.page.evaluate(() => {
        const titleEl = document.querySelector(".se-title-text") as HTMLElement;
        const bodyModule = document.querySelector(
          '[data-a11y-title="본문"]',
        ) as HTMLElement;

        return {
          titleText: titleEl?.textContent?.trim() || "",
          titleLength: titleEl?.textContent?.trim().length || 0,
          bodyLength: bodyModule?.textContent?.trim().length || 0,
        };
      });

      console.log(`\n   === 최종 확인 ===`);
      console.log(
        `   제목: "${verification.titleText}" (${verification.titleLength}자)`,
      );
      console.log(`   본문 길이: ${verification.bodyLength}자`);

      if (verification.bodyLength < 100) {
        console.warn(
          `   ⚠️ 주의: 본문이 평소보다 짧게 입력되었습니다. (확인 필요)`,
        );
      } else {
        console.log("   ✅ 본문 입력 확인 완료");
      }

      console.log("✅ 본문 입력 및 검증 완료");

      await this.page.keyboard.press("Escape");
      await this.page.waitForTimeout(1000);
    } catch (error) {
      console.error("❌ 본문 입력 프로세스 중 오류 발생:", error);
      if (error instanceof Error && !error.message.includes("너무 짧음")) {
        throw error;
      }
    }
  }

  private htmlToTextBlocks(html: string) {
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

  /**
   * 네이버 에디터에 이미지를 업로드합니다.
   * @param page 호출부에서 전달하는 Playwright Page 객체
   * @param imagePath 로컬 이미지 경로
   */
  private async uploadImage(page: Page, imagePath: string | null) {
    // 1. 이미지 업로드 전, 본문에 섞여 들어간 가이드 텍스트부터 먼저 청소함
    // (이미지 파일이 없더라도 가이드 텍스트는 지워야 하므로 가장 먼저 실행함)
    await page.evaluate(() => {
      const editor = document.querySelector('[data-a11y-title="본문"]');
      if (!editor) return;

      const walker = document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT,
        null,
      );
      const nodesToRemove: Node[] = [];
      let node;

      while ((node = walker.nextNode())) {
        const text = node.textContent || "";
        // ✅ 구문 오류 수정 및 검색 키워드 확장: (Image suggestion:, [이미지], [사진] 등
        if (
          /\[이미지|\(Image suggestion|이미지 삽입|삽입 위치|\[사진/i.test(text)
        ) {
          nodesToRemove.push(node);
        }
      }
      // 텍스트 노드가 포함된 부모 요소(보통 p태그)를 통째로 지워야 빈 줄이 안 남음
      nodesToRemove.forEach(
        (n) => n.parentElement?.remove() || n.parentNode?.removeChild(n),
      );
    });

    // 2. 이제 이미지가 실제로 존재하는지 확인하고 없으면 여기서 종료함
    if (!imagePath || !fs.existsSync(imagePath)) {
      console.log("   ℹ️ 이미지 파일이 없어 텍스트만 청소하고 스킵함.");
      return;
    }

    console.log(`   📸 이미지 업로드 시도: ${path.basename(imagePath)}`);

    try {
      // 안정적인 클릭을 위해 포커스 초기화
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      // 3. 업로드 전 이미지 개수 확인
      const beforeImageCount = await page.evaluate(() => {
        const editor = document.querySelector('[data-a11y-title="본문"]');
        return editor?.querySelectorAll("img").length || 0;
      });

      const fileChooserPromise = page.waitForEvent("filechooser");

      // 4. 사진 버튼 클릭
      const photoButton = page.locator(
        'button.se-image-toolbar-button, button[data-log="image"]',
      );
      await photoButton.first().click();
      await page.waitForTimeout(500);

      // 5. 파일 선택 및 주입
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(imagePath);

      console.log("   ⏳ 이미지 업로드 및 렌더링 대기 중...");

      // 6. ✅ 새 이미지가 추가될 때까지 대기 (최대 5초)
      try {
        await page.waitForFunction(
          (prevCount) => {
            const editor = document.querySelector('[data-a11y-title="본문"]');
            const currentCount = editor?.querySelectorAll("img").length || 0;
            return currentCount > (prevCount as number);
          },
          beforeImageCount, // 2번째 인자: 전달할 값
          { timeout: 5000 }, // 3번째 인자: 옵션
        );
        console.log("   ✅ 이미지 렌더링 확인");
      } catch (e) {
        console.warn("   ⚠️ 5초 이내에 이미지 렌더링 확인 불가 (계속 진행)");
      }

      // 7. 추가 안정화 및 포커스 정리 (기존에 썼던 안정화 로직 유지)
      await page.waitForTimeout(1000);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      // 이미지 아래로 커서 이동
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");

      console.log("   ✅ 이미지 삽입 및 포커스 이동 완료");
    } catch (error) {
      console.error("   ❌ 이미지 업로드 중 오류 발생:", error);
    }
  }
  // private async uploadImage(page: Page, imagePath: string) {
  //   if (!imagePath || !fs.existsSync(imagePath)) {
  //     console.log("   ℹ️ 업로드할 이미지 파일이 없어 스킵합니다.");
  //     return;
  //   }

  //   console.log(`   📸 이미지 업로드 시도: ${path.basename(imagePath)}`);

  //   try {
  //     await page.keyboard.press("Escape");
  //     await page.waitForTimeout(500);

  //     // 현재 이미지 개수 확인
  //     const beforeImageCount = await page.evaluate(() => {
  //       const editor = document.querySelector('[data-a11y-title="본문"]');
  //       return editor?.querySelectorAll("img").length || 0;
  //     });

  //     const fileChooserPromise = page.waitForEvent("filechooser");

  //     const photoButton = page.locator(
  //       'button.se-image-toolbar-button, button[data-log="image"]',
  //     );
  //     await photoButton.first().click();
  //     await page.waitForTimeout(500);

  //     const fileChooser = await fileChooserPromise;
  //     await fileChooser.setFiles(imagePath);

  //     console.log("   ⏳ 이미지 업로드 대기 중...");

  //     // ✅ 새 이미지가 추가될 때까지 대기 (최대 10초)
  //     try {
  //       await page.waitForFunction(
  //         (prevCount) => {
  //           const editor = document.querySelector('[data-a11y-title="본문"]');
  //           const currentCount = editor?.querySelectorAll("img").length || 0;
  //           return currentCount > (prevCount as number); // 타입 단언 추가 시 더 안전
  //         },
  //         beforeImageCount, // 2번째 인자: 전달할 값
  //         { timeout: 5000 }, // 3번째 인자: 옵션 (시간 설정 등)
  //       );

  //       console.log("   ✅ 이미지 렌더링 확인");
  //     } catch (e) {
  //       console.warn(
  //         "   ⚠️ 5초 이내에 이미지가 확인되지 않아 다음으로 진행합니다.",
  //       );
  //     }

  //     // 추가 안정화 대기
  //     await page.waitForTimeout(1000);

  //     // Placeholder 텍스트 제거
  //     await page.evaluate(() => {
  //       const editor = document.querySelector('[data-a11y-title="본문"]');
  //       if (!editor) return;

  //       const walker = document.createTreeWalker(
  //         editor,
  //         NodeFilter.SHOW_TEXT,
  //         null,
  //       );

  //       const nodesToRemove: Node[] = [];
  //       let node;
  //       while ((node = walker.nextNode())) {
  //         const text = node.textContent || "";
  //         if (
  //           text.includes("[이미지") ||
  //           text.includes("삽입 위치") ||
  //           text.includes("이미지 삽입")
  //         ) {
  //           nodesToRemove.push(node);
  //         }
  //       }

  //       nodesToRemove.forEach((n) => n.parentNode?.removeChild(n));
  //     });

  //     console.log("   ✅ 이미지 삽입 완료");

  //     // 포커스 해제 및 이동
  //     await page.keyboard.press("Escape");
  //     await page.waitForTimeout(500);
  //     await page.keyboard.press("Escape");
  //     await page.waitForTimeout(500);

  //     await page.keyboard.press("ArrowDown");
  //     await page.waitForTimeout(200);
  //     await page.keyboard.press("ArrowDown");
  //     await page.waitForTimeout(200);
  //     await page.keyboard.press("Enter");
  //     await page.keyboard.press("Enter");
  //   } catch (error) {
  //     console.error("   ❌ 이미지 업로드 중 오류 발생:", error);
  //   }
  // }
}
