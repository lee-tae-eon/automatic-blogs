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
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(content);
  
  let html = result.toString();

  // 3. 컬러 문법 후처리 (강조용으로 이것만 남김)
  // !!빨강!!, ++초록++, ??주황??
  html = html
    .replace(/!!\s*(.*?)\s*!!/g, '<span style="color: #e53e3e; font-weight: bold;">$1</span>')
    .replace(/\+\+\s*(.*?)\s*\+\+/g, '<span style="color: #16a34a; font-weight: bold;">$1</span>')
    .replace(/\?\?\s*(.*?)\s*\?\?/g, '<span style="color: #d97706; font-weight: bold;">$1</span>');

  // 4. [중요] 불필요한 인라인 스타일 제거
  // 네이버 에디터는 외부 스타일을 대부분 무시하거나, 오히려 꼬이게 만듭니다.
  // 순수한 태그만 남겨서 에디터가 알아서 렌더링하게 둡니다.

  // 컨테이너도 스타일 없이 깔끔하게
  return `<div class="post-content">${html}</div>`;
}