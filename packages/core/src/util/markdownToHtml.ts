export async function markdownToHtml(markdown: string): Promise<string> {
  // 동적 임포트를 사용하여 ESM 전용 라이브러리를 로드합니다.
  const { unified } = await import("unified");
  const { default: remarkParse } = await import("remark-parse");
  const { default: remarkHtml } = await import("remark-html");
  const { default: remarkGfm } = await import("remark-gfm");

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml)
    .process(markdown);
  return result.toString();
}
