/**
 * 마크다운을 네이버 블로그 최적화 HTML로 변환합니다.
 * v3.19: 모든 가독성 스타일(행간, 단어끊김방지, 인용구)을 HTML 태그에 직접 주입합니다.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const { unified } = await import("unified");
  const { default: remarkParse } = await import("remark-parse");
  const { default: remarkHtml } = await import("remark-html");
  const { default: remarkGfm } = await import("remark-gfm");

  // 1. Frontmatter 제거
  let content = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");

  // 2. 커스텀 컬러 문법 처리
  content = content
    .replace(/!!(.*?)!!/g, '<span style="color: #e53e3e; font-weight: bold;">$1</span>') // 빨강
    .replace(/\+\+(.*?)\+\+/g, '<span style="color: #16a34a; font-weight: bold;">$1</span>') // 초록
    .replace(/\?\?(.*?)\?\?/g, '<span style="color: #d97706; font-weight: bold;">$1</span>'); // 주황

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(content);
  
  let html = result.toString();

  // 3. [핵심] 가독성 스타일 전역 주입 (Global Style Injection)
  const baseStyle = "line-height: 1.8; word-break: keep-all; margin-bottom: 15px;";
  const headingStyle = "line-height: 1.6; word-break: keep-all; margin-top: 30px; margin-bottom: 15px; font-weight: bold; color: #333;";
  const blockquoteStyle = "border-left: 4px solid #666; padding-left: 15px; margin: 30px 0; color: #555; font-style: italic; background-color: transparent;";

  html = html
    .replace(/<p>/g, `<p style="${baseStyle}">`)
    .replace(/<h1>/g, `<h1 style="${headingStyle} font-size: 1.6rem;">`)
    .replace(/<h2>/g, `<h2 style="${headingStyle} font-size: 1.4rem;">`)
    .replace(/<h3>/g, `<h3 style="${headingStyle} font-size: 1.2rem;">`)
    .replace(/<blockquote[^>]*>/g, `<blockquote style="${blockquoteStyle}">`) // 정규식 강화
    .replace(/<strong>/g, '<strong style="font-weight: bold;">')
    .replace(/<ul>/g, '<ul style="list-style-type: disc; margin-left: 20px; margin-bottom: 15px;">')
        .replace(/<li>/g, `<li style="${baseStyle} margin-bottom: 5px;">`);
    
      // 4. [v3.23] 전체 본문 컨테이너 스타일 적용 (Post-Content Wrapper)
      const containerStyle = "max-width: 720px; margin: 0 auto; padding: 0 20px; line-height: 1.8; word-break: keep-all;";
      
      return `<div class="post-content" style="${containerStyle}">${html}</div>`;
    }
    