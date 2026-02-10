/**
 * 마크다운을 네이버 블로그 최적화 HTML로 변환합니다.
 * v3.32: 컬러 문법 처리를 후처리(Post-processing)로 변경하여 안정성을 극대화합니다.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const { unified } = await import("unified");
  const { default: remarkParse } = await import("remark-parse");
  const { default: remarkHtml } = await import("remark-html");
  const { default: remarkGfm } = await import("remark-gfm");

  // 1. Frontmatter 제거
  let content = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");

  // 2. 마크다운 -> HTML 변환 (컬러 처리는 여기서 하지 않음)
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(content);
  
  let html = result.toString();

  // 3. [v3.32 핵심] HTML 결과물에 대한 컬러 문법 후처리
  // 텍스트와 HTML 태그가 섞인 상태에서도 정확히 기호만 찾아 치환합니다.
  html = html
    .replace(/!!\s*(.*?)\s*!!/g, '<span style="color: #e53e3e; font-weight: bold;">$1</span>') // 빨강
    .replace(/\+\+\s*(.*?)\s*\+\+/g, '<span style="color: #16a34a; font-weight: bold;">$1</span>') // 초록
    .replace(/\?\?\s*(.*?)\s*\?\?/g, '<span style="color: #d97706; font-weight: bold;">$1</span>'); // 주황

  // 4. 네이버 에디터 가독성 스타일 보정
  const baseStyle = "line-height: 1.8; word-break: keep-all; margin-bottom: 15px;";
  const headingStyle = "line-height: 1.6; word-break: keep-all; margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;";
  const blockquoteStyle = "border-left: 4px solid #666; padding-left: 15px; margin: 25px 0; color: #555; font-style: italic; background-color: transparent;";

  html = html
    .replace(/<p>/g, `<p style="${baseStyle}">`)
    .replace(/<h1>/g, `<h1 style="${headingStyle} font-size: 1.6rem;">`)
    .replace(/<h2>/g, `<h2 style="${headingStyle} font-size: 1.4rem;">`)
    .replace(/<h3>/g, `<h3 style="${headingStyle} font-size: 1.2rem;">`)
    .replace(/<blockquote[^>]*>/g, `<blockquote style="${blockquoteStyle}">`)
    .replace(/<strong>/g, '<strong style="font-weight: bold;">')
    .replace(/<ul>/g, '<ul style="list-style-type: disc; margin-left: 20px; margin-bottom: 15px;">')
    .replace(/<li>/g, `<li style="${baseStyle} margin-bottom: 5px;">`);

  const containerStyle = "max-width: 720px; margin: 0 auto; padding: 0 20px; line-height: 1.8; word-break: keep-all;";
  return `<div class="post-content" style="${containerStyle}">${html}</div>`;
}