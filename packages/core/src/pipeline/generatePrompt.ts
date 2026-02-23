import { getToneInstruction } from "../tone/tone_config";
import { getPersonaDetail } from "../persona/persona.config";
import { getPersonaExamples } from "../persona/persona.example";
import { getQualityMetrics, SEO_RULES } from "../persona/quality-metrics";
import { BlogPostInput } from "../types/blog";
import { inferTargetAudience, inferContentGoal } from "../util/autoInference";

/**
 * [v4.2] 자연스러운 흐름 + 구체적 예시 주입 엔진
 */
export function generateBlogPrompt(input: BlogPostInput): string {
  const persona = input.persona;
  const tone = input.tone;

  const toneInstruction = getToneInstruction(tone);
  const personaDetail = getPersonaDetail(persona);
  const examples = getPersonaExamples(persona);
  const metrics = getQualityMetrics(persona);

  const targetAudience = inferTargetAudience(input.topic, persona);
  const contentGoal = inferContentGoal(persona);

  // 1. 실시간 정보 지침
  let newsInstruction = "";
  if (input.latestNews) {
    newsInstruction = `
# 📰 실시간 정보 (Source Material)
아래 정보를 바탕으로 글을 작성하되, **반드시 한국어로 자연스럽게 가공**하세요.
- **절대 금지**: 본문 내에 \`(출처)\`, \`[1]\` 등 마커를 붙이지 마세요. 자연스럽게 녹여내세요.
${input.latestNews}
`;
  }

  // 2. 문체 및 페르소나 가이드 (예시 주입)
  const styleGuide = `
# 🎭 문체 및 페르소나 가이드 (Voice & Tone)

## 🎵 톤 설정: ${tone}
${toneInstruction}

## 🗣️ 페르소나: ${personaDetail.role}
- **핵심 원칙**: ${personaDetail.principle}
- **🚫 절대 금지**: ${personaDetail.forbidden.join(", ")}

## ✅ 작문 스타일 및 모범 사례 (Style Examples)
글을 쓸 때 아래 예시의 느낌과 리듬을 반드시 반영하세요:
${examples.goodSentences.map(s => `- "${s}"`).join('\n')}
${examples.transitions.length > 0 ? `\n**자연스러운 연결 방식**:\n${examples.transitions.map(t => `- "${t}..."`).join('\n')}` : ''}

## ✍️ [CRITICAL] 작법 규칙 (Anti-Machine)
1. **마이크로 브리딩 (Micro-Breathing) [ULTRA CRITICAL]**: 한 문장이 **40~50자**를 넘지 않도록 짧게 끊으세요. 길어질 경우 반드시 **쉼표(,) 뒤에서 줄바꿈(\n)**을 하여 시각적 리듬을 조절하세요. (종결 어미가 다음 줄로 툭 떨어지는 현상 방지)
2. **문맥 기반 어미 변화**: 상황에 따라 어미를 변화시키세요. (보고: ~입니다 / 생동감: ~죠 / 강조: ~인 셈입니다)
3. **리듬감**: 문장의 길이를 짧게, 길게, 아주 짧게 섞어서 리듬감을 만드세요.
4. **패턴 파괴**: 어떤 종결 어미든 **3번 이상 연속으로 같은 계열을 쓰면 실패**입니다.
5. **단어 보존**: 단어 중간이나 고유명사 내부에 불필요한 공백이나 줄바꿈을 넣지 마세요.
${personaDetail.writingTips ? personaDetail.writingTips.map(tip => `- ${tip}`).join('\n') : ''}
`;

  // 3. 구조 가이드
  const structureGuide = `
# 📑 구조 및 가독성 가이드

${input.useImage !== false ? `
## 🖼️ [CRITICAL] 이미지 삽입 규칙
- 본문 중간에 관련성 높은 이미지가 들어갈 위치를 선정하여 **[이미지: 검색 키워드]** 형식으로 태그를 삽입하세요.
- **최대 2개**의 이미지만 삽입해야 합니다.
- 키워드는 구체적인 사물이나 장소여야 합니다. (예: [이미지: 청년도약계좌 상담 창구])
` : ""}

## 🏗️ [CRITICAL] 글의 전개 구조 (Persona Structure)
당신은 **${personaDetail.role}**입니다. 반드시 아래 구조에 맞춰 글을 전개하세요:
${personaDetail.structure.map((step) => `- ${step}`).join("\n")}

**각 섹션(소제목) 작성 가이드**:
1. **도입 소문단**: 핵심 주장 제시 (2~3문장)
2. **본론 소문단**: 구체적 근거/예시/데이터 (2~3문장)
3. **시각화**: 필요시 리스트나 표 활용
4. **마무리**: 다음 섹션 연결

## 📱 [CRITICAL] 모바일 가독성 (Mobile Breathing)
- **소문단 단위**: 2~3문장마다 무조건 줄을 바꾸세요(Enter 2번).
- **시각적 여백**: 문단 사이 빈 줄을 통해 독자가 숨 쉴 공간을 만드세요.

## 📊 데이터 시각화 및 구조화 (List, Table & Chart)
- **리스트 최우선**: 정보형 콘텐츠에서는 서술형 문단보다 **마크다운 리스트(\`-\`)**를 최우선으로 사용하세요. 3개 이상의 항목 나열 시 반드시 리스트를 사용해야 합니다.
- **차트 삽입**: 수치 데이터(비교, 통계 등)가 포함된 경우 반드시 **[차트: {JSON 데이터}]** 태그를 삽입하세요.
  - 유형 가이드: \`bar\`(세로 비교), \`horizontalBar\`(가로 순위), \`pie\`/\`doughnut\`(비율), \`line\`(추세)
  - 형식: { "type": "bar" | "horizontalBar" | "pie" | "doughnut" | "line", "title": "제목", "labels": ["항목1", "항목2"], "data": [수치1, 수치2] }
  - **[CRITICAL]**: 차트 태그 바로 앞뒤에 텍스트를 붙여 쓰지 말고, 독립적인 문단으로 배치하세요.
- **표(Table) 활용**: 상세 데이터는 최대 3열 이내의 표로 작성하세요.

## 📌 [v5.1] 핵심 체크포인트 (Post-it Style)
글의 중간이나 마지막에 독자가 반드시 기억해야 할 핵심 요약이나 팁을 **하나** 작성하세요.
- **형식**: 반드시 \`<div class="checkpoint">내용</div>\` 태그로 감싸야 합니다.
- **내용**: 3~4줄 정도의 짧고 강렬한 문장으로 구성하며, 가독성을 위해 문장 사이에 **반드시 \`<br>\` 태그를 넣어 줄바꿈**을 수행하세요.
- **스타일**: 제목 부분은 **\`[핵심 체크 포인트]\`**와 같이 볼드로 강조하고, 이후 내용을 리스트 형태나 간결한 문체로 작성하세요.

## ✨ 시각적 강조 및 컬러링
- **굵게 (Bold)**: 문맥상 가장 중요한 단어만 처리하세요 (한 문장에 최대 2단어).
- **데이터 강조 문법**: 핵심 수치/날짜(++파스텔 파랑++)를 사용하여 시각적 포인트를 만드세요.
- **[CRITICAL] 강조 규칙**: 
  1. **팩트 중심**: '심각한', '중요한' 같은 형용사가 아닌 **정확한 수치나 날짜**에만 사용하세요.
  2. **빈도 제한**: 포스팅 전체에서 **최대 2회**만 사용하세요.
  3. **단어 단위**: 한 번에 **5자 이내**로 적용하며, 다른 기호와 중첩하지 마세요.
`;

  // 4. 최종 미션
  const mission = `
# 🎯 최종 미션
주제 **${input.topic}**에 대해 위 모든 규칙을 결합하여 최고의 블로그 포스팅을 작성하세요.

## ⚠️ [ULTRA CRITICAL] 본문 구성 주의사항
- **블로그/카페 배제**: 블로그, 카페, 커뮤니티 글은 정보원으로 사용하지 마세요. 오직 공식 정보만 신뢰하세요.
- **본문 내 출처 기재 금지**: 본문 내에 \`(매체명)\`, \`[1]\` 등 어떠한 출처 마커도 붙이지 마세요. 출처는 오직 JSON의 \`references\` 필드에만 포함합니다.
- **자기소개 금지**: "안녕하세요, 리포터입니다" 등 정체를 밝히는 행위를 절대 금지합니다.
- **도입부 필수**: 제목 없이 바로 소제목으로 시작하지 마세요. 배경을 설명하는 도입 문단을 먼저 작성하세요.
- **제목 중복 금지**: content 필드 내부에 제목(\`# 제목\`)을 다시 쓰지 마세요.
- **메타 정보 금지**: 아웃라인, 태그 등을 본문에 텍스트로 포함하지 마세요.

## 👥 타겟 및 목표
- **독자**: ${targetAudience}
- **목표**: ${contentGoal}

## 📤 출력 형식 (JSON)
\`\`\`json
{
  "title": "클릭을 부르는 제목",
  "outline": ["소제목1", "소제목2", "소제목3", "소제목4", "소제목5"],
  "content": "마크다운 본문 (도입부 + 소제목 + 본론 + 결론 + 참고자료)",
  "metaTitle": "SEO 제목",
  "metaDescription": "SEO 설명",
  "focusKeywords": ["키워드1", "키워드2"],
  "references": [{"name": "뉴스 제목 (매체명)", "url": "URL"}]
}
\`\`\`
`;

  return `
${newsInstruction}
${styleGuide}
${structureGuide}
${mission}
`.trim();
}