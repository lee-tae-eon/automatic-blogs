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

  const lengthInstruction = input.textLength
    ? `
    [글 분량 조건]
    - 최종 완성될 전체 글은 공백 포함 ${input.textLength.min}자 이상 ${input.textLength.max}자 이하로 작성될 예정이야.
    - 이 분량에 적합한 목차로 구성해줘.
  `
    : "";

  const prompt = `
    주제: "${input.topic}"
    ${toneInstruction}
    ${lengthInstruction}

    위 주제로 블로그 포스팅 목차를 만들어줘.
    제목과 소제목 5개를 포함해야 해.

    응답 형식(JSON):
    {
      "title": "제목",
      "sections": ["소제목1", "소제목2", "소제목3"]
    }
  `;

  return await clinet.generateJson<BlogOutline>(prompt);
};
