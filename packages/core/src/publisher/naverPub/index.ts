// packages/core/src/publisher/naverPublisher.ts
/// <reference lib="dom" />
import { chromium, Page, BrowserContext } from "playwright";
import path from "path";

export class NaverPublisher {
  private userDataDir: string = path.join(process.cwd(), "../../.auth/naver");

  async postToBlog(
    blogId: string,
    title: string,
    htmlContent: string,
    password?: string,
    tags: string[] = [],
  ) {
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
        // 페이지 이탈(beforeunload) 시에는 '나가기(accept)' 처리하여 저장하지 않고 종료
        if (dialog.type() === "beforeunload") {
          await dialog.accept();
        } else {
          // 그 외(작성 중인 글 불러오기 등)는 '취소(dismiss)' 처리하여 새 글 작성 유도
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

      // 팝업 청소부
      await this.clearPopups(page);

      console.log("⏳ 에디터 로딩 대기 중...");
      await page.waitForTimeout(5000);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);

      // 디버깅 (필요시 주석 해제)
      // await this.debugPageElements(page);
      // await this.debugNaverEditor(page);

      try {
        // 제목 입력
        await this.enterTitle(page, title);

        // 제목 입력 후 추가 대기
        await page.waitForTimeout(1000);

        // 본문 입력
        await this.enterContent(page, htmlContent);

        // 입력 완료 후 추가 대기
        await page.waitForTimeout(2000);

        // 최종 검증
        console.log("\n🔍 최종 검증 중...");
        const validation = await page.evaluate(() => {
          const titleEl = document.querySelector(
            ".se-title-text",
          ) as HTMLElement;
          const contentEl = document.querySelector(
            ".se-content",
          ) as HTMLElement;

          return {
            title: titleEl?.innerText.trim() || "",
            contentLength: contentEl?.textContent?.trim().length || 0,
          };
        });

        console.log(`   제목: "${validation.title}"`);
        console.log(`   본문 길이: ${validation.contentLength}자`);

        // 발행
        // await this.publish(page, tags);

        console.log("✅ 작성 완료 (발행은 수동으로 진행하세요)");
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
        console.log(`🌐 현재 페이지 URL: ${page.url()}`);

        // 페이지 HTML 구조 저장
        const htmlPath = path.join(process.cwd(), `error-${Date.now()}.html`);
        const htmlContent = await page.content();
        await require("fs").promises.writeFile(htmlPath, htmlContent);
        console.log(`📄 페이지 HTML 저장: ${htmlPath}`);

        // 🔥 발행 실패 시 정리: 작성 중인 내용을 저장하지 않고 이탈 시도
        // 이렇게 하면 다음 실행 시 '작성 중인 글이 있습니다' 팝업 빈도를 줄일 수 있음
        try {
          console.log("🧹 발행 실패 정리: 페이지 이탈 시도...");
          await page.goto("about:blank", { timeout: 3000 });
        } catch (e) {
          // 이미 닫혔거나 타임아웃 등은 무시
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
    // 네이버 임시저장 팝업의 '취소' 버튼 전용 셀렉터
    const CANCEL_SELECTOR = ".se-popup-button.se-popup-button-cancel";

    try {
      // 3초 정도 기다려보고 있으면 클릭
      const cancelBtn = await page.waitForSelector(CANCEL_SELECTOR, {
        timeout: 3000,
      });
      if (cancelBtn) {
        await cancelBtn.click();
        console.log("✅ 임시저장 불러오기 취소 완료");
      }
    } catch (e) {
      // 팝업이 안 뜨는 경우가 정상이므로 에러는 무시
      console.log("ℹ️ 활성화된 임시저장 팝업 없음");
    }

    // 도움말 팝업 등은 Escape로 한 번 더 방어
    await page.keyboard.press("Escape");
  }

  /**
   * 제목 입력 - 이모지 정규화 추가
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

        // 제목 입력
        await page.keyboard.type(title, { delay: 30 });
        await page.waitForTimeout(1000);

        // 검증 - 이모지 정규화하여 비교
        const actualText = await page
          .locator(titleSelector)
          .first()
          .evaluate((el: HTMLElement) => el.innerText.trim());

        console.log(`      예상: "${title}"`);
        console.log(`      실제: "${actualText}"`);

        // 이모지를 정규화하여 비교 (variation selector 제거)
        const normalizeEmoji = (str: string) => {
          // variation selector (U+FE0F) 제거
          return str.replace(/\uFE0F/g, "");
        };

        const normalizedTitle = normalizeEmoji(title.trim());
        const normalizedActual = normalizeEmoji(actualText);

        console.log(`      정규화 예상: "${normalizedTitle}"`);
        console.log(`      정규화 실제: "${normalizedActual}"`);

        if (normalizedActual === normalizedTitle) {
          console.log(`   ✅ 제목 입력 성공!`);
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
   * 본문 입력 - 안전한 타이핑 방식
   */
  private async enterContent(page: Page, htmlContent: string) {
    console.log("\n📄 본문 입력 중...");

    try {
      // 1. 포커스 초기화
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      // 2. 본문 영역 클릭 (여러 selector 시도)
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
            console.log(`   ✅ 본문 영역 클릭 성공: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!clicked) {
        throw new Error("본문 영역을 찾을 수 없음");
      }

      // 3. 커서 활성화 확인
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(300);

      // 4. HTML을 텍스트로 변환 (Node.js 환경에서 실행)
      console.log("   HTML을 텍스트로 변환 중...");
      const textBlocks = this.htmlToTextBlocks(htmlContent);

      console.log(`   총 ${textBlocks.length}개 블록 입력 시작...`);

      // 5. 각 블록 타이핑
      for (let i = 0; i < textBlocks.length; i++) {
        const block = textBlocks[i];

        console.log(
          `   [${i + 1}/${textBlocks.length}] 입력 중... (${block.substring(0, 30)}...)`,
        );

        // 타이핑 (이모지 포함 가능하므로 천천히)
        await page.keyboard.type(block, { delay: 20 });

        // 블록 간 간격
        await page.keyboard.press("Enter");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(100);
      }

      console.log("   ✅ 타이핑 완료");
      await page.waitForTimeout(2000);

      // 6. 검증
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
      console.log(
        `   본문 미리보기: ${verification.bodyText.substring(0, 100)}...`,
      );

      // 제목이 너무 길면 본문이 제목에 들어간 것
      if (verification.titleLength > 150) {
        throw new Error(
          `제목이 비정상적으로 김 (${verification.titleLength}자) - 본문이 제목에 들어간 것 같음`,
        );
      }

      if (verification.bodyLength < 50) {
        throw new Error(`본문이 너무 짧음 (${verification.bodyLength}자)`);
      }

      console.log("✅ 본문 입력 및 검증 완료");

      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    } catch (error) {
      console.error("❌ 본문 입력 실패:", error);

      // 실패 시 현재 상태 확인
      const debugInfo = await page.evaluate(() => {
        return {
          activeElement:
            document.activeElement?.tagName +
            "." +
            document.activeElement?.className,
          titleText:
            document.querySelector(".se-title-text")?.textContent || "",
          bodyText:
            document.querySelector('[data-a11y-title="본문"]')?.textContent ||
            "",
        };
      });

      console.error("디버그 정보:", debugInfo);
      throw error;
    }
  }

  /**
   * HTML을 텍스트 블록으로 변환 (Node.js 환경)
   */
  private htmlToTextBlocks(html: string): string[] {
    const blocks: string[] = [];

    // 간단한 HTML 태그 제거 및 텍스트 추출
    // cheerio나 jsdom 대신 정규식 사용 (의존성 최소화)

    // 1. <br> 태그를 줄바꿈으로 변환
    let text = html.replace(/<br\s*\/?>/gi, "\n");

    // 2. </p>, </div>, </li> 등을 줄바꿈으로 변환
    text = text.replace(/<\/(p|div|li|h[1-6])>/gi, "\n");

    // 3. 리스트 아이템 처리
    text = text.replace(/<li[^>]*>/gi, "• ");

    // 4. 제목 태그 처리
    text = text.replace(/<h[1-3][^>]*>/gi, "\n### ");
    text = text.replace(/<h[4-6][^>]*>/gi, "\n## ");

    // 5. 모든 HTML 태그 제거
    text = text.replace(/<[^>]+>/g, "");

    // 6. HTML 엔티티 디코딩
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // 7. 줄바꿈 기준으로 분리
    const lines = text.split("\n");

    // 8. 빈 줄 제거하고 블록 생성
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        blocks.push(trimmed);
      }
    }

    return blocks;
  }

  /**
   * 네이버 로그인
   */
  private async login(page: Page, id: string, pw: string) {
    try {
      console.log("🔐 로그인 진행 중...");

      const isMac = process.platform === "darwin";
      const pasteKey = isMac ? "Meta+V" : "Control+V";

      await page.waitForSelector("#id", { timeout: 10000 });

      // 1. 아이디 입력
      console.log("   아이디 입력 중...");
      await page.click("#id");

      // 클립보드에 복사 (await 추가!)
      await page.evaluate((text) => {
        return navigator.clipboard.writeText(text);
      }, id);

      await page.waitForTimeout(500); // 클립보드 복사 완료 대기
      await page.keyboard.press(pasteKey);
      await page.waitForTimeout(800);

      // 입력 검증
      const idValue = await page.inputValue("#id");
      console.log(`   입력된 아이디: ${idValue}`);

      if (idValue !== id) {
        console.warn(`   ⚠️ 아이디 불일치 - 예상: ${id}, 실제: ${idValue}`);
      }

      // 2. 비밀번호 입력
      console.log("   비밀번호 입력 중...");
      await page.click("#pw");

      // 클립보드에 복사 (await 추가!)
      await page.evaluate((text) => {
        return navigator.clipboard.writeText(text);
      }, pw);

      await page.waitForTimeout(500); // 클립보드 복사 완료 대기
      await page.keyboard.press(pasteKey);
      await page.waitForTimeout(800);

      // 3. 로그인 버튼 클릭
      const loginButtonSelector = ".btn_login";
      await page.waitForSelector(loginButtonSelector, { timeout: 5000 });
      await page.click(loginButtonSelector);

      console.log("   ✅ 로그인 버튼 클릭 완료, 리다이렉트 대기 중...");
    } catch (error) {
      console.error("❌ 자동 로그인 실패:", error);
      throw new Error("자동 로그인 실패. 수동으로 로그인해주세요.");
    }
  }

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

  /**
   * 🔍 디버깅: 페이지의 모든 입력 가능한 요소 찾기
   */
  // private async debugPageElements(page: Page) {
  //   console.log("\n🔍 === 페이지 요소 디버깅 시작 ===");

  //   const elementInfo = await page.evaluate(() => {
  //     const info: any = {
  //       url: window.location.href,
  //       title: document.title,
  //       contentEditableElements: [],
  //       inputElements: [],
  //       textareaElements: [],
  //       iframes: [],
  //     };

  //     // 1. contenteditable 요소들
  //     document
  //       .querySelectorAll('[contenteditable="true"]')
  //       .forEach((el, idx) => {
  //         info.contentEditableElements.push({
  //           index: idx,
  //           tagName: el.tagName,
  //           className: el.className,
  //           id: el.id,
  //           placeholder: el.getAttribute("placeholder"),
  //           text: el.textContent?.substring(0, 50),
  //         });
  //       });

  //     // 2. input 요소들
  //     document.querySelectorAll('input[type="text"]').forEach((el, idx) => {
  //       const input = el as HTMLInputElement;
  //       info.inputElements.push({
  //         index: idx,
  //         className: input.className,
  //         id: input.id,
  //         placeholder: input.placeholder,
  //         value: input.value,
  //       });
  //     });

  //     // 3. textarea 요소들
  //     document.querySelectorAll("textarea").forEach((el, idx) => {
  //       const textarea = el as HTMLTextAreaElement;
  //       info.textareaElements.push({
  //         index: idx,
  //         className: textarea.className,
  //         id: textarea.id,
  //         placeholder: textarea.placeholder,
  //       });
  //     });

  //     // 4. iframe 요소들
  //     document.querySelectorAll("iframe").forEach((el, idx) => {
  //       info.iframes.push({
  //         index: idx,
  //         id: el.id,
  //         name: el.name,
  //         src: el.src,
  //       });
  //     });

  //     return info;
  //   });

  //   console.log("\n📍 현재 URL:", elementInfo.url);
  //   console.log("📄 페이지 제목:", elementInfo.title);

  //   console.log("\n📝 ContentEditable 요소들:");
  //   elementInfo.contentEditableElements.forEach((el: any) => {
  //     console.log(
  //       `  [${el.index}] ${el.tagName}.${el.className}${el.id ? "#" + el.id : ""}`,
  //     );
  //     console.log(`      placeholder: ${el.placeholder || "null"}`);
  //     console.log(`      text: ${el.text || "(빈 값)"}`);
  //   });

  //   console.log("\n📝 Input 요소들:");
  //   elementInfo.inputElements.forEach((el: any) => {
  //     console.log(
  //       `  [${el.index}] .${el.className}${el.id ? "#" + el.id : ""}`,
  //     );
  //     console.log(`      placeholder: ${el.placeholder || "null"}`);
  //   });

  //   console.log("\n📝 Textarea 요소들:");
  //   elementInfo.textareaElements.forEach((el: any) => {
  //     console.log(
  //       `  [${el.index}] .${el.className}${el.id ? "#" + el.id : ""}`,
  //     );
  //     console.log(`      placeholder: ${el.placeholder || "null"}`);
  //   });

  //   console.log("\n🖼️ iframe 요소들:");
  //   elementInfo.iframes.forEach((el: any) => {
  //     console.log(`  [${el.index}] ${el.name || el.id || "(이름없음)"}`);
  //     console.log(`      src: ${el.src}`);
  //   });

  //   console.log("\n🔍 === 디버깅 종료 ===\n");

  //   // iframe이 있다면 경고
  //   if (elementInfo.iframes.length > 0) {
  //     console.log(
  //       "⚠️  iframe이 감지되었습니다. 에디터가 iframe 내부에 있을 수 있습니다!",
  //     );
  //   }

  //   return elementInfo;
  // }

  /**
   * 본문 입력 전 디버깅
   */
  // private async debugBeforeContentInjection(page: Page) {
  //   console.log("\n🔍 === 본문 주입 전 상태 확인 ===");

  //   const debugInfo = await page.evaluate(() => {
  //     const editor = document.querySelector(".se-content") as HTMLElement;
  //     const titleEl = document.querySelector(".se-title-text") as HTMLElement;

  //     return {
  //       editorExists: !!editor,
  //       editorHTML: editor?.innerHTML || "",
  //       editorChildren: Array.from(editor?.children || []).map((child) => ({
  //         tagName: child.tagName,
  //         className: child.className,
  //         id: child.id,
  //         textContent: child.textContent?.substring(0, 50),
  //       })),
  //       titleExists: !!titleEl,
  //       titleText: titleEl?.innerText || "",
  //       focusedElement:
  //         document.activeElement?.tagName +
  //         "." +
  //         document.activeElement?.className,
  //       selection: (() => {
  //         const sel = window.getSelection();
  //         if (!sel || sel.rangeCount === 0) return null;
  //         const range = sel.getRangeAt(0);
  //         return {
  //           text: sel.toString(),
  //           containerTagName: (range.commonAncestorContainer as HTMLElement)
  //             .tagName,
  //           containerClassName: (range.commonAncestorContainer as HTMLElement)
  //             .className,
  //         };
  //       })(),
  //     };
  //   });

  //   console.log("📦 디버그 정보:");
  //   console.log(JSON.stringify(debugInfo, null, 2));
  //   console.log("\n에디터 HTML:");
  //   console.log(debugInfo.editorHTML);
  //   console.log("\n🔍 === 디버깅 종료 ===\n");

  //   return debugInfo;
  // }

  /**
   * 🔍 네이버 에디터 객체 탐색
   */
  // private async debugNaverEditor(page: Page) {
  //   console.log("\n🔍 === 네이버 에디터 객체 탐색 ===");

  //   const editorInfo = await page.evaluate(() => {
  //     const info: any = {
  //       hasSmartEditor: false,
  //       hasEditor: false,
  //       editorKeys: [],
  //       windowKeys: [],
  //     };

  //     // window 객체에서 에디터 관련 키 찾기
  //     const windowKeys = Object.keys(window).filter(
  //       (key) =>
  //         key.toLowerCase().includes("editor") ||
  //         key.toLowerCase().includes("se") ||
  //         key.toLowerCase().includes("smart"),
  //     );
  //     info.windowKeys = windowKeys;

  //     // 에디터 객체 확인
  //     if ((window as any).smartEditor) {
  //       info.hasSmartEditor = true;
  //       info.editorKeys = Object.keys((window as any).smartEditor);
  //     }

  //     if ((window as any).Editor) {
  //       info.hasEditor = true;
  //     }

  //     return info;
  //   });

  //   console.log("📦 에디터 정보:", JSON.stringify(editorInfo, null, 2));
  //   console.log("\n🔍 === 탐색 종료 ===\n");

  //   return editorInfo;
  // }
}
