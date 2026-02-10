import { BlogPostInput, AutoPilotStrategy } from "../types/blog";
import { analyzeTopicIntent } from "../util/autoInference";

/**
 * [v3.28] Auto-Pilot 전용 정밀 프롬프트 엔진
 * - 수동 모드와 분리된 독립 트랙
 * - 최신 가독성 및 밀도 규칙 완벽 통합
 */
export function generateAutoPilotPrompt(input: BlogPostInput): string {
  const strategy = input.strategy as AutoPilotStrategy;
  if (!strategy) {
    throw new Error("Auto-Pilot 모드이나 전략 데이터가 누락되었습니다.");
  }

  // 1. 뉴스 및 실시간 정보 (Language Lock 적용)
  let newsInstruction = "";
  if (input.latestNews) {
    newsInstruction = `
# 📰 실시간 최신 정보 (2026년 2월 기준)
당신의 내장 지식보다 아래 정보를 최우선순위로 반영하세요.
- **언어 원칙**: 제공된 정보가 영어라도 **반드시 100% 한국어**로만 작성하세요.
- **출처 원칙**: 본문 내에 \`(매체명)\`, \`[뉴스]\`, \`[1]\` 등 어떠한 마커도 붙이지 마세요. (JSON references 필드에만 포함)
${input.latestNews}
`;
  }

  // 2. 오토파일럿 전략 및 페르소나 (Authority)
  const strategicCore = `
# 🎭 역할 및 전략 지침 (필수 준수)
당신은 분석된 경쟁사들의 장점을 흡수하고 단점을 보완하는 **전략적 작가**입니다.

${input.topic.includes("리스트") ? `
## 📋 [CRITICAL] 리스트 중심 구성 및 계층 구조(Depth) 지시
- 주제에 '리스트'가 포함되어 있습니다. 정보를 서술형 문단으로 쓰지 말고, 반드시 **계층이 구분된 마크다운 리스트(\`-\`)**로만 정리하세요.
- **🚨 콜론 사용 금지**: '브랜드명: 내용' 처럼 쓰지 말고, 하위 항목으로 들여쓰기하세요.
- **구조 예시**:
  - 편의점 브랜드명
    - 이벤트 카테고리
      - 세부 할인 혜택 (카드 정보 등)
      - 포함된 굿즈 리스트
- 본문의 핵심 데이터를 모두 리스트의 깊이(Depth)를 활용해 시각적으로 구조화하세요.
` : ""}

## 1. 차별화 전략
${strategy.differentiationStrategy}

## 2. 세만틱 SEO 및 전문성 (New)
검색 엔진이 이 글을 '전문적인 문서'로 판단하도록 아래 연관어들을 본문에 자연스럽게 녹여내세요.
- **필수 연관 키워드**: ${input.keywords?.join(", ")}
- **전략**: 위 단어들을 단순히 나열하지 말고, 각 단어의 의미나 맥락을 설명하며 전문성을 드러내세요. 

## 3. 문체 및 스타일 DNA
${strategy.styleDNA}
- **말투**: '해요체'를 절대 쓰지 마세요. 신뢰감을 주는 **'하십시오체' 또는 '평어체(-다)'**로 고정합니다.
- **정체**: AI임을 암시하거나 "전문가로서"와 같은 서술을 하지 마세요.

## 3. 구조 및 아웃라인
반드시 아래 5개 섹션을 충실히 채우세요:
${(strategy.suggestedOutline || []).join(" -> ")}
`.trim();

  // 3. 레이아웃 및 가독성 (Mobile First - 2~3문장 규칙)
  const layoutRules = `
# 🎨 레이아웃 및 포맷 규칙 (절대 준수)

## 📱 모바일 가독성 최적화
- **문단 구성**: 한 문단은 **2~3문장**으로 구성하세요. (1문장 혹은 4문장 이상 금지)
- **빈 줄 삽입**: 문단이 끝나면 반드시 **빈 줄(Enter 2번)**을 넣어 시각적 여백을 만드세요.
- **섹션 밀도**: 각 소제목 아래에는 **최소 2개 이상의 문단**을 작성하여 정보의 깊이를 확보하세요. (총 4~6문장 이상 필수)

## ✨ 시각적 요소 및 강조
- **이미지 생성 금지**: 본문에 어떠한 이미지 관련 태그(\`![...]\`, \`[이미지:...]\`)도 **포함하지 마세요.**
- **컬러링 문법**: 강조(!!빨강!!), 긍정(++초록++), 주의(??주황??)를 적극 활용하세요.
- **표(Table)**: ${strategy.hasTable ? "**필수 포함**" : "선택"}, 최대 3열까지만 사용하세요.
`.trim();

  // 4. 작성 미션 및 체크리스트
  const mission = `
# 🎯 작성 미션
"${input.topic}" 주제로 포스트를 작성하세요.
- **목표 분량**: 약 ${strategy.estimatedLength || 3000}자
- **언어**: 100% 한국어 (영어 혼용 절대 금지)

## ✅ 최종 체크리스트 (하나라도 어길 시 실패)
- [ ] 각 소제목 아래에 **최소 2개 이상의 문단**이 있는가?
- [ ] 문단당 2~3문장으로 구성되어 가독성이 좋은가?
- [ ] 본문에 \`(매체명)\`이나 \`[뉴스]\` 같은 찌꺼기가 없는가?
- [ ] 영어가 섞여 있지 않고 완벽한 한국어인가?
- [ ] 본문에 이미지 태그가 하나도 없는가?

## 📤 출력 형식 (순수 JSON)
\`\`\`json
{
  "title": "제목",
  "outline": ["소제목1", "소제목2", "소제목3", "소제목4", "소제목5"],
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
${strategicCore}
${layoutRules}
${mission}
`.trim();
}
