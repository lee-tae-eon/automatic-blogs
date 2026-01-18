import fs from "fs";
import path from "path";
import { markdownToHtml } from "@blog-automation/core"; // core에서 가져옴

export async function processPublish(mdFilePath: string) {
  // 1. 저장된 마크다운 파일 읽기
  const markdown = fs.readFileSync(mdFilePath, "utf-8");

  // 2. HTML로 변환 (core 로직 사용)
  console.log("🔄 마크다운을 HTML로 변환 중...");
  const htmlContent = await markdownToHtml(markdown);

  // 3. (선택 사항) 결과 확인을 위해 임시 HTML 파일로 저장해보기
  const htmlPath = mdFilePath.replace(".md", ".html");
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`✅ HTML 변환 완료: ${htmlPath}`);

  return htmlContent;
}
