/// <reference lib="dom" />

/**
 * 네이버 스마트에디터에 HTML 주입 - 제목 명시적 보존
 */
export function injectEditor(html: string) {
  const editor = document.querySelector(".se-content") as HTMLElement | null;
  if (!editor) {
    console.error(".se-content를 찾을 수 없습니다");
    return false;
  }

  try {
    // 1. 제목 요소 찾아서 보존
    const titleElement = editor.querySelector(
      '.se-title-text, .se-component-content[data-type="title"]',
    ) as HTMLElement | null;
    const titleHTML = titleElement ? titleElement.outerHTML : "";
    const titleText = titleElement ? titleElement.innerText : "";

    console.log("보존할 제목:", titleText);

    // 2. 본문 영역만 찾기 (제목 제외)
    let contentArea: HTMLElement | null = null;

    // 제목 다음 형제 요소 찾기
    if (titleElement && titleElement.nextElementSibling) {
      contentArea = titleElement.nextElementSibling as HTMLElement;
    }

    // 3. HTML 주입
    if (contentArea) {
      // 제목 다음 영역에만 주입
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;

      contentArea.innerHTML = "";
      while (tempDiv.firstChild) {
        contentArea.appendChild(tempDiv.firstChild);
      }
    } else {
      // contentArea를 못 찾은 경우: 제목을 보존하면서 전체 재구성
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;

      // 기존 내용 백업
      const originalChildren = Array.from(editor.children);

      // editor 비우기
      editor.innerHTML = "";

      // 제목 복원
      if (titleHTML) {
        editor.innerHTML = titleHTML;
      }

      // 본문 추가
      while (tempDiv.firstChild) {
        editor.appendChild(tempDiv.firstChild);
      }
    }

    // 4. 이벤트 발생
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));

    // 5. 검증
    const finalTitle = editor
      .querySelector(".se-title-text")
      ?.textContent?.trim();
    console.log("주입 후 제목:", finalTitle);
    console.log("주입 후 전체 길이:", editor.textContent?.length);

    editor.focus();

    return true;
  } catch (error) {
    console.error("injectEditor 실패:", error);
    return false;
  }
}
