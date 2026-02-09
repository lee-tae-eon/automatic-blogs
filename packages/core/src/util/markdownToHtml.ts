export async function markdownToHtml(markdown: string): Promise<string> {
  // 동적 임포트를 사용하여 ESM 전용 라이브러리를 로드합니다.
  const { unified } = await import("unified");
  const { default: remarkParse } = await import("remark-parse");
  const { default: remarkHtml } = await import("remark-html");
  const { default: remarkGfm } = await import("remark-gfm");

  // 1. Frontmatter 제거
  let content = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");

  // 2. [v3.7] 커스텀 컬러 문법 전처리 (Pre-processing)
  // AI가 생성한 특수 기호(!!, ++, ??)를 임시 토큰으로 변환 (remark가 깨지 않도록)
  // 여기서는 HTML 태그를 직접 심는 대신, 변환 후 후처리 단계에서 치환하는 것이 더 안전할 수 있음.
  // 하지만 remark-html은 기본적으로 HTML을 허용하므로 직접 치환 시도.
  content = content
    .replace(/!!(.*?)!!/g, '<span style="color: #e53e3e; font-weight: bold;">$1</span>') // 빨강
    .replace(/\+\+(.*?)\+\+/g, '<span style="color: #16a34a; font-weight: bold;">$1</span>') // 초록
    .replace(/\?\?(.*?)\?\?/g, '<span style="color: #d97706; font-weight: bold;">$1</span>'); // 주황

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false }) // HTML 태그 허용
    .process(content);
  
  let html = result.toString();

  // 3. 네이버 에디터 호환성 후처리 (Post-processing)
  // <strong> 태그 스타일 명시
  html = html.replace(/<strong>/g, '<strong style="font-weight: bold;">');
  
  // 리스트 스타일 보정
  html = html.replace(/<ul>/g, '<ul style="list-style-type: disc; margin-left: 20px;">');
  html = html.replace(/<ol>/g, '<ol style="list-style-type: decimal; margin-left: 20px;">');

  return html;
}
