import { BaseAiClient } from "../ai/types";
import { BlogPostInput } from "../types/blog";
import { delay } from "../util/delay";
import { BLOG_PRESET } from "../util/platform";
import { safeGenerate } from "../util/safeGenerate";
import { BlogOutline } from "./generateOutline";

export const generateArticle = async (
  client: BaseAiClient,
  input: BlogPostInput,
  outline: BlogOutline,
): Promise<string> => {
  let fullContent = "";
  const preset = BLOG_PRESET[input.platform];

  const toneInstruction = preset.tone
    ? `말투는 "${preset.tone}" 스타일로 작성해줘.`
    : "";

  // 각 소제목을 순회하며 본문 생성
  for (const section of outline.sections) {
    const prompt = `
      전체 주제: "${outline.title}"
      현재 소제목: "${section}"
      ${toneInstruction}



      이 소제목에 대한 상세 본문 내용을 작성해줘.
      본문 내용은 ${preset.textLength.min / 3} 이내로 작성해줘.
      독자가 읽기 편하게 적절한 줄바꿈을 포함하고, 정보를 구체적으로 전달해줘.
    `;

    const sectionContent = await safeGenerate(() =>
      client.generateText(prompt),
    );

    // 마크다운 형식으로 본문을 조립
    fullContent += `## ${section}\n\n${sectionContent}\n\n`;

    await delay(2000);
  }

  console.log(fullContent.length, "fullContent.length");

  return fullContent;
};
