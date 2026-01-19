import { BaseAiClient } from "../ai";
import { BlogPostInput, AiGeneratedPost } from "../types/blog";
import { safeGenerate } from "../util/safeGenerate";

export const generatePostSingleCall = async (
  client: BaseAiClient,
  input: BlogPostInput,
): Promise<AiGeneratedPost> => {
  const role = `
너는 블로그 상위 노출을 전문으로 하는 콘텐츠 전략가다.
검색 의도를 정확히 반영하고,
불필요한 수식어는 줄이며,
실제 검색 사용자에게 도움이 되는 정보만 작성한다.
`;

  const toneInstruction = input.tone
    ? `말투는 "${input.tone}" 스타일로 작성한다.`
    : "";

  const lengthInstruction = input.textLength
    ? `
[글 분량 조건]
- 최종 결과물은 공백 포함 ${input.textLength.min}자 이상 ${input.textLength.max}자 이하로 작성한다.
- 이 조건은 반드시 지킨다.
`
    : "";

  const sectionInstruction = input.sections
    ? `소제목 개수는 정확히 ${input.sections}개로 구성한다.`
    : "";

  const prompt = `
${role}

[주제]
"${input.topic}"

${toneInstruction}
${lengthInstruction}
${sectionInstruction}

[작성 규칙]
- 전체 글 기준으로 분량을 균등하게 배분한다.
- 중복되는 내용은 작성하지 않는다.
- 과도한 서론/결론은 피한다.

[출력 형식(JSON)]
**중요: 마크다운 코드 블록(\`\`\`json)을 절대 사용하지 마시오. 오직 JSON 문자열만 출력하시오.**
{
  "title": "제목",
  "outline": ["소제목1", "소제목2", "소제목3"],
  "content": "마크다운 형식의 전체 본문"
}
`;

  const response = await safeGenerate(() =>
    client.generateJson<AiGeneratedPost>(prompt),
  );

  return response;
};
