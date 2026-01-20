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
      await this.debugPageElements(page);
      await this.debugNaverEditor(page);

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
        // await this.publish(page);

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
   * 제목 입력 - Tab 키 제거
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

        // 3. 제목 입력 (키보드 방식만 사용)
        console.log("   키보드 입력 시도");

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

        // 검증
        const actualText = await page
          .locator(titleSelector)
          .first()
          .evaluate((el: HTMLElement) => el.innerText.trim());

        console.log(`      예상: "${title}"`);
        console.log(`      실제: "${actualText}"`);

        if (actualText === title.trim()) {
          console.log(`   ✅ 제목 입력 성공!`);

          // ❌ Tab 키 제거 - 대신 Escape로 포커스 해제만
          await page.keyboard.press("Escape");
          await page.waitForTimeout(500);

          return; // 성공
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
   * 본문 입력 - 정확한 본문 영역에 주입
   */
  private async enterContent(page: Page, htmlContent: string) {
    console.log("\n📄 본문 주입 시도 (포커스 강제 고정)...");

    try {
      // 1. 제목 영역에서 확실히 빠져나오기
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      // 2. 본문 영역의 실제 입력 가능 지점(Paragraph) 셀렉터
      // 네이버 에디터 본문의 첫 번째 문단을 정확히 타겟팅합니다.
      const bodyInputSelector = '[data-a11y-title="본문"] .se-text-paragraph';

      await page.waitForSelector(bodyInputSelector, {
        state: "visible",
        timeout: 10000,
      });

      // 3. 본문을 클릭하여 포커스 주되, 확실하게 하기 위해 '중앙'을 클릭
      const bodyBox = await page.$(bodyInputSelector);
      if (bodyBox) {
        await bodyBox.click({ force: true });
        await page.waitForTimeout(500);
      }

      // 4. 에디터가 '입력 모드'로 전환되도록 화살표 아래 키 한 번 더 입력
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);

      // 5. HTML 세척 (제목 주입 방지를 위해 구조 단순화)
      const cleanHtml = htmlContent
        .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "<strong>$1</strong><br>")
        .replace(/<p[^>]*>/gi, "<div>")
        .replace(/<\/p>/gi, "</div>");

      // 6. 클립보드 복사 및 붙여넣기
      await page.evaluate((text) => {
        const type = "text/html";
        const blob = new Blob([text], { type });
        const data = [new ClipboardItem({ [type]: blob })];
        navigator.clipboard.write(data);
      }, cleanHtml);

      const modifier = process.platform === "darwin" ? "Meta" : "Control";
      await page.keyboard.press(`${modifier}+V`);

      console.log("   붙여넣기 완료. 데이터 처리 대기...");
      await page.waitForTimeout(3000);

      // 7. 검증: 제목과 본문 각각 확인
      const check = await page.evaluate(() => {
        const titleText =
          document.querySelector(".se-title-text")?.textContent || "";
        const bodyText =
          document.querySelector('[data-a11y-title="본문"]')?.textContent || "";
        return { titleLength: titleText.length, bodyLength: bodyText.length };
      });

      console.log(
        `   검증 결과 - 제목 길이: ${check.titleLength}, 본문 길이: ${check.bodyLength}`,
      );
    } catch (error) {
      console.error("❌ 본문 입력 실패:", error);
      throw error;
    }
  }

  private async publish(page: Page, tags: string[] = []) {
    console.log("\n🚀 발행 프로세스 시작...");

    try {
      // 1. 상단 '발행' 버튼 클릭
      const openPublishLayerBtn = ".is_active.btn_publish"; // 발행 레이어를 여는 버튼
      await page.waitForSelector(openPublishLayerBtn, {
        state: "visible",
        timeout: 5000,
      });
      await page.click(openPublishLayerBtn);
      console.log("   발행 설정 레이어 열기 성공");

      // 레이어가 애니메이션으로 뜨는 시간 대기
      await page.waitForTimeout(1000);

      // 2. 태그 입력 (옵션)
      if (tags && tags.length > 0) {
        console.log(`   태그 입력 중: ${tags.join(", ")}`);
        const tagInputSelector = ".tag_input"; // 태그 입력창

        for (const tag of tags) {
          await page.click(tagInputSelector);
          await page.keyboard.type(tag);
          await page.keyboard.press("Enter");
          await page.waitForTimeout(200);
        }
      }

      // 3. 최종 '발행' 버튼 클릭
      // 네이버는 이 버튼에 .btn_confirm 또는 .publish_btn 등의 클래스를 씁니다.
      const finalPublishBtn = ".confirm_btn___v9_6W, .btn_confirm";

      await page.waitForSelector(finalPublishBtn, {
        state: "visible",
        timeout: 5000,
      });

      // 실제 발행을 원하시면 아래 주석을 해제하세요.
      // 현재는 안전을 위해 버튼이 있는지 확인만 하고 로그를 남깁니다.
      /*
    await page.click(finalPublishBtn);
    console.log("✅ 최종 발행 완료!");
    */

      console.log(
        "📢 [안내] 실제 발행 버튼 클릭 직전입니다. 코드를 확인하고 주석을 해제하세요.",
      );
    } catch (error) {
      console.error("❌ 발행 중 에러 발생:", error);
      throw error;
    }
  }
  // private async enterContent(page: Page, htmlContent: string) {
  //   console.log("\n📄 본문 입력 중...");

  //   await this.debugBeforeContentInjection(page);

  //   try {
  //     console.log("   본문 영역 찾기 중...");

  //     // 정확한 본문 영역 selector
  //     // data-a11y-title="본문"인 컴포넌트 찾기
  //     const bodyComponentSelector = '[data-a11y-title="본문"]';

  //     await page.waitForSelector(bodyComponentSelector, {
  //       state: "visible",
  //       timeout: 10000,
  //     });

  //     // 본문 컴포넌트 내부의 실제 텍스트 입력 영역 클릭
  //     const textModuleSelector = '[data-a11y-title="본문"] .se-module-text';

  //     await page.waitForSelector(textModuleSelector, {
  //       state: "visible",
  //       timeout: 10000,
  //     });

  //     console.log("   본문 텍스트 모듈 클릭...");
  //     await page.click(textModuleSelector);
  //     await page.waitForTimeout(1000);

  //     console.log("   HTML 주입 중...");

  //     // 본문 영역에 HTML 주입
  //     const injectionSuccess = await page.evaluate((htmlContent) => {
  //       try {
  //         // 본문 컴포넌트의 텍스트 모듈 찾기
  //         const textModule = document.querySelector(
  //           '[data-a11y-title="본문"] .se-module-text',
  //         ) as HTMLElement;

  //         if (!textModule) {
  //           console.error("본문 텍스트 모듈을 찾을 수 없습니다");
  //           return false;
  //         }

  //         console.log(
  //           "주입 전 본문 모듈:",
  //           textModule.innerHTML.substring(0, 200),
  //         );

  //         // 기존 placeholder 제거
  //         const placeholder = textModule.querySelector(".se-placeholder");
  //         if (placeholder) {
  //           placeholder.remove();
  //         }

  //         // 기존 빈 paragraph 찾기
  //         const existingP = textModule.querySelector("p.se-text-paragraph");

  //         if (existingP) {
  //           // 기존 paragraph의 빈 span 제거
  //           const emptySpans = existingP.querySelectorAll("span.__se-node");
  //           emptySpans.forEach((span) => {
  //             if (!span.textContent || span.textContent.trim() === "") {
  //               span.remove();
  //             }
  //           });

  //           // HTML 파싱
  //           const tempDiv = document.createElement("div");
  //           tempDiv.innerHTML = htmlContent;

  //           // paragraph에 내용 추가
  //           while (tempDiv.firstChild) {
  //             existingP.appendChild(tempDiv.firstChild);
  //           }
  //         } else {
  //           // paragraph가 없으면 새로 생성
  //           const newP = document.createElement("p");
  //           newP.className = "se-text-paragraph se-text-paragraph-align-left";
  //           newP.style.lineHeight = "1.8";

  //           const tempDiv = document.createElement("div");
  //           tempDiv.innerHTML = htmlContent;

  //           while (tempDiv.firstChild) {
  //             newP.appendChild(tempDiv.firstChild);
  //           }

  //           textModule.appendChild(newP);
  //         }

  //         console.log(
  //           "주입 후 본문 모듈:",
  //           textModule.innerHTML.substring(0, 200),
  //         );
  //         console.log("주입 후 텍스트 길이:", textModule.textContent?.length);

  //         // se-is-empty 클래스 제거 (빈 상태 표시 제거)
  //         textModule.classList.remove("se-is-empty");

  //         // 이벤트 발생
  //         textModule.dispatchEvent(new InputEvent("input", { bubbles: true }));
  //         textModule.dispatchEvent(new Event("change", { bubbles: true }));

  //         // 상위 컴포넌트에도 이벤트 발생
  //         const bodyComponent = document.querySelector(
  //           '[data-a11y-title="본문"]',
  //         );
  //         if (bodyComponent) {
  //           bodyComponent.dispatchEvent(
  //             new InputEvent("input", { bubbles: true }),
  //           );
  //           bodyComponent.dispatchEvent(new Event("change", { bubbles: true }));
  //         }

  //         return (
  //           textModule.textContent && textModule.textContent.trim().length > 10
  //         );
  //       } catch (e) {
  //         console.error("HTML 주입 실패:", e);
  //         return false;
  //       }
  //     }, htmlContent);

  //     console.log(`   주입 결과: ${injectionSuccess ? "성공" : "실패"}`);

  //     await page.waitForTimeout(2000);

  //     // 검증 - 정확한 본문 영역만 체크
  //     const verification = await page.evaluate(() => {
  //       const titleEl = document.querySelector(".se-title-text") as HTMLElement;
  //       const bodyTextModule = document.querySelector(
  //         '[data-a11y-title="본문"] .se-module-text',
  //       ) as HTMLElement;
  //       const bodyComponent = document.querySelector(
  //         '[data-a11y-title="본문"]',
  //       ) as HTMLElement;

  //       return {
  //         titleText: titleEl?.innerText?.trim() || "",
  //         titleLength: titleEl?.innerText?.trim().length || 0,
  //         bodyModuleText: bodyTextModule?.textContent?.trim() || "",
  //         bodyModuleLength: bodyTextModule?.textContent?.trim().length || 0,
  //         bodyModuleHTML: bodyTextModule?.innerHTML?.substring(0, 300) || "",
  //         bodyComponentHTML: bodyComponent?.innerHTML?.substring(0, 300) || "",
  //       };
  //     });

  //     console.log(`\n   === 검증 결과 ===`);
  //     console.log(
  //       `   제목: "${verification.titleText}" (${verification.titleLength}자)`,
  //     );
  //     console.log(`   본문 길이: ${verification.bodyModuleLength}자`);
  //     console.log(
  //       `   본문 미리보기: ${verification.bodyModuleText.substring(0, 150)}...`,
  //     );
  //     console.log(`   본문 HTML:\n${verification.bodyModuleHTML}\n`);

  //     if (verification.titleLength > 100) {
  //       throw new Error(
  //         `제목이 비정상적으로 김 (${verification.titleLength}자)`,
  //       );
  //     }

  //     if (verification.bodyModuleLength < 10) {
  //       console.error(
  //         "본문 컴포넌트 전체 HTML:",
  //         verification.bodyComponentHTML,
  //       );
  //       throw new Error(
  //         `본문이 비어있음 - 길이: ${verification.bodyModuleLength}자`,
  //       );
  //     }

  //     console.log("✅ 본문 입력 및 검증 완료");

  //     await page.keyboard.press("Escape");
  //     await page.waitForTimeout(1000);
  //   } catch (error) {
  //     console.error("❌ 본문 입력 실패:", error);
  //     throw error;
  //   }
  // }
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

  /**
   * 본문 입력 전 디버깅
   */
  private async debugBeforeContentInjection(page: Page) {
    console.log("\n🔍 === 본문 주입 전 상태 확인 ===");

    const debugInfo = await page.evaluate(() => {
      const editor = document.querySelector(".se-content") as HTMLElement;
      const titleEl = document.querySelector(".se-title-text") as HTMLElement;

      return {
        editorExists: !!editor,
        editorHTML: editor?.innerHTML || "",
        editorChildren: Array.from(editor?.children || []).map((child) => ({
          tagName: child.tagName,
          className: child.className,
          id: child.id,
          textContent: child.textContent?.substring(0, 50),
        })),
        titleExists: !!titleEl,
        titleText: titleEl?.innerText || "",
        focusedElement:
          document.activeElement?.tagName +
          "." +
          document.activeElement?.className,
        selection: (() => {
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return null;
          const range = sel.getRangeAt(0);
          return {
            text: sel.toString(),
            containerTagName: (range.commonAncestorContainer as HTMLElement)
              .tagName,
            containerClassName: (range.commonAncestorContainer as HTMLElement)
              .className,
          };
        })(),
      };
    });

    console.log("📦 디버그 정보:");
    console.log(JSON.stringify(debugInfo, null, 2));
    console.log("\n에디터 HTML:");
    console.log(debugInfo.editorHTML);
    console.log("\n🔍 === 디버깅 종료 ===\n");

    return debugInfo;
  }
}
