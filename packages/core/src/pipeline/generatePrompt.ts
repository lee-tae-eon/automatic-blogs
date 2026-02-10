import { getToneInstruction, TONE_CONFIG } from "../tone/tone_config";
import { getPersonaDetail } from "../persona/persona.config";
import { getPersonaExamples } from "../persona/persona.example";
import { getQualityMetrics, SEO_RULES } from "../persona/quality-metrics";
import { BlogPostInput } from "../types/blog";
import { inferTargetAudience, inferContentGoal } from "../util/autoInference";

/**
 * [v3.33] 모바일 가독성(호흡) 및 테이블 규격 강제화 프롬프트 엔진
 */
export function generateBlogPrompt(input: BlogPostInput): string {
  const persona = input.persona;
  const tone = input.tone;

  // 1. 설정값 가져오기
  const toneInstruction = getToneInstruction(tone);
  const personaDetail = getPersonaDetail(persona);
  const examples = getPersonaExamples(persona);
  const metrics = getQualityMetrics(persona);

  const targetAudience = inferTargetAudience(input.topic, persona);
  const contentGoal = inferContentGoal(persona);

  // 2. 뉴스 데이터 지침
  let newsInstruction = "";
  if (input.latestNews) {
    newsInstruction = `
# 📰 실시간 정보 (Source Material)
아래 정보를 바탕으로 글을 작성하되, **반드시 한국어로 자연스럽게 번역/가공**하세요.
- **🚨 절대 금지**: 문장 끝에 \`(출처)\`, \`[1]\` 등을 붙이지 마세요. 본문에 녹여내세요.
${input.latestNews}
`;
  }

  // 3. 리스트 감지 로직
  const listPriorityInstruction = input.topic.includes("리스트")
    ? `
## 📋 [CRITICAL] 리스트 중심 구성 (Listicle Structure)
- 주제 특성상 서술형보다는 **불렛 포인트(Bullet Points)** 위주로 작성해야 합니다.
- 정보의 계층(Depth)을 명확히 하세요. (예: 항목 > 특징 > 혜택)
`
    : "";

  // ✅ 4. [NEW] 모바일 가독성 절대 규칙 (Mobile Breathing Rule)
  // AI가 문단을 통으로 뱉는 것을 방지하기 위한 강력한 제약 조건
  const mobileReadability = `
## 📱 [CRITICAL] 모바일 가독성 절대 규칙 (Mobile First Writing)
이 글은 100% 모바일 사용자가 읽습니다. **"벽돌 같은 텍스트(Wall of Text)"는 즉시 이탈을 부릅니다.** 아래 규칙을 어길 시 글 생성을 실패로 간주합니다.

1.  **호흡 끊기 (Chunking)**:
    - 절대로 4문장 이상을 한 문단에 이어 쓰지 마세요.
    - **2~3문장(최대 150자)**이 모이면 무조건 줄을 바꾸세요(Line Break).
    - 문단 사이에는 반드시 **빈 줄(Enter 2번)**을 넣어 시각적 여백을 확보하세요.
2.  **시각적 리듬**:
    - 독자가 스크롤을 멈추지 않도록 짧고 간결한 문장을 사용하세요.
    - 접속사(그리고, 하지만 등)로 문장을 길게 늘이지 말고, 단문으로 끊으세요.
`;

  // ✅ 5. 테이블 모바일 최적화 절대 규칙
  const tableRule = `
## 📊 [CRITICAL] 표(Table) 작성 절대 규칙 (Mobile First)
모바일 화면 폭(360px)을 고려하여 아래 규칙을 엄수하세요.

1.  **생성 여부**: ${metrics.tableRequired ? "**반드시 1개 이상 포함**" : "내용 비교/요약이 필요할 때만 사용"}
2.  **컬럼(열) 제한**: **최대 3열(Column)**까지만 허용합니다. (4열 이상 금지)
3.  **텍스트 제한**: 각 셀(Cell)은 **최대 15자 이내의 '핵심 키워드'**로만 채우세요.
    - ❌ 나쁜 예: "이 제품은 배터리가 오래 가서 좋습니다." (서술형 절대 금지)
    - ⭕ 좋은 예: "배터리 효율 우수" (단답형)
4.  **목적**: 독자가 1초 만에 훑어볼 수 있는 **요약/비교용**으로만 사용하세요.
`;

  // 6. 톤앤매너 & 페르소나 가이드
  const styleGuide = `
# 🎭 문체 및 화법 가이드 (Voice & Tone)

## 🎵 1. 기본 톤(Tone) 설정: [${tone.toUpperCase()}]
${toneInstruction}
(위 톤 설정에 정의된 '종결어미'와 '피해야 할 표현'을 1순위로 준수하세요.)

## 🗣️ 2. 페르소나 역할: [${personaDetail.role}]
당신은 **${personaDetail.role}**입니다. 기본 톤을 유지하되, 아래 화법을 섞으세요.

### ✅ 권장 문장 (Persona Examples)
${examples.goodSentences.map((s) => `- "${s}"`).join("\n")}

### 🔗 자연스러운 연결어
${examples.transitions.map((s) => `- "${s}..."`).join("\n")}
`.trim();

  // 7. 품질 및 구조 가이드 (위에서 정의한 규칙 통합)
  const qualityGuide = `
# 📏 품질 및 구조 가이드라인 (Structure Rules)
- **목표 글자 수**: ${metrics.targetLength[0]} ~ ${metrics.targetLength[1]}자
- **소제목 개수**: 정확히 ${metrics.headingCount}개
${mobileReadability}
${tableRule}
- **이모지 사용**: **${metrics.emojiUsage}** 모드
- **이미지**: 본문에 이미지 태그 절대 금지
`.trim();

  // 8. SEO 규칙
  const seoGuide = `
# 🔍 SEO 최적화 (Technical Rules)
- **메타 제목**: ${SEO_RULES.metaTitleLength[0]}~${SEO_RULES.metaTitleLength[1]}자
- **메타 설명**: ${SEO_RULES.metaDescriptionLength[0]}~${SEO_RULES.metaDescriptionLength[1]}자
- **키워드 배치**: 포커스 키워드 "${input.keywords?.join(", ") || input.topic}"를 3~5회 자연스럽게 포함
`.trim();

  const mission = `
# 🎯 최종 미션
주제 **"${input.topic}"**에 대해 위 규칙들을 완벽히 결합하여 블로그 포스팅을 작성하세요.

## 👥 타겟 독자
- **독자**: ${targetAudience}
- **목표**: ${contentGoal}

## 📤 출력 형식 (JSON Only)
\`\`\`json
{
  "title": "클릭을 부르는 매력적인 제목",
  "outline": ["소제목1", "소제목2", ...],
  "content": "마크다운 본문 내용...",
  "metaTitle": "SEO 메타 제목",
  "metaDescription": "SEO 메타 설명",
  "focusKeywords": ["키워드1", "키워드2"],
  "references": [{"name": "매체명", "url": "..."}]
}
\`\`\`
`.trim();

  return `
${newsInstruction}
${styleGuide}
${qualityGuide}
${seoGuide}
${listPriorityInstruction}
${mission}
`.trim();
}
