// packages/core/src/publisher/naverPublisher.ts

import { chromium, Page, BrowserContext } from "playwright";
import path from "path";
import { injectEditor } from "../injectEditor";

export class NaverPublisher {
  private userDataDir: string = path.join(process.cwd(), "../../.auth/naver");

  async postToBlog(
    blogId: string,
    title: string,
    htmlContent: string,
    password?: string,
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
        await dialog.dismiss();
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

        // 🔥 제목이 비어있으면 다시 입력
        if (!validation.title) {
          console.log("⚠️ 제목이 비어있음! 제목 재입력 시도...");

          // 제목 영역으로 이동
          const titleSelector = ".se-title-text";
          await page.click(titleSelector);
          await page.waitForTimeout(500);

          // 제목 입력 (키보드 방식)
          const isMac = process.platform === "darwin";
          await page.keyboard.press(isMac ? "Meta+A" : "Control+A");
          await page.keyboard.press("Backspace");
          await page.keyboard.type(title, { delay: 30 });
          await page.waitForTimeout(1000);

          // 재검증
          const retryTitle = await page
            .locator(titleSelector)
            .first()
            .evaluate((el: HTMLElement) => el.innerText.trim());

          console.log(`   재입력 제목: "${retryTitle}"`);

          if (!retryTitle) {
            throw new Error("제목 재입력 실패");
          }
        }

        // 최종 검증
        if (!validation.title && validation.contentLength < 10) {
          throw new Error("최종 검증 실패 - 제목이나 본문이 비어있음");
        }

        console.log("✅ 최종 검증 통과");
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
      }

