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
    "checkpoint": "background-color: #f8f9fa; border-left: 5px solid #03c75a; padding: 15px 20px; margin: 20px 0; font-style: italic;"
  };

  Object.entries(boxStyles).forEach(([className, style]) => {
    const regex = new RegExp(`<div class="${className}">([\\s\\S]*?)<\\/div>`, "gi");
    html = html.replace(regex, (match, content) => {
      return `<div style="${style}">${content}</div>`;
    });
  });

  // 4. [중요] 불필요한 인라인 스타일 제거 (기타 요소들은 유지)

  // 컨테이너도 스타일 없이 깔끔하게
  return `<div class="post-content">${html}</div>`;
}