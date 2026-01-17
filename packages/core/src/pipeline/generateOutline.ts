import { BaseAiClient } from "../ai";
import { BlogPostInput } from "../types/blog";

export interface BlogOutline {
  title: string;
  sections: string[];
}

export const generateOutline = async (
  clinet: BaseAiClient,
  input: BlogPostInput
): Promise<BlogOutline> => {
  const toneInstruction = input.tone
    ? `전체적인 말투는 "${input.tone}" 스타일로 해줘.`
    : "";

  const prompt = `
    주제: "${input.topic}"
    ${toneInstruction}

    위 주제로 블로그 포스팅 목차를 만들어줘.
    제목과 소제목 5개를 포함해야 해.

    응답 형식(JSON):
    {
      "title": "제목",
      "sections": ["소제목1", "소제목2", "소제목3", "소제목4", "소제목5"]
    }
  `;

  return await clinet.generateJson<BlogOutline>(prompt);
};