      throw error;
    } finally {
      // if (context) {
      //   await context.close();
      // }
    }
  }

  /**
   * 🔍 디버깅: 페이지의 모든 입력 가능한 요소 찾기
   */
  private async debugPageElements(page: Page) {
    console.log("\n🔍 === 페이지 요소 디버깅 시작 ===");

    const elementInfo = await page.evaluate(() => {
      const info: any = {
        url: window.location.href,
        title: document.title,
        contentEditableElements: [],
        inputElements: [],
        textareaElements: [],
        iframes: [],
      };

      // 1. contenteditable 요소들
      document
        .querySelectorAll('[contenteditable="true"]')
        .forEach((el, idx) => {
          info.contentEditableElements.push({
            index: idx,
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            placeholder: el.getAttribute("placeholder"),
            text: el.textContent?.substring(0, 50),
          });
        });

      // 2. input 요소들
      document.querySelectorAll('input[type="text"]').forEach((el, idx) => {
        const input = el as HTMLInputElement;
        info.inputElements.push({
          index: idx,
          className: input.className,
          id: input.id,
          placeholder: input.placeholder,
          value: input.value,
        });
      });

      // 3. textarea 요소들
      document.querySelectorAll("textarea").forEach((el, idx) => {
        const textarea = el as HTMLTextAreaElement;
        info.textareaElements.push({
          index: idx,
          className: textarea.className,
          id: textarea.id,
          placeholder: textarea.placeholder,
        });
      });

      // 4. iframe 요소들
      document.querySelectorAll("iframe").forEach((el, idx) => {
        info.iframes.push({
          index: idx,
          id: el.id,
          name: el.name,
          src: el.src,
        });
      });

      return info;
    });

    console.log("\n📍 현재 URL:", elementInfo.url);
    console.log("📄 페이지 제목:", elementInfo.title);

    console.log("\n📝 ContentEditable 요소들:");
    elementInfo.contentEditableElements.forEach((el: any) => {
      console.log(
        `  [${el.index}] ${el.tagName}.${el.className}${el.id ? "#" + el.id : ""}`,
      );
      console.log(`      placeholder: ${el.placeholder || "null"}`);
      console.log(`      text: ${el.text || "(빈 값)"}`);
    });

    console.log("\n📝 Input 요소들:");
    elementInfo.inputElements.forEach((el: any) => {
      console.log(
        `  [${el.index}] .${el.className}${el.id ? "#" + el.id : ""}`,
      );
      console.log(`      placeholder: ${el.placeholder || "null"}`);
    });

    console.log("\n📝 Textarea 요소들:");
    elementInfo.textareaElements.forEach((el: any) => {
      console.log(
        `  [${el.index}] .${el.className}${el.id ? "#" + el.id : ""}`,
      );
      console.log(`      placeholder: ${el.placeholder || "null"}`);
    });

    console.log("\n🖼️ iframe 요소들:");
    elementInfo.iframes.forEach((el: any) => {
      console.log(`  [${el.index}] ${el.name || el.id || "(이름없음)"}`);
      console.log(`      src: ${el.src}`);
    });

    console.log("\n🔍 === 디버깅 종료 ===\n");

    // iframe이 있다면 경고
    if (elementInfo.iframes.length > 0) {
      console.log(
        "⚠️  iframe이 감지되었습니다. 에디터가 iframe 내부에 있을 수 있습니다!",
      );
    }

    return elementInfo;
  }

  /**
   * 🔍 네이버 에디터 객체 탐색
   */
  private async debugNaverEditor(page: Page) {
    console.log("\n🔍 === 네이버 에디터 객체 탐색 ===");

    const editorInfo = await page.evaluate(() => {
      const info: any = {
        hasSmartEditor: false,
        hasEditor: false,
        editorKeys: [],
        windowKeys: [],
      };

      // window 객체에서 에디터 관련 키 찾기
      const windowKeys = Object.keys(window).filter(
        (key) =>
          key.toLowerCase().includes("editor") ||
          key.toLowerCase().includes("se") ||
          key.toLowerCase().includes("smart"),
      );
      info.windowKeys = windowKeys;

      // 에디터 객체 확인
      if ((window as any).smartEditor) {
        info.hasSmartEditor = true;
        info.editorKeys = Object.keys((window as any).smartEditor);
      }

      if ((window as any).Editor) {
        info.hasEditor = true;
      }

      return info;
    });

    console.log("📦 에디터 정보:", JSON.stringify(editorInfo, null, 2));
    console.log("\n🔍 === 탐색 종료 ===\n");

    return editorInfo;
  }

  /**
   * 제목 입력 - 여러 방법 시도
   */
  private async enterTitle(page: Page, title: string, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n📝 제목 입력 시도 ${attempt}/${maxRetries}...`);

      try {
        const titleSelector = ".se-title-text";

        // 1. 제목 요소 확인
        const elementCount = await page.locator(titleSelector).count();
        if (elementCount === 0) {
          throw new Error(`${titleSelector} 요소를 찾을 수 없음`);
        }

        console.log(`   ✅ 제목 요소 발견`);

        // 2. 제목 요소로 스크롤 및 클릭
        await page.locator(titleSelector).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.locator(titleSelector).first().click({ force: true });
        await page.waitForTimeout(1000);

        // 3. 제목 입력 (여러 방법 시도)
        const methods = [
          // 방법 1: 키보드로 직접 입력 (가장 안전)
          async () => {
            console.log("   방법 1: 키보드 입력 시도");

            // 기존 텍스트 모두 선택
            const isMac = process.platform === "darwin";
            await page.keyboard.press(isMac ? "Meta+A" : "Control+A");
            await page.waitForTimeout(300);

            // 삭제
            await page.keyboard.press("Backspace");
            await page.waitForTimeout(300);

            // 새 제목 입력
            await page.keyboard.type(title, { delay: 30 });
            await page.waitForTimeout(1000);
          },

          // 방법 2: DOM 직접 조작 + 이벤트
          async () => {
            console.log("   방법 2: DOM 직접 조작 시도");

            await page.evaluate(
              (args) => {
                const selector = args.selector;
                const titleText = args.title;

                const titleElement = document.querySelector(
                  selector,
                ) as HTMLElement;
                if (!titleElement) return;

                // innerText 설정
                titleElement.innerText = titleText;
                titleElement.textContent = titleText;
                titleElement.focus();

                // 다양한 이벤트 발생
                ["input", "change", "blur", "keyup", "keydown"].forEach(
                  (eventType) => {
                    const event = new Event(eventType, {
                      bubbles: true,
                      cancelable: true,
                    });
                    titleElement.dispatchEvent(event);
                  },
                );

                // InputEvent도 시도
                const inputEvent = new InputEvent("input", {
                  bubbles: true,
                  cancelable: true,
                  data: titleText,
                });
                titleElement.dispatchEvent(inputEvent);
              },
              { selector: titleSelector, title },
            );

            await page.waitForTimeout(1000);
          },

          // 방법 3: execCommand 사용
          async () => {
            console.log("   방법 3: execCommand 시도");

            await page.evaluate(
              (args) => {
                const selector = args.selector;
                const titleText = args.title;

                const titleElement = document.querySelector(
                  selector,
                ) as HTMLElement;
                if (!titleElement) return;

                titleElement.focus();

                // 전체 선택
                document.execCommand("selectAll", false);
                // 삭제
                document.execCommand("delete", false);
                // 입력
                document.execCommand("insertText", false, titleText);
              },
              { selector: titleSelector, title },
            );

            await page.waitForTimeout(1000);
          },
        ];

        // 각 방법 시도
        for (let i = 0; i < methods.length; i++) {
          await methods[i]();

          // 검증
          const actualText = await page
            .locator(titleSelector)
            .first()
            .evaluate((el: HTMLElement) => el.innerText.trim());

          console.log(`      예상: "${title}"`);
          console.log(`      실제: "${actualText}"`);

          if (actualText === title.trim()) {
            console.log(`   ✅ 방법 ${i + 1} 성공!`);

            // Tab 키로 본문으로 이동하여 제목 확정
            await page.keyboard.press("Tab");
            await page.waitForTimeout(500);

            return; // 성공
          }
        }

        console.log("⚠️ 모든 방법 실패");
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
   * 본문 입력 - 제목을 보존하면서 주입
   */
  private async enterContent(page: Page, htmlContent: string) {
    console.log("\n📄 본문 입력 중...");

    try {
      // 1. 본문 영역으로 이동 (Tab 또는 클릭)
      const contentSelector = ".se-content";
      await page.waitForSelector(contentSelector, {
        state: "visible",
        timeout: 10000,
      });

      // 제목 다음 줄로 이동 (Enter 키 사용)
      console.log("   본문 영역으로 이동 중...");
      await page.keyboard.press("Enter"); // 제목에서 Enter로 본문으로 이동
      await page.waitForTimeout(500);

      console.log("   HTML 주입 중...");

      // 2. 현재 커서 위치에 HTML 주입 (제목은 건드리지 않음)
      const injected = await page.evaluate((htmlContent) => {
        try {
          // 현재 포커스된 요소 찾기
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) {
            console.error("선택 영역이 없습니다");
            return false;
          }

          const range = selection.getRangeAt(0);

          // 임시 div 생성하여 HTML 파싱
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = htmlContent;

          // 각 자식 노드를 현재 위치에 삽입
          const fragment = document.createDocumentFragment();
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }

          // 현재 커서 위치에 삽입
          range.deleteContents();
          range.insertNode(fragment);

          // 커서를 삽입된 내용 끝으로 이동
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);

          // input 이벤트 발생
          const contentEl = document.querySelector(".se-content");
          if (contentEl) {
            const event = new Event("input", { bubbles: true });
            contentEl.dispatchEvent(event);
          }

          return true;
        } catch (e) {
          console.error("HTML 주입 실패:", e);
          return false;
        }
      }, htmlContent);

      if (!injected) {
        // 대안: injectEditor 함수 사용 (하지만 제목 영역 보호 필요)
        console.log("   대안 방식으로 HTML 주입 시도...");

        // 본문 영역만 선택적으로 주입
        await page.evaluate(
          (args) => {
            const htmlContent = args.htmlContent;
            const injectFn = args.injectEditor;

            // injectEditor 함수를 문자열로 받아서 실행
            const fn = new Function("htmlContent", injectFn);
            fn(htmlContent);
          },
          { htmlContent, injectEditor: injectEditor.toString() },
        );
      }

      await page.waitForTimeout(2000);

      // 3. 검증
      const hasContent = await page.evaluate(() => {
        const content = document.querySelector(".se-content");
        return content && content.textContent!.trim().length > 10;
      });

      if (!hasContent) {
        throw new Error("본문 검증 실패 - 컨텐츠가 비어있음");
      }

      console.log("✅ 본문 입력 및 검증 완료");

      // 4. 에디터 밖을 클릭하여 확정
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1000);
    } catch (error) {
      console.error("❌ 본문 입력 실패:", error);
      throw error;
    }
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
}
