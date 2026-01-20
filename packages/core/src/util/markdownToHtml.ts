export async function markdownToHtml(markdown: string): Promise<string> {
  // 동적 임포트를 사용하여 ESM 전용 라이브러리를 로드합니다.
  const { unified } = await import("unified");
  const { default: remarkParse } = await import("remark-parse");
  const { default: remarkHtml } = await import("remark-html");
  const { default: remarkGfm } = await import("remark-gfm");

  // Frontmatter(메타데이터) 제거: --- 로 감싸진 상단 블록을 제거하여 본문에 노출되지 않도록 함
  const content = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml)
    .process(content);
  return result.toString();
}
