import { BlogPostInput, AutoPilotStrategy } from "../types/blog";
import { analyzeTopicIntent } from "../util/autoInference";

/**
 * [v3.14] Auto-Pilot 전용 프롬프트 생성기
 * - 안전 가이드라인(Safety) 통합
 * - 경쟁사 분석 기반의 전략적 글쓰기
 */
export function generateAutoPilotPrompt(input: BlogPostInput): string {
  const strategy = input.strategy as AutoPilotStrategy;
  if (!strategy) {
    throw new Error("Auto-Pilot 모드이나 전략 데이터가 누락되었습니다.");
  }

  const topicIntent = analyzeTopicIntent(input.topic);

  // 1. 안전 가이드라인 (민감 주제 감지)
  const sensitiveRegex = /자살|살인|사망|죽음|범죄|성폭력|마약|학대|폭력|극단적|충격/i;
  const isSensitive = sensitiveRegex.test(input.topic) || topicIntent.isScandal;

  const safetyGuideline = isSensitive ? `
## 🛡️ [CRITICAL] 콘텐츠 안전 및 규제 준수 가이드라인
**경고**: 이 주제는 플랫폼 제재 위험이 높으므로 아래 규칙을 위반할 경우 글을 작성하지 마십시오.

1. **단어 순화**: '자살', '극단적 선택' 대신 **'사망', '비극적 사건'** 등 건조한 표현을 쓰세요.
2. **필수 포함 문구**: 글 최하단에 자살예방 상담전화 ☎109 안내를 반드시 포함하세요.
3. **태도**: 피해자와 유가족을 존중하고, 루머 확산을 경계하는 진중한 태도를 유지하세요.
` : "";

  // 2. 실시간 정보 및 뉴스 지침
  let newsInstruction = "";
  if (input.latestNews) {
    newsInstruction = `
# 📰 실시간 최신 정보 (2026년 2월 기준)
당신의 내장 지식보다 아래 정보를 최우선순위로 반영하세요.
${input.latestNews}

## 🔗 출처 표기 규칙
- 뉴스 인용 시 JSON 'references' 필드에 [{"name": "매체명", "url": "URL"}] 형식을 지키세요.
`;
  }

  // 2. 오토파일럿 핵심 전략 (Strategy Core)
  const strategicCore = `
# 🚀 오토파일럿 전략 지침 (필수 준수)

## 1. 차별화 포인트
${strategy.differentiationStrategy}

## 2. 문체 및 스타일 DNA
${strategy.styleDNA}
* 위 경쟁사들의 어휘와 논리 전개를 참고하되, **'해요체'는 절대 금지**합니다.
* **신뢰의 종결어미**: "-다", "-함", "-입니다" 등 단정적인 어미만 사용하세요.
* **정체 숨기기**: AI임을 밝히거나 "전문가입니다" 같은 사족은 절대 금지입니다.

## 3. 구조 및 아웃라인
다음 아웃라인을 반드시 따르세요:
${(strategy.suggestedOutline || []).join(" -> ")}
(각 소제목 아래에는 **최소 3~4개의 알찬 문단**과 상세 리스트를 포함하여 정보를 밀도 있게 구성하세요. 정보량이 부족하면 안 됩니다.)
`.trim();

  // 3. 레이아웃 및 포맷 (Mobile Optimized)
  const layoutRules = `
# 🎨 레이아웃 및 포맷 규칙 (절대 준수)

## 📱 모바일 가독성 및 호흡 조절
- **문단 구성**: 한 문단은 **2~3문장**으로 구성하세요. (단순히 짧게 끊는 것보다, 하나의 의미가 완결된 알찬 문단을 지향합니다.)
- **빈 줄 삽입**: 문단이 끝날 때마다 반드시 **빈 줄(Enter 2번)**을 넣어 시각적 피로도를 줄이세요.
- **경고**: 4문장 이상이 붙어 있는 '텍스트 뭉치'는 지양하되, 1문장으로만 끝나는 너무 짧은 문단도 피하세요.

## ✨ 시각적 요소 및 컬러링
- **볼드체 사용 주의**: 핵심 키워드나 짧은 문구 하나만 강조하세요. **문단 전체 볼드 처리는 절대 금지**입니다.
- **컬러링 문법**:
  * 강력 강조/경고: \`!!텍스트!!\` (빨간색)
  * 긍정/장점: \`++텍스트++\` (초록색)
  * 주의/체크: \`??텍스트??\` (주황색)
- **표(Table)**: ${strategy.hasTable ? "**필수 포함**" : "선택"}, 최대 3열까지만 사용하세요.
`.trim();

  // 4. 작성 미션 및 체크리스트
  const mission = `
# 🎯 작성 미션
"${input.topic}" 주제로 포스트를 작성하세요.
- **목표 분량**: 약 ${strategy.estimatedLength || 3000}자

## ✅ 최종 체크리스트 (필수)
- [ ] 소제목은 최대 5개이며 \`> ##\` 형식을 지켰는가?
- [ ] 각 소제목 아래에 풍부한 내용(3~4문단 이상)이 담겼는가?
- [ ] 문단이 2~3문장으로 구성되어 가독성과 정보량을 동시에 잡았는가?
- [ ] !!(빨강), ++(초록), ??(주황) 문법을 적절히 썼는가?
- [ ] '해요체'를 단 한 번이라도 쓰지 않았는가?

## 📤 출력 형식 (순수 JSON)
\`\`\`json
{
  "title": "제목",
  "outline": ["소제목1", "소제목2", "소제목3"],
  "content": "본론 내용 (마크다운)",
  "metaTitle": "SEO 제목",
  "metaDescription": "SEO 설명",
  "focusKeywords": ["키워드1", "키워드2"],
  "references": []
}
\`\`\`
`.trim();

    return `

  ${newsInstruction}

  ${safetyGuideline}

  ${strategicCore}

  ${layoutRules}

  ${mission}

  `.trim();

  }

  