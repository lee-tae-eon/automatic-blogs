import { getToneInstruction, TONE_CONFIG } from "../tone/tone_config";
import { getPersonaDetail } from "../persona/persona.config";
import { getPersonaExamples } from "../persona/persona.example";
import { getQualityMetrics, SEO_RULES } from "../persona/quality-metrics";
import { BlogPostInput } from "../types/blog";
import {
  inferTargetAudience,
  inferContentGoal,
  analyzeTopicIntent,
} from "../util/autoInference";

/**
 * [v3.26] 최신성 및 규정 준수 강화 프롬프트 엔진
 */
export function generateBlogPrompt(input: BlogPostInput): string {
  const persona = input.persona;
  const tone = input.tone;
  const toneConfig = TONE_CONFIG[tone];
  const toneInstruction = getToneInstruction(tone);

  const targetAudience = inferTargetAudience(input.topic, persona);
  const contentGoal = inferContentGoal(persona);

  // 1. 뉴스 데이터 지침 (언어 고정 및 출처 금지)
  let newsInstruction = "";
  if (input.latestNews) {
    newsInstruction = `
# 📰 실시간 정보 (반드시 한국어로 번역하여 반영)
- 제공된 정보가 영어라도 **반드시 자연스러운 한국어로만** 작성하세요.
- **🚨 본문 내 출처 표기 절대 금지**: 문장 끝에 \`(매체명)\`, \`[1]\`, \`(Source)\` 등을 붙이는 행위를 절대 금지합니다. 발견 시 즉시 탈락입니다.
- 정보는 글의 흐름에 자연스럽게 녹여내고, 링크는 references 필드에만 담으세요.
${input.latestNews}
`;
  }

  const personaDetail = getPersonaDetail(persona);
  const examples = getPersonaExamples(persona);
  const metrics = getQualityMetrics(persona);

  const systemRole = `
# 🎭 역할 정의
당신은 **${personaDetail.role}**입니다. 
- 모든 내용은 **한국어**로만 작성하며, 외국어 원문이 들어오더라도 완벽하게 번역하여 소화하세요.
- **정체 숨기기**: AI임을 밝히지 말고 사람 블로거처럼 자연스럽게 쓰세요.
- **톤&매너**: ${toneInstruction}
`.trim();

  const layoutRules = `
# 🎨 레이아웃 및 포맷 (절대 준수)

## 📱 세만틱 SEO 및 전문성 강화
검색 엔진이 이 글을 '전문 지식 문서'로 인식하도록 다음 키워드들을 본문에 자연스럽게 녹여내세요.
- **연관 키워드**: ${input.keywords?.join(", ") || input.topic}
- **지침**: 키워드를 단순히 나열하지 말고, 각 용어의 맥락과 의미를 설명하며 전문적인 통찰을 제공하세요.

## 📱 모바일 가독성 및 문단 구성
- **문단 제한**: 한 문단은 **2~3문장**으로 구성하세요. 
- **빈 줄 삽입**: 문단이 끝나면 반드시 **빈 줄(Enter 2번)**을 넣어 여백을 확보하세요.
- **섹션 밀도 (중요)**: 각 소제목 아래에는 **반드시 2개 이상의 문단**을 작성하여 정보를 풍성하게 담으세요. (소제목 하나당 최소 4~6문장 이상 필수)

## 📌 소제목 및 시각 요소
- **소제목**: 본론 소제목은 **3~5개**를 사용하며, \`\\n\\n> ## 소제목\` 형식을 지키세요.
- **이미지 금지**: 본문에 어떠한 이미지 관련 태그(\`![...]\` 또는 \`[이미지:...]\`)도 포함하지 마세요.
- **컬러링**: !!(빨강), ++(초록), ??(주황) 문법을 적극 활용하세요.
`.trim();

  const mission = `
# 🎯 작성 미션
"${input.topic}" 주제로 포스트를 작성하세요.
- **언어**: 100% 한국어 (영어 혼용 금지)
- **밀도**: 소제목 하나당 최소 2개의 알찬 문단 배치

## ✅ 최종 체크리스트 (하나라도 어길 시 실패)
- [ ] 본문에 \`(매체명)\` 또는 \`[뉴스]\` 같은 찌꺼기가 없는가?
- [ ] 모든 소제목 아래에 **최소 2개 이상의 문단**이 있는가?
- [ ] 각 문단은 2~3문장 이내이며 빈 줄이 충분한가?
- [ ] 영어가 섞여 있지 않고 완벽한 한국어인가?
- [ ] 이미지 태그가 하나도 없는가?

## 📤 출력 형식 (순수 JSON)
\`\`\`json
{
  "title": "제목",
  "outline": ["소제목1", "소제목2", "소제목3"],
  "content": "본론 내용 (마크다운)",
  "metaTitle": "SEO 제목",
  "metaDescription": "SEO 설명",
  "focusKeywords": ["키워드1", "키워드2"],
  "references": [
     {"name": "뉴스 제목 (매체명)", "url": "URL"}
  ]
}
\`\`\`
`.trim();

  return `
${newsInstruction}
${systemRole}
${layoutRules}
${mission}
`.trim();
}
