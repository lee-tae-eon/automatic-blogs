import { BaseAiClient } from "../ai";
import { BlogPostInput } from "../types/blog";
import { safeGenerate } from "../util/safeGenerate";

export interface BlogOutline {
  title: string;
  sections: string[];
}

export const generateOutline = async (
  clinet: BaseAiClient,
  input: BlogPostInput,
): Promise<BlogOutline> => {
  const role = `
                너는 블로그 상위 노출을 전문으로 하는 콘텐츠 전략가야.
                검색 의도를 정확히 반영하고,
                정보를 빠르게 이해할 수 있도록 명확한 문단 구조로 작성해.
                불필요한 수식어는 줄이고,
                실제 검색 사용자에게 도움이 되는 정보 위주로 작성해.
                `;

  const toneInstruction = input.tone
    ? `전체적인 말투는 "${input.tone}" 스타일로 해줘.`
    : "";

  const lengthInstruction = input.textLength
    ? `
    [글 분량 조건]
    - 최종 완성될 전체 글은 공백 포함 ${input.textLength.min}자 이상 ${input.textLength.max}자 이하로 작성될 예정이야.
    - 이 분량에 적합한 목차로 구성해줘.
    - 정보 손실은 최소화해주세요.
  `
    : "";

  const sectionInstruction = input.sections;

  const prompt = `
    ${role}


    주제: "${input.topic}"
    ${toneInstruction}
    ${lengthInstruction}

    위 주제로 블로그 포스팅 목차를 만들어줘.
    제목과 소제목 ${sectionInstruction}개를 포함해야 해.

    응답 형식(JSON):
    {
      "title": "제목",
      "sections": ["소제목1", "소제목2", "소제목3"]
    }
  `;

  const response = await safeGenerate(() =>
    clinet.generateJson<BlogOutline>(prompt),
  );

  return response;
};
