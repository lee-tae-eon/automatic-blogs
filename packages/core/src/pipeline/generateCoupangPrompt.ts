import { getToneInstruction } from "../tone/tone_config";
import { getPersonaDetail } from "../persona/persona.config";
import { BlogPostInput } from "../types/blog";

/**
 * 쿠팡 파트너스 전용 프롬프트 생성기
 * 제공된 상품 스크래핑 데이터를 기반으로 전문 리뷰어로서의 포스팅을 유도합니다.
 */
export function generateCoupangPrompt(input: BlogPostInput): string {
  // 쿠팡 파트너스는 Rule 2에 따라 persona='experiential', tone='empathetic' 고정
  const personaDetail = getPersonaDetail("experiential");
  const toneInstruction = getToneInstruction("empathetic");

  const scrapedDataContext = input.latestNews 
    ? `\n# 📦 스크래핑된 쿠팡 상품 데이터\n아래 정보를 바탕으로 아주 객관적이면서도 독자에게 공감하는 상품 리뷰를 작성하세요.\n${input.latestNews}\n` 
    : "";

  const imageInstruction = input.extractedImages && input.extractedImages.length > 0
    ? `\n## 🖼️ [CRITICAL] 상품 이미지 삽입 규칙
- 사용 가능한 실제 상품 이미지 URL 목록:
${input.extractedImages.map((url, i) => `  ${i + 1}. ${url}`).join("\n")}
- 본문 중간중간 내용과 어울리는 위치에 위 이미지 중 하나를 **[쿠팡이미지: 이미지URL]** 형식으로 반드시 삽입하세요.
- 예시: [쿠팡이미지: ${input.extractedImages[0]}]
- 이 이미지들은 실제 쿠팡 상세페이지에서 가져온 것이므로, 디자인이나 외관을 설명할 때 함께 배치하면 좋습니다.
`
    : "";

  const styleGuide = `
# 🎭 문체 및 페르소나 가이드

## 🎵 톤: 사용자 입장 / 공감형 (Empathetic)
${toneInstruction}
- 딱딱한 스펙 나열보다는 "내가 직접 돈 주고 사서 써본다면?" 또는 "이런 점이 진짜 불편했는데 이게 해결해주겠네?" 같은 공감 위주의 화법을 구사하세요.

## 🗣️ 역할: 전문 제품 리뷰어 (Experiential)
- **핵심 원칙**: ${personaDetail.principle}
- **🚫 절대 금지**: ${personaDetail.forbidden.join(", ")}

## ✍️ [CRITICAL] 작법 규칙
1. **마이크로 브리딩 (최우선)**: 한 문장이 40~50자를 넘지 않도록 짧게 끊고 가독성을 극대화하세요.
2. **모바일 최적화**: 2~3문장마다 무조건 줄을 바꾸세요(Enter 2번).
3. **리스트 활용**: 스펙이나 장단점을 나열할 때는 반드시 마크다운 리스트(\`-\`)를 사용하세요.
`;

  const mission = `
# 🎯 최종 미션
제공된 쿠팡 상품 데이터를 바탕으로 구매 전환율을 높이면서도 독자에게 신뢰를 주는 "내돈내산 느낌의 프리미엄 상품 리뷰"를 작성하세요.

## ⚠️ [ULTRA CRITICAL] 리뷰 구성 주의사항
1. **도입부**: 왜 이 제품을 알아봐야 하는지, 어떤 고민을 해결해주는지 공감하며 시작하세요.
2. **본론 (장점 및 스펙)**: 제조사가 주장하는 스펙을 독자의 언어로 쉽게 풀어서 설명하세요. (이때 \`[쿠팡이미지: URL]\` 태그를 적절히 1~2개 섞으세요)
3. **본론 (단점 또는 아쉬운 점)**: 무조건 좋다고만 하면 신뢰도가 떨어집니다. 한 가지 통찰력 있는 아쉬운 점이나 "이런 분들에겐 추천하지 않음"을 반드시 명시하세요.
4. **결론 및 총평**: 최종적으로 그래서 살 가치가 있는지 명확히 결론을 내려주세요.
5. **[매우 중요]**: 글의 마지막에 \`[쿠팡링크: 삽입위치]\` 라는 텍스트를 반드시 하나 남기세요. 이 위치에 시스템이 쿠팡 파트너스 배너를 자동으로 달아줍니다. (절대 다른 링크를 임의로 만들지 마세요).
6. **차트 제외**: 쿠팡 리뷰에서는 데이터 차트(\`[차트: {...}]\`)를 사용하지 마세요.

## 📤 출력 형식 (JSON)
\`\`\`json
{
  "title": "클릭하고 싶은, 공감이 가는 리뷰 제목",
  "outline": ["도입부", "주요 특징", "솔직한 단점", "총평"],
  "content": "마크다운 본문 (도입부 + 본론 + [쿠팡이미지: URL] + 결론 + [쿠팡링크: 삽입위치]) — 최소 1500자 이상",
  "metaTitle": "SEO 검색용 제목",
  "metaDescription": "SEO 검색용 설명 (150자 이내)",
  "focusKeywords": ["제품명", "관련 카테고리 검색어"],
  "lsiKeywords": ["연관어1", "연관어2", "연관어3"],
  "references": []
}
\`\`\`
`;

  return `
${scrapedDataContext}
${imageInstruction}
${styleGuide}
${mission}
`.trim();
}
