/// <reference lib="dom" />
import { Page } from "playwright";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { PexelsService } from "../../services/pexelImageService";
import { ChartService } from "../../services/chartService";

// ✅ 페르소나별 테마 컬러 및 스타일 정의
const PERSONA_THEMES: Record<string, { color: string; bgColor: string }> = {
  informative: { color: "#2c3e50", bgColor: "#f8f9fa" }, // 딥 블루 (신뢰)
  experiential: { color: "#e67e22", bgColor: "#fffaf0" }, // 오렌지 (친근)
  reporter: { color: "#c0392b", bgColor: "#fff5f5" }, // 레드 (긴급)
  entertainment: { color: "#9b59b6", bgColor: "#fcfaff" }, // 바이올렛 (발랄)
  travel: { color: "#27ae60", bgColor: "#f0fff4" }, // 그린 (자연/안내)
};

const getHeadingStyle = (persona: string) => {
  const theme = PERSONA_THEMES[persona] || PERSONA_THEMES.informative;
  return `
    display: block;
    border-left: 6px solid ${theme.color};
    padding: 12px 15px;
    margin-top: 45px;
    margin-bottom: 20px;
    font-size: 20px;
    font-weight: bold;
    color: ${theme.color};
    line-height: 1.4;
    background-color: ${theme.bgColor};
    border-radius: 0 8px 8px 0;
  `;
};

const getQuoteStyle = (persona: string) => {
  const theme = PERSONA_THEMES[persona] || PERSONA_THEMES.informative;
  return `
    display: block;
    border-left: 4px solid ${theme.color};
    padding: 15px 20px;
    margin: 25px 0;
    color: #444;
    line-height: 1.7;
    background-color: white;
    font-style: italic;
  `;
};

// ✅ [v5.1] 포스트잇/체크포인트 스타일 정의 (사용자 요청 스타일)
const getCheckpointStyle = () => {
  return `
    display: block;
    border: 10px solid #f2f2f2;
    padding: 40px 30px;
    margin: 40px auto;
    color: #333;
    line-height: 1.8;
    background-color: white;
    text-align: center;
    font-size: 16px;
    word-break: keep-all;
    border-radius: 4px;
  `;
};

export class NaverEditor {
  private pexelsService = new PexelsService();
  private chartService = new ChartService();
  private tempDir: string;
  private topic: string;
  private tags: string[];
  private persona: string;
  private heroImagePath?: string; // 🍌 [v8.8] 사용자 지정 대표 이미지

  constructor(
    private page: Page,
    projectRoot: string,
    topic: string,
    tags: string[] = [],
    persona: string = "informative",
    heroImagePath?: string,
  ) {
    this.tempDir = path.join(projectRoot, "temp_images");
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    this.topic = topic;
    this.tags = tags;
    this.persona = persona;
    this.heroImagePath = heroImagePath;
  }

  private cleanContent(content: string): string {
    const garbageRegex = /(\(Image suggestion.*?\)|image suggestion:.*?\n?)/gi;
    return content.replace(garbageRegex, "").trim();
  }

  // ✅ [v5.1.4] 최종 스타일 변환 (마크다운 볼드, 빨강, 파랑 강조)
  // 기호가 본문에 그대로 노출되는 문제를 방지하기 위한 최종 렌더링 로직
  private applyColoringGrammar(html: string): string {
    return (
      html
        // 1. 마크다운 볼드 변환 (**텍스트**)
        .replace(
          /\*\*([\s\S]+?)\*\*/g,
          '<strong style="font-weight: bold;">$1</strong>',
        )
        // 2. 파스텔 빨강 (!!주의!!) - 복구
        .replace(
          /!!([^!+]+)!!/g,
          '<span style="color: #ef9a9a; font-weight: bold; display: inline;">$1</span>',
        )
        // 3. 파스텔 파랑 (++핵심++)
        .replace(
          /\+\+([^!+]+)\+\+/g,
          '<span style="color: #5d9cec; font-weight: bold; display: inline;">$1</span>',
        )
    );
  }

