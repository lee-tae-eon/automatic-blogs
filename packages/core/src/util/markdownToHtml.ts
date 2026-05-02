/**
 * 마크다운을 네이버 블로그용 HTML로 변환합니다.
 * [v4.0 Simple is Best]
 * - 복잡한 CSS 인라인 스타일을 모두 제거합니다.
 * - 네이버 에디터의 기본 스타일을 신뢰하고, 태그의 의미(Semantic)만 전달합니다.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const { unified } = await import("unified");
  const { default: remarkParse } = await import("remark-parse");
  const { default: remarkHtml } = await import("remark-html");
  const { default: remarkGfm } = await import("remark-gfm");

  // 1. Frontmatter 제거
  let content = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");

  // [v13.1 Hotfix] 리스트 종결 처리 보완 (Markdown 전처리)
  // 리스트 항목(-, 1. 등) 바로 뒤에 빈 줄 없이 일반 텍스트가 오면 강제로 빈 줄을 삽입하여 리스트 합침 현상 방지
  content = content.replace(/(\n\s*[-*1234567890.]+\s+.+)\n([^\s-*1234567890.\n<])/g, "$1\n\n$2");

  // 2. 마크다운 -> HTML 변환 (Pure HTML)
  // [v4.7] 실험적인 줄바꿈 로직 제거 (네이버 에디터 호환성 문제 해결)
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(content);
  
  let html = result.toString();

  // 3. [v8.0] 프리미엄 디자인 박스 변환 (Inline Styles for Naver Editor)
  // AI가 생성한 <div class="..."> 태그를 네이버 에디터가 인식할 수 있는 인라인 스타일로 변환합니다.
  
  const boxStyles: Record<string, string> = {
    "summary-box": "background-color: #f0f7ff; border: 1px solid #d0e3ff; padding: 20px; border-radius: 12px; margin: 20px 0;",
    "tip-box": "background-color: #f6fff5; border: 1px solid #e1f5e0; padding: 20px; border-radius: 12px; margin: 20px 0;",
    "warning-box": "background-color: #fff9f0; border: 1px solid #ffe8d0; padding: 20px; border-radius: 12px; margin: 20px 0;",
    "related-box": "background-color: #f8fbff; border: 2px dashed #6366f1; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center;",
    "qna-box": "background-color: #ffffff; border: 1px solid #eaeaea; border-left: 5px solid #6366f1; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: left; box-shadow: 0 2px 10px rgba(0,0,0,0.04);",
    "checkpoint": "background-color: #f8f9fa; border-left: 5px solid #03c75a; padding: 15px 20px; margin: 20px 0; font-style: italic;"
  };

  Object.entries(boxStyles).forEach(([className, style]) => {
    // 따옴표(단일/이중) 모두 지원하도록 정규식 개선
    const regex = new RegExp(`<div class=['"]${className}['"]>([\\s\\S]*?)<\\/div>`, "gi");
    html = html.replace(regex, (match, content) => {
      return `<div style="${style}">${content}</div>`;
    });
  });

  // 4. [v13.3] 인라인 스타일 주입 (에디터 코드 노출 방지)
  const $ = (await import("cheerio")).load(html, null, false);

  // [v13.0 Hotfix] Q&A 파편화 해결 로직 (Q 문단과 A 문단을 찾아 박스로 통합)
  const paragraphs = $("p").toArray();
  for (let i = 0; i < paragraphs.length; i++) {
    const $p = $(paragraphs[i]);
    const text = $p.text().trim();
    
    if (text.startsWith("Q.")) {
      const $nextP = $(paragraphs[i + 1]);
      const nextText = $nextP.text().trim();
      
      if (nextText.startsWith("A.")) {
        // Q와 A를 담을 프리미엄 박스 생성
        const $qnaBox = $("<div class='qna-box' style='" + boxStyles["qna-box"] + "'></div>");
        $qnaBox.append($p.clone().html(`<strong style="color: #6366f1; font-size: 1.1em;">${text}</strong>`));
        $qnaBox.append($nextP.clone().css({"margin-top": "15px", "color": "#333"}));
        
        // 원본 위치에 박스 삽입 후 기존 문단 삭제
        $p.replaceWith($qnaBox);
        $nextP.remove();
        i++; // A 문단은 처리했으므로 건너뜀
      }
    }
  }
  
  // 본문 요소 (500px 제한)
  $("p, table, .summary-box, .tip-box, .warning-box, .checkpoint, .related-box, .qna-box").each((_, el) => {
    const $el = $(el);
    // [v12.9 Hotfix] 리스트 내부의 p 태그는 중앙 정렬에서 제외
    if ($el.closest("li").length > 0) return;

    const existingStyle = $el.attr("style") || "";
    const isQna = $el.hasClass("qna-box");
    
    $el.attr("style", `max-width: 500px; margin-left: auto; margin-right: auto; text-align: \${isQna ? "left" : "center"}; word-break: keep-all; line-height: 1.8; \${existingStyle}`);
  });

  // Q&A 박스는 별도로 처리 (내부 좌측 정렬, 가운데 배치)
  $(".qna-box").each((_, el) => {
    const $el = $(el);
    const existingStyle = $el.attr("style") || "";
    $el.attr("style", `display: block; max-width: 500px; margin: 25px auto; text-align: left; word-break: keep-all; line-height: 1.8; ${existingStyle}`);
  });

  // 리스트 특수 처리 (블록 단위 중앙 정렬 + 내부 정렬 유지)
  $("ul, ol").each((_, el) => {
    const $el = $(el);
    const existingStyle = $el.attr("style") || "";
    // [v12.7 Hotfix] 리스트 내부 텍스트 좌측 정렬 및 번호/불릿이 잘리지 않도록 padding 조정
    $el.attr("style", `display: table; max-width: 500px; margin: 20px auto; text-align: left; list-style-position: outside; padding-left: 40px; word-break: keep-all; line-height: 1.8; ${existingStyle}`);
    $el.find("li").css({ "margin-bottom": "12px", "text-align": "left" });
    
    // [v12.7 Hotfix] 리스트 뒤에 강제 줄바꿈 삽입하여 다음 요소와의 겹침 방지
    $el.after('<br style="clear: both;">');
  });

  // 소제목 요소 (전체 너비 유지)
  $("h2, h3").each((_, el) => {
    const $el = $(el);
    const existingStyle = $el.attr("style") || "";
    $el.attr("style", `width: 100%; text-align: center; margin-left: 0; margin-right: 0; ${existingStyle}`);
  });

  return `<div class="post-content">${$.html()}</div>`;
}