  // ✅ HTML 붙여넣기 함수 (스타일 보존을 위해 div로 감싸기 옵션 추가)
  private async pasteHtml(htmlContent: string) {
    // 강조 문법 적용
    const coloredHtml = this.applyColoringGrammar(htmlContent);
    const wrapper = `<div style="text-align: left;">${coloredHtml}</div>`;

    await this.page.evaluate((html) => {
      const type = "text/html";
      const blob = new Blob([html], { type });
      const data = [new ClipboardItem({ [type]: blob })];
      return navigator.clipboard.write(data);
    }, wrapper);

    const isMac = process.platform === "darwin";
    const modifier = isMac ? "Meta" : "Control";
    await this.page.keyboard.press(`${modifier}+V`);
    await this.page.waitForTimeout(400); // 렌더링 안정화 대기
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
      let pexelsCount = 0;
      const MAX_PEXELS = 3; // 🍌 [v8.8] Pexels 이미지 3개 보장
      const usedKeywords = new Set<string>();

      for (const block of textBlocks) {
        if (block.html) block.html = this.cleanContent(block.html);
        if (block.text) block.text = this.cleanContent(block.text);

        if (
          !block.html &&
          !block.text &&
          block.type !== "separator" &&
          block.type !== "image" &&
          block.type !== "direct_image" &&
          block.type !== "chart" &&
          block.type !== "og_link" &&
          block.type !== "youtube_video" &&
          block.type !== "checkpoint" &&
          block.type !== "coupang_image"
        )
          continue;

        switch (block.type) {
          case "separator":
            await this.page.keyboard.type("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            await this.page.keyboard.press("Enter");
            await this.page.keyboard.press("Enter");
            break;

          // ✅ [핵심 수정] 소제목을 '세로바 스타일'로 강제 변환
          case "heading":
            if (!block.text) break;
            await this.page.keyboard.press("Enter");
            // 페르소나별 스타일 적용
            const styledHeading = `<p style="${getHeadingStyle(this.persona)}">${block.text}</p>`;
            await this.pasteHtml(styledHeading);
            await this.page.keyboard.press("Enter");
            break;

          // ✅ [핵심 수정] 인용구 스타일 강제 적용
          case "blockquote-paragraph":
          case "blockquote-heading":
            if (!block.html) break;
            // 순수 텍스트만 추출해서 스타일 입히기
            const quoteContent = block.html
              .replace(/<\/?blockquote>/g, "")
              .replace(/<\/?p>/g, "");
            const styledQuote = `<blockquote style="${getQuoteStyle(this.persona)}">${quoteContent}</blockquote>`;
            await this.pasteHtml(styledQuote);
            await this.page.keyboard.press("Enter");
            break;

          // ✅ [v5.1] 체크포인트 블록 처리 추가
          case "checkpoint":
            if (!block.html) break;
            // 내부 HTML 유지 (줄바꿈 등 보존)
            const checkpointHtml = `<div style="${getCheckpointStyle()}">${block.html}</div>`;
            await this.pasteHtml(checkpointHtml);
            await this.page.keyboard.press("Enter");
            await this.page.keyboard.press("Enter");
            break;

          // ✅ [v5.3] 표(Table) 스타일 강제 적용 (네이버 블로그에 맞게 시각화)
          case "table":
            if (!block.html) break;

            // cheerio를 사용해 <table> 내부에 직접 인라인 스타일 추가
            const $table = cheerio.load(block.html, null, false);

            $table("table").css({
              width: "100%",
              "border-collapse": "collapse",
              "margin-bottom": "20px",
              "font-size": "14px",
              "text-align": "center",
            });

            $table("th").css({
              "background-color": "#f8f9fa",
              border: "1px solid #dee2e6",
              padding: "10px",
              "font-weight": "bold",
              color: "#333",
            });

            $table("td").css({
              border: "1px solid #dee2e6",
              padding: "10px",
              color: "#444",
            });

            await this.pasteHtml($table.html());
            await this.page.keyboard.press("Enter");
            await this.page.keyboard.press("Enter");
            break;

          case "list":
            // 리스트는 글자 크기 등을 본문과 맞춤
            const styledList = `<div style="font-size: 15px; line-height: 1.8; color: #333; font-weight: 400; font-style: normal;">${block.html}</div>`;
            await this.pasteHtml(styledList);
            await this.page.keyboard.press("Enter");
            break;

          case "thumbnail_only":
            if (block.path && fs.existsSync(block.path)) {
              console.log("🎨 [ThumbnailOnly] 대표 이미지 전용 업로드 시작...");
              await this.page.keyboard.press("Enter");
              await this.uploadImage(this.page, block.path);
              await this.page.waitForTimeout(2000); // 업로드 및 렌더링 대기
              
              // [v11.1] 대표 이미지로 지정 시도 (첫 번째 이미지면 자동으로 대표가 되기도 하지만 명시적 처리)
              try {
                // 이미지 블록 선택 및 대표 버튼 클릭 (네이버 에디터 내부 구조 대응)
                await this.page.keyboard.press("ArrowUp");
                await this.page.waitForTimeout(300);
                // '대표' 버튼 클릭 (텍스트 기반)
                const heroButton = await this.page.$("button:has-text('대표')");
                if (heroButton) await heroButton.click();
                
                // 본문에서 삭제 (백스페이스)
                await this.page.keyboard.press("Backspace");
                console.log("✅ [ThumbnailOnly] 대표 설정 후 본문에서 제거 완료");
              } catch (e) {
                console.warn("⚠️ [ThumbnailOnly] 대표 버튼 클릭 실패 (수동 설정 권장):", e);
              }
              await this.page.keyboard.press("ArrowDown");
            }
            break;

          case "direct_image":
            if (block.path && fs.existsSync(block.path)) {
              await this.page.keyboard.press("Enter");
              await this.uploadImage(this.page, block.path);
              await this.page.waitForTimeout(500);
              await this.page.keyboard.press("ArrowDown");
              await this.page.keyboard.press("Enter");
              imageCount++; // 프리미엄 이미지도 카운트에 포함
            }
            break;

          case "image":
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
              let imagePath: string | null = null;

              // 🍌 [v8.8] 이미지 전략 전면 개편
              // 1순위: 사용자가 직접 지정한 heroImagePath (첫 번째 이미지 블록에서만 사용)
              if (imageCount === 0 && this.heroImagePath && fs.existsSync(this.heroImagePath)) {
                console.log("🍌 [Hero Image] 사용자 지정 이미지 사용:", this.heroImagePath);
                imagePath = this.heroImagePath;
              } 
              
              // 2순위: Pexels (사용자 지정 이미지가 없거나, 두 번째 이후 이미지인 경우)
              // Pexels 이미지는 최대 MAX_PEXELS개까지 허용
              if (!imagePath && pexelsCount < MAX_PEXELS) {
                console.log(`📸 [Pexels] 새 이미지 다운로드 시도 (${cleanKeyword})...`);
                imagePath = await this.pexelsService.downloadImage(
                  cleanKeyword,
                  this.tempDir,
                );
                if (imagePath) pexelsCount++;
              }

              if (imagePath) {
                await this.page.keyboard.press("Enter");
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

          // [v5.6] 쿠팡 특정 URL 이미지 다운로드 및 업로드
          case "coupang_image":
            if (!block.url) break;
            try {
              const imagePath = await this.downloadCoupangImage(block.url);
              if (imagePath) {
                await this.page.keyboard.press("Enter");
                await this.uploadImage(this.page, imagePath);
                await this.page.waitForTimeout(500);
                await this.page.keyboard.press("ArrowDown");
                await this.page.keyboard.press("Enter");
              }
            } catch (e) {
              console.error("❌ 쿠팡 이미지 처리 에러:", e);
            }
            break;

          case "chart":
            if (!block.data) break;
            try {
              const chartData = JSON.parse(block.data);
              const chartPath = await this.chartService.generateChartImage(
                chartData,
                this.tempDir,
              );
              if (chartPath) {
                await this.page.keyboard.press("Enter");
                await this.uploadImage(this.page, chartPath);
                await this.page.waitForTimeout(500);
                await this.page.keyboard.press("ArrowDown");
                await this.page.keyboard.press("Enter");
              }
            } catch (e) {
              console.error("❌ 차트 파싱/생성 에러:", e);
            }
            break;

          // 🔗 [v5.5] 연관 정보 링크 (OG Link Card) 블록 처리
          case "og_link":
          case "youtube_video":
            if (!block.url) break;
            try {
              await this.page.keyboard.press("Enter");
              // 클립보드 복붙이 아닌 직접 타이핑이어야 네이버 에디터가 링크/영상 카드로 인식함
              await this.page.keyboard.type(block.url, { delay: 10 });
              await this.page.keyboard.press("Enter"); // 변환 트리거
              await this.page.waitForTimeout(3500); // 영상/링크 카드가 생성될 시간을 충분히 부여
              await this.page.keyboard.press("Enter"); // 분리 여백
            } catch (e) {
              console.error("❌ 멀티미디어 카드 생성 에러:", e);
            }
            break;

          case "paragraph":
          default:
            if (!block.html) break;

            // 문단은 p 태그로 감싸고 스타일 지정 (상속 방지를 위해 color, font-weight 등 명시)
            // margin-bottom 등을 인라인으로 줘서 청킹 효과 유지
            await this.pasteHtml(
              `<p style="font-size: 15px; line-height: 1.8; color: #333; font-weight: 400; font-style: normal;">${block.html}</p>`,
            );
            await this.page.keyboard.press("Enter");
            await this.page.keyboard.press("Enter");
            break;
        }
        await this.page.waitForTimeout(80);
      }
    } catch (error) {
      console.error("❌ 본문 입력 중 오류:", error);
    }
  }

  private htmlToTextBlocks(html: string) {
    const blocks: any[] = [];
    const $ = cheerio.load(html);

    // .post-content가 있으면 그 내부를, 없으면 body 전체를 대상으로 함
    const $target =
      $(".post-content").length > 0 ? $(".post-content") : $("body");

    $target.contents().each((_, element) => {
      const $el = $(element);
      const nodeType = element.type;
      const tagName =
        "tagName" in element
          ? (element as any).tagName.toLowerCase()
          : undefined;
      const textContent = $el.text().trim();
      const rawHtml = $el.html() || "";

      // 1. 이미지 태그 처리
      const thumbnailOnlyRegex = /\[썸네일전용\s*:\s*(.*?)\]/i;
      const thumbnailMatch = textContent.match(thumbnailOnlyRegex);
      if (thumbnailMatch) {
        blocks.push({ type: "thumbnail_only", path: thumbnailMatch[1].trim() });
        return;
      }

      const premiumImageRegex = /\[프리미엄이미지\s*:\s*(.*?)\]/i;
      const premiumMatch = textContent.match(premiumImageRegex);
      if (premiumMatch) {
        blocks.push({ type: "direct_image", path: premiumMatch[1].trim() });
        return;
      }

      const imageRegex = /\[이미지\s*:\s*(.*?)\]/i;
      const imageMatch = textContent.match(imageRegex);
      if (imageMatch) {
        blocks.push({ type: "image", keyword: imageMatch[1].trim() });
        return;
      }

      // 1-B. [v5.6] 쿠팡 이미지 태그 처리
      const coupangImageRegex = /\[쿠팡이미지\s*:\s*(https?:\/\/[^\s\]]+)\s*\]/i;
      const coupangImageMatch = textContent.match(coupangImageRegex);
      if (coupangImageMatch) {
        blocks.push({ type: "coupang_image", url: coupangImageMatch[1].trim() });
        return;
      }

      // 텍스트 노드 처리
      if (nodeType === "text") {
        if (textContent) {
          blocks.push({
            type: "paragraph",
            text: textContent,
            html: textContent,
          });
        }
        return;
      }

      if (tagName === "hr") {
        blocks.push({ type: "separator", text: "" });
      } else if (tagName === "div" && $el.hasClass("checkpoint")) {
        blocks.push({ type: "checkpoint", html: rawHtml });
      } else if (tagName === "blockquote") {
        blocks.push({ type: "blockquote-paragraph", html: rawHtml });
      } else if (tagName?.match(/^h[1-6]$/)) {
        blocks.push({ type: "heading", text: textContent, html: rawHtml });
      } else if (tagName === "ul" || tagName === "ol") {
        blocks.push({ type: "list", text: textContent, html: $.html($el) });
      } else if (tagName === "table") {
        blocks.push({ type: "table", text: $el.text(), html: $.html($el) });
      } else {
        // 📊 [v5.1] 차트 포함 문단 처리 (태그 내 찌꺼기 텍스트가 있어도 인식 가능하도록 개선)
        const chartPrefixRegex = /\[\s*차트\s*:/gi;
        // ✅ [추가] 태그 없이 생 JSON만 들어온 경우 감지 (예: { "type": "bar", ... })
        const nakedChartRegex =
          /^\{\s*"type":\s*"(bar|horizontalBar|pie|doughnut|line)"[\s\S]*?"data":\s*\[[\s\S]*?\}\s*$/i;

        let lastIndex = 0;
        let match;
        const text = textContent;

        // 1. 표준 [차트: ] 태그 검색 및 분리
        let foundChart = false;
        while ((match = chartPrefixRegex.exec(text)) !== null) {
          const startIndex = match.index;
          const jsonStartIndex = text.indexOf("{", startIndex);
          if (jsonStartIndex === -1) continue;

          const beforeText = text.substring(lastIndex, startIndex).trim();
          if (beforeText) {
            blocks.push({
              type: "paragraph",
              text: beforeText,
              html: beforeText,
            });
          }

          let depth = 0;
          let inString = false;
          let escape = false;
          let jsonEndIndex = -1;

          for (let i = jsonStartIndex; i < text.length; i++) {
            const char = text[i];
            if (escape) {
              escape = false;
              continue;
            }
            if (char === "\\") {
              escape = true;
              continue;
            }
            if (char === '"') {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === "{") depth++;
              else if (char === "}") {
                depth--;
                if (depth === 0) {
                  jsonEndIndex = i;
                  break;
                }
              }
            }
          }

          if (jsonEndIndex !== -1) {
            foundChart = true;
            const jsonStr = text.substring(jsonStartIndex, jsonEndIndex + 1);
            blocks.push({ type: "chart", data: jsonStr });

            let closeBracketIndex = text.indexOf("]", jsonEndIndex);
            if (closeBracketIndex !== -1) {
              lastIndex = closeBracketIndex + 1;
              chartPrefixRegex.lastIndex = lastIndex;
            } else {
              lastIndex = jsonEndIndex + 1;
              chartPrefixRegex.lastIndex = lastIndex;
            }
          } else {
            lastIndex = startIndex + 1;
            chartPrefixRegex.lastIndex = lastIndex;
          }
        }

        if (foundChart) {
          const afterText = text.substring(lastIndex).trim();
          if (afterText) {
            blocks.push({
              type: "paragraph",
              text: afterText,
              html: afterText,
            });
          }
        } else if (nakedChartRegex.test(text)) {
          // 2. ✅ 태그는 없지만 내용이 차트 JSON인 경우 처리
          blocks.push({ type: "chart", data: text.trim() });
        } else {
          // 3. 🔗 연관 정보 링크 [링크: URL] 처리 (OG 태그 블록 파싱)
          const linkPrefixRegex =
            /\[\s*링크\s*:\s*(https?:\/\/[^\s\]]+)\s*\]/gi;
          let linkLastIndex = 0;
          let linkMatch;
          let foundLink = false;

          while ((linkMatch = linkPrefixRegex.exec(text)) !== null) {
            foundLink = true;
            const linkStartIndex = linkMatch.index;
            const beforeText = text
              .substring(linkLastIndex, linkStartIndex)
              .trim();
            if (beforeText) {
              blocks.push({
                type: "paragraph",
                text: beforeText,
                html: beforeText,
              });
            }

            blocks.push({ type: "og_link", url: linkMatch[1].trim() });
            linkLastIndex = linkStartIndex + linkMatch[0].length;
          }

          if (foundLink) {
            const afterText = text.substring(linkLastIndex).trim();
            if (afterText) {
              blocks.push({
                type: "paragraph",
                text: afterText,
                html: afterText,
              });
            }
          } else {
            // 3-B. 🎬 유튜브 영상 [영상: URL] 처리
            const videoPrefixRegex = /\[\s*(영상|동영상|유튜브)\s*:\s*(https?:\/\/[^\s\]]+)\s*\]/gi;
            let videoLastIndex = 0;
            let videoMatch;
            let foundVideo = false;

            while ((videoMatch = videoPrefixRegex.exec(text)) !== null) {
              foundVideo = true;
              const videoStartIndex = videoMatch.index;
              const beforeText = text.substring(videoLastIndex, videoStartIndex).trim();
              if (beforeText) {
                blocks.push({ type: "paragraph", text: beforeText, html: beforeText });
              }

              blocks.push({ type: "youtube_video", url: videoMatch[2].trim() });
              videoLastIndex = videoStartIndex + videoMatch[0].length;
            }

            if (foundVideo) {
              const afterText = text.substring(videoLastIndex).trim();
              if (afterText) {
                blocks.push({ type: "paragraph", text: afterText, html: afterText });
              }
            } else {
              // 4. 차트/링크/영상이 없는 일반 문단 처리
              if (textContent || $el.find("img, iframe, video").length > 0) {
                blocks.push({
                  type: "paragraph",
                  text: textContent,
                  html: rawHtml || textContent,
                });
              }
            }
          }
        }
      }
    });
    return blocks;
  }

  // ✅ [v5.6] 쿠팡 이미지 등 외부 URL 이미지 다운로드 로직
  private async downloadCoupangImage(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[NaverEditor] 외부 이미지 다운로드 실패: ${response.status}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      let ext = url.split('.').pop()?.split('?')[0] || 'jpg';
      if (ext.length > 4) ext = 'jpg'; // 예외 처리 방어
      const fileName = `coupang_${Date.now()}.${ext}`;
      const filePath = path.join(this.tempDir, fileName);
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch(e) { 
      console.error('[NaverEditor] 쿠팡 이미지 수집 예외 발생', e); 
      return null; 
    }
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

      const btn = page
        .locator('button[data-log="image"], .se-image-toolbar-button')
        .first();
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

// /// <reference lib="dom" />
// import { Page } from "playwright";
// import * as cheerio from "cheerio";
// import fs from "fs";
// import path from "path";
// import { PexelsService } from "../../services/pexelImageService";

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

//   private async pasteHtml(htmlContent: string) {
//     await this.page.evaluate((html) => {
//       const type = "text/html";
//       const blob = new Blob([html], { type });
//       const data = [new ClipboardItem({ [type]: blob })];
//       return navigator.clipboard.write(data);
//     }, htmlContent);

//     const isMac = process.platform === "darwin";
//     const modifier = isMac ? "Meta" : "Control";
//     await this.page.keyboard.press(`${modifier}+V`);
//     await this.page.waitForTimeout(300); // 붙여넣기 안정화 대기
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
//         // 1. 내용 정제
//         if (block.html) block.html = this.cleanContent(block.html);
//         if (block.text) block.text = this.cleanContent(block.text);

//         // 빈 블록 스킵 (단, 구분선 등은 제외)
//         if (
//           !block.html &&
//           !block.text &&
//           block.type !== "separator" &&
//           block.type !== "image"
//         )
//           continue;

//         // 2. 블록 타입별 처리
//         switch (block.type) {
//           case "separator":
//             await this.page.keyboard.type("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
//             await this.page.keyboard.press("Enter");
//             await this.page.keyboard.press("Enter"); // 여백 확보
//             break;

//           case "heading":
//             // 제목은 굵게, 위아래 엔터로 구분 (확실하게 분리)
//             if (!block.text) break;
//             await this.page.keyboard.press("Enter");
//             await this.page.keyboard.press("Enter"); // 위 여백 추가 확보
//             await this.pasteHtml(`<h3>${block.text}</h3>`);
//             await this.page.keyboard.press("Enter");
//             break;

//           case "blockquote-paragraph":
//           case "blockquote-heading":
//             if (!block.html) break;
//             // 인용구는 그대로 붙여넣기
//             await this.pasteHtml(`<blockquote>${block.html}</blockquote>`);
//             await this.page.keyboard.press("Enter");
//             break;

//           case "table":
//             if (!block.html) break;
//             // 표는 그대로 붙여넣기 (스타일 없이)
//             await this.pasteHtml(block.html);
//             await this.page.keyboard.press("Enter");
//             await this.page.keyboard.press("Enter"); // 표 아래 여백
//             break;

//           case "list":
//             // 리스트는 HTML 그대로
//             await this.pasteHtml(block.html);
//             await this.page.keyboard.press("Enter");
//             break;

//           case "image":
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
//                 await this.page.keyboard.press("Enter"); // 이미지 위 여백
//                 await this.uploadImage(this.page, imagePath);
//                 await this.page.waitForTimeout(500);
//                 await this.page.keyboard.press("ArrowDown"); // 이미지 선택 해제
//                 await this.page.keyboard.press("Enter"); // 이미지 아래 여백
//                 imageCount++;
//                 usedKeywords.add(cleanKeyword);
//               }
//             } catch (e) {
//               console.error(e);
//             }
//             break;

//           case "paragraph":
//           default:
//             if (!block.html) break;
//             // [v4.6] block.text 대신 block.html을 사용하여 <br/>(마이크로 브리딩) 및 굵게 표시 보존
//             await this.pasteHtml(`<p>${block.html}</p>`);
//             await this.page.keyboard.press("Enter");
//             await this.page.keyboard.press("Enter"); // 문단 간격 (Chunking)
//             break;
//         }
//         await this.page.waitForTimeout(50); // 타이핑 안정화
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
//         blocks.push({
//           type: "blockquote-paragraph",
//           html: $.html($el), // 인용구 전체 유지
//         });
//       } else if (tagName?.match(/^h[1-6]$/)) {
//         blocks.push({ type: "heading", text: textContent, html: rawHtml });
//       } else if (tagName === "ul" || tagName === "ol") {
//         blocks.push({ type: "list", text: textContent, html: $.html($el) });
//       } else if (tagName === "table") {
//         blocks.push({ type: "table", text: $el.text(), html: $.html($el) });
//       } else {
//         // 문단은 p 태그로 감싸져 있다고 가정하되, 내용만 추출
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

//       // 이미지 버튼 셀렉터 단순화
//       const btn = page.locator('button[data-log="image"], .se-image-toolbar-button').first();
//       if (await btn.isVisible()) {
//         await btn.click({ force: true });
//       }

//       const fileChooser = await fileChooserPromise;
//       if (fileChooser) {
//         await fileChooser.setFiles(imagePath);
//         await page.waitForFunction(
//           (prevCount) => document.querySelectorAll("img").length > prevCount,
//           beforeCount,
//           { timeout: 10000 },
//         );
//       }
//     } catch (e) {
//       console.error("업로드 실패", e);
//     }
//   }
// }
