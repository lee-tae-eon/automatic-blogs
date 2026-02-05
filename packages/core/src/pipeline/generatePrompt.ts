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

export function generateBlogPrompt(input: BlogPostInput): string {
  const persona = input.persona;
  const tone = input.tone;
  const toneConfig = TONE_CONFIG[tone];
  const toneInstruction = getToneInstruction(tone);

  // ==========================================
  // 하이브리드 추론 시스템
  // ==========================================
  const targetAudience = inferTargetAudience(input.topic, persona);
  const contentGoal = inferContentGoal(persona);
  const topicIntent = analyzeTopicIntent(input.topic);

  // ✅ [보강] 민감 주제 감지 로직 (Regex Check)
  // 사건, 사망, 범죄 등 플랫폼 제재 가능성이 있는 키워드 감지
  const sensitiveRegex =
    /자살|살인|사망|죽음|범죄|성폭력|마약|학대|폭력|극단적|충격/i;
  const isSensitive = sensitiveRegex.test(input.topic) || topicIntent.isScandal;

  // ✅ [신규] 안전 및 규제 준수 가이드라인 (최우선 순위)
  const safetyGuideline = isSensitive
    ? `
## 🛡️ [CRITICAL] 콘텐츠 안전 및 규제 준수 가이드라인
**경고**: 이 주제는 플랫폼 제재 위험이 높으므로 아래 규칙을 위반할 경우 글을 작성하지 마십시오.

1. **단어 순화 (제목/본문 필수 적용)**:
   - '자살', '극단적 선택' 등의 단어를 제목에 절대 쓰지 마십시오. -> **'사망', '숨진 채 발견'** 등으로 건조하게 대체하세요.
   - 자극적인 표현(충격, 경악 등)을 배제하세요.

2. **묘사 엄격 금지 (보도준칙 4.0 준수)**:
   - **방법, 도구, 장소, 동기**를 구체적으로 묘사하지 마십시오. (모방 위험 차단)
   - 사건의 잔혹성을 부각하거나 상세히 묘사하지 마십시오.

3. **필수 포함 요소 (상담 정보)**:
   - 글의 최하단에 반드시 아래 문구를 포함하세요:
     > "우울감 등 말하기 어려운 고민이 있거나 주변에 이런 어려움을 겪는 가족·지인이 있을 경우 자살예방 상담전화 ☎109에서 24시간 전문가의 상담을 받을 수 있습니다."

4. **태도**:
   - 가해자 서사가 아닌 **피해자와 유가족의 아픔**을 존중하는 태도를 유지하세요.
   - 섣부른 추측이나 루머 확산을 경계하세요.
`
    : "";

  // 기존 스캔들 가이드라인 (Safety 가이드라인이 더 강력하므로 보조 역할로 축소)
  const scandalGuideline =
    topicIntent.isScandal && !isSensitive
      ? `
## 🚨 사회적 이슈 대응 지침
1. **공감의 대상**: 박탈감을 느낀 대중 또는 피해자에게 공감하세요.
2. **태도**: 가해자를 옹호하지 말고, 사회적 정의 관점에서 비판적 시각을 유지하세요.
`
      : "";

  const personaDetail = getPersonaDetail(persona);
  const examples = getPersonaExamples(persona);
  const metrics = getQualityMetrics(persona);

  // ==========================================
  // 키워드 섹션 동적 생성 (기존 유지)
  // ==========================================
  let keywordInstruction = "";

  if (input.keywords && input.keywords.length > 0) {
    keywordInstruction = `
## 키워드 사용 (사용자 지정)
- **필수 키워드**: ${input.keywords.join(", ")}
- **주의**: 만약 키워드 중 '자살' 등 금지어가 포함되어 있다면, 이를 본문에서 **'사망' 등의 순화된 표현**으로 변경하여 자연스럽게 녹여내세요.
- **키워드 밀도**: ${metrics.keywordDensity[0]}% ~ ${metrics.keywordDensity[1]}%
- **소제목**: 4~5개 중 최소 3개에 키워드 포함`;
  } else {
    keywordInstruction = `
## 키워드 추출 및 사용 (AI 추론)
- **추론 지시**: "${input.topic}" 주제에서 SEO 효과적인 핵심 키워드 3~5개를 추출하세요.
- **필터링**: 플랫폼 정책 위반 소지가 있는 자극적인 키워드는 제외하세요.
- **사용 방법**: 추출한 키워드를 ${metrics.keywordDensity[0]}% ~ ${metrics.keywordDensity[1]}% 밀도로 배치`;
  }

  // ==========================================
  // 실시간 뉴스 데이터 및 출처 지침 (기존 유지)
  // ==========================================
  let newsInstruction = "";
  if (input.latestNews) {
    newsInstruction = `
# 📰 실시간 최신 뉴스 정보 (팩트 체크용)
다음은 현재 시점의 실제 뉴스 데이터입니다. 당신의 내장 지식(과거 데이터)보다 **아래 정보를 최우선순위**로 두어 작성하세요.

# ⚠️ 지식 업데이트 명령 (CRITICAL)
- 당신의 내부 지식(2023년 이전)은 무시하십시오.
- 현재는 2026년 2월 2일이며, 아래 제공된 뉴스가 '유일한' 최신 사실입니다.
- 뉴스 내용 중 잔혹하거나 구체적인 자살 방법 묘사가 있다면 **절대 인용하지 말고 제외**하십시오.

${input.latestNews}

## 🔗 출처 표기 규칙
1. 위 뉴스 데이터에 포함된 **언론사명과 URL**을 JSON 응답의 'references' 필드에 반드시 포함하세요.
2. 절대 가짜 URL이나 존재하지 않는 언론사를 지어내지 마세요.`;
  }

  // ==========================================
  // 1. 시스템 역할 정의 (가이드라인 주입)
  // ==========================================
  const systemRole = `
# 🎭 역할 정의
당신은 **${personaDetail.role}**입니다.

## 핵심 원칙
${personaDetail.principle}
- **규정 준수**: 네이버 블로그 운영 정책 및 방송통신심의위원회 가이드라인을 철저히 준수합니다.

## 문체 및 스타일
${personaDetail.style}

## 톤&매너
${toneInstruction}

${safetyGuideline}
${scandalGuideline}

## 전문 분야
${input.topic}
`.trim();

  // ==========================================
  // 2. 페르소나별 상세 가이드 (기존 유지)
  // ==========================================
  const personaGuide = `
# 📝 페르소나 상세 가이드

## 도입부 패턴 (다음 중 하나를 활용)
${personaDetail.hooks.map((hook, i) => `${i + 1}. ${hook}`).join("\n")}

## 본문 구조
${personaDetail.structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## 문단 연결 방식
다음과 같은 전환어를 자연스럽게 활용하세요:
${personaDetail.transitions.map((t) => `- "${t}"`).join("\n")}

## 마무리 스타일
${personaDetail.closingStyle}

## ⚠️ 절대 사용 금지 표현
${personaDetail.forbidden.map((f) => `- "${f}"`).join("\n")}
${toneConfig.avoid && toneConfig.avoid.length > 0 ? `\n## ⚠️ 톤 관련 금지 표현\n${toneConfig.avoid.map((a) => `- "${a}"`).join("\n")}` : ""}
`.trim();

  // ==========================================
  // 3. 좋은 예시 / 나쁜 예시 (기존 유지)
  // ==========================================
  const examplesGuide = `
# ✅ 좋은 문장 예시 (이렇게 작성하세요)

## 페르소나 예시
${examples.goodSentences.map((s, i) => `${i + 1}. "${s}"`).join("\n")}

## 톤 예시 (이 톤으로 작성)
${toneConfig?.examples ? toneConfig.examples.map((ex, i) => `${i + 1}. "${ex}"`).join("\n") : ""}

# ❌ 나쁜 문장 예시 (절대 사용 금지)
${examples.badSentences.map((s, i) => `${i + 1}. "${s}"`).join("\n")}

# 🔄 문단 전환 예시
${examples.transitions.map((s, i) => `${i + 1}. "${s}"`).join("\n")}
`.trim();

  // ==========================================
  // 4. 레이아웃 및 포맷 규칙 (기존 유지)
  // ==========================================
  const layoutRules = `
# 🎨 레이아웃 및 포맷 규칙

## 가독성 및 줄바꿈 (Mobile First)
- **절대 원칙**: 한 문단은 **최대 3문장**까지만 작성하고, 반드시 줄바꿈(엔터)을 하세요.
- **호흡**: 텍스트 뭉치(Wall of Text)가 보이면 독자가 이탈합니다. 짧게 끊어치세요.
- **형식**: 문단 사이에는 빈 줄 하나를 추가하여 시각적 여백을 주세요.

## 소제목 구성
- **개수**: **${metrics.headingCount - 1} ~ ${metrics.headingCount}개**
- **형식**: 반드시 \`\\n> ## 소제목명\` 형식 사용
- **규칙**:
  1. 소제목 앞에는 줄바꿈 **한 번(\\n)**만 삽입
  2. 소제목 기호(\`> ##\`)와 텍스트 사이 **한 칸 공백** 필수
  3. 제목만 있고 내용 없는 빈 섹션은 절대 금지
  4. 마지막 소제목도 최소 2개 이상의 문단으로 완성
  5. 이모지는 ${
    metrics.emojiUsage === "minimal"
      ? "최소화 (소제목당 0~1개)"
      : metrics.emojiUsage === "moderate"
        ? "적절히 (소제목당 1개)"
        : "활발히 (소제목당 1~2개)"
  } 사용

## 시각적 요소
- **표(Table)**: ${metrics.tableRequired ? "**필수** (비교/분석 데이터)" : "선택 (필요시에만)"}
- **강조**: 핵심 키워드는 **볼드 처리**
- **이미지**: 본문 전체에서 **최대 3개**로 제한 (권장 위치: 소제목 1, 3, 5 하단)
  * **형식**: 반드시 \`\\n> [이미지: 검색키워드]\` 형태로만 작성
  * **주의**: 사건 사고 관련 주제일 경우, 실제 현장 사진이나 자극적인 이미지는 절대 요청하지 마세요. 추상적인 이미지나 뉴스 헤드라인 등을 요청하세요.

## 예상 글자 수
${metrics.targetLength[0]}자 ~ ${metrics.targetLength[1]}자
`.trim();

  // ==========================================
  // 5. SEO 최적화 규칙 (기존 유지)
  // ==========================================
  const seoRules = `
# 🔍 SEO 최적화 규칙

${keywordInstruction}

## 메타 정보
- **메타 제목**: ${SEO_RULES.metaTitleLength[0]}~${SEO_RULES.metaTitleLength[1]}자
- **메타 설명**: ${SEO_RULES.metaDescriptionLength[0]}~${SEO_RULES.metaDescriptionLength[1]}자
- **포커스 키워드**: ${SEO_RULES.focusKeywordCount[0]}~${SEO_RULES.focusKeywordCount[1]}개 선정
`.trim();

  // ==========================================
  // 6. 작성 미션 및 출력 형식 (기존 유지)
  // ==========================================
  const mission = `
# 🎯 작성 미션
"${input.topic}" 주제로 ${persona} 페르소나 블로그 포스트를 작성하세요.

## 📌 자동 분석 결과
- **타겟 독자**: ${targetAudience}
- **콘텐츠 목표**: ${contentGoal}
- **민감 주제 여부**: ${isSensitive ? "🚨 예 (안전 가이드라인 적용)" : "아니오"}

## 문체 통합 원칙
- **구조**: 페르소나(${persona})의 글쓰기 패턴을 따름
- **말투**: 톤(${tone})의 예시 문장 스타일로 작성 - ${toneConfig.ending}
- **금지**: 페르소나 금지 표현 + 톤 금지 표현 모두 회피

## ✅ 최종 체크리스트
- [ ] 소제목은 4~5개이며 \`\\n> ## 소제목\` 형식을 지켰는가?
- [ ] **모든 소제목** 아래에 최소 2개 이상의 충실한 문단이 있는가?
- [ ] **한 문단이 3문장을 넘지 않도록 줄바꿈을 했는가?** (가독성 체크)
- [ ] 금지 표현(${personaDetail.forbidden.slice(0, 2).join(", ")})을 사용하지 않았는가?
- [ ] 민감한 주제일 경우, 제목에 '자살' 등의 단어를 제외하고 상담 전화를 포함했는가?
- [ ] ${metrics.tableRequired ? "비교 표를 포함했는가?" : ""}
- [ ] "요약" 또는 "결론" 섹션에 실제 내용이 있는가? (제목만 있으면 안 됨)
- [ ] **이미지가 3개 이하**로 제한되었는가?

## 📤 출력 형식 (순수 JSON만)
\`\`\`json
{
  "title": "매력적인 제목 (${SEO_RULES.metaTitleLength[0]}~${SEO_RULES.metaTitleLength[1]}자)",
  "outline": ["소제목1", "소제목2", "소제목3", "소제목4", "소제목5"],
  "content": "본문 내용 (마크다운 형식, \\n으로 줄바꿈)",
  "metaTitle": "SEO 최적화 제목",
  "metaDescription": "SEO 설명 (${SEO_RULES.metaDescriptionLength[0]}~${SEO_RULES.metaDescriptionLength[1]}자)",
  "focusKeywords": ["키워드1", "키워드2", "키워드3"],
  "estimatedReadTime": 5,
  "references": [
     {"name": "언론사명", "url": "실제 뉴스 URL"}
  ]
}
\`\`\`

**중요**: 응답은 **오직 순수한 JSON 형식만** 허용하며, 줄바꿈은 \`\\n\` 기호로 처리하세요.
`.trim();

  // ==========================================
  // 최종 프롬프트 조합
  // ==========================================
  return `
${newsInstruction}

${systemRole}

${personaGuide}

${examplesGuide}

${layoutRules}

${seoRules}

${mission}
`.trim();
}

// // packages/core/src/prompts/generateBlogPrompt.ts

// import { getToneInstruction, TONE_CONFIG } from "../tone/tone_config";
// import { getPersonaDetail } from "../persona/persona.config";
// import { getPersonaExamples } from "../persona/persona.example";
// import { getQualityMetrics, SEO_RULES } from "../persona/quality-metrics";
// import { BlogPostInput } from "../types/blog";
// import {
//   inferTargetAudience,
//   inferContentGoal,
//   analyzeTopicIntent,
// } from "../util/autoInference";

// export function generateBlogPrompt(input: BlogPostInput): string {
//   const persona = input.persona;
//   const tone = input.tone;
//   const toneConfig = TONE_CONFIG[tone];
//   const toneInstruction = getToneInstruction(tone);

//   // ==========================================
//   // 하이브리드 추론 시스템
//   // ==========================================
//   const targetAudience = inferTargetAudience(input.topic, persona);
//   const contentGoal = inferContentGoal(persona);
//   const topicIntent = analyzeTopicIntent(input.topic);

//   // ✅ [수정 1] 사회적 이슈 대응 지침 추가
//   const scandalGuideline = topicIntent.isScandal
//     ? `
// ## 🚨 긴급: 사회적 이슈 대응 지침
// 1. **공감의 대상**: 가해자나 사건 당사자가 아닙니다. **'박탈감을 느낀 대중'** 또는 **'성실하게 살아가는 독자'**의 마음에 공감하세요.
// 2. **금지된 접근**: "너도 세금 고민 있니?" 같은 사소한 개인사로 물타기 하지 마세요.
// 3. **태도**: '솔직담백(Candid)' 톤을 유지하되, 잘못된 사안에 대해서는 날카롭고 단호한 비판을 견지하세요.
// 4. **결론**: 단순히 위로로 끝내지 말고, 사회적 정의나 상식적인 선에서 사안을 마무리하세요.
// `
//     : "";

//   const personaDetail = getPersonaDetail(persona);
//   const examples = getPersonaExamples(persona);
//   const metrics = getQualityMetrics(persona);

//   // ==========================================
//   // 키워드 섹션 동적 생성 (기존 유지)
//   // ==========================================
//   let keywordInstruction = "";

//   if (input.keywords && input.keywords.length > 0) {
//     keywordInstruction = `
// ## 키워드 사용 (사용자 지정)
// - **필수 키워드**: ${input.keywords.join(", ")}
// - **사용 방법**: 위 키워드를 반드시 포함하되, 자연스럽게 배치
// - **키워드 밀도**: ${metrics.keywordDensity[0]}% ~ ${metrics.keywordDensity[1]}%
// - **첫 문단**: 주요 키워드 1개 이상 포함
// - **소제목**: 4~5개 중 최소 3개에 키워드 포함`;
//   } else {
//     keywordInstruction = `
// ## 키워드 추출 및 사용 (AI 추론)
// - **추론 지시**: "${input.topic}" 주제에서 SEO 효과적인 핵심 키워드 3~5개를 직접 추출하세요
// - **추출 기준**:
//   1. 검색량이 많을 것으로 예상되는 단어
//   2. 주제의 핵심을 표현하는 명사/복합어
//   3. 경쟁도가 적당한 롱테일 키워드 포함
// - **예시**: "30대 직장인 아침 루틴" → ["아침 루틴", "생산성 향상", "직장인 건강", "모닝 루틴"]
// - **사용 방법**: 추출한 키워드를 ${metrics.keywordDensity[0]}% ~ ${metrics.keywordDensity[1]}% 밀도로 자연스럽게 배치
// - **배치 위치**:
//   * 제목에 1개 이상
//   * 첫 문단에 2개 이상
//   * 소제목 4~5개 중 최소 3개에 포함
//   * 본문 전체에 고르게 분산`;
//   }

//   // ==========================================
//   // ✅ [수정 2] 최신 뉴스 데이터 및 출처 지침 추가
//   // ==========================================
//   let newsInstruction = "";
//   if (input.latestNews) {
//     newsInstruction = `
// # 📰 실시간 최신 뉴스 정보 (팩트 체크용)
// 다음은 현재 시점의 실제 뉴스 데이터입니다. 당신의 내장 지식(과거 데이터)보다 **아래 정보를 최우선순위**로 두어 작성하세요. 2026년 현재 상황을 반영해야 합니다.

// # ⚠️ 지식 업데이트 명령 (CRITICAL)
// - 당신의 내부 지식(2023년 이전)은 무시하십시오.
// - 현재는 2026년 2월 2일이며, 아래 제공된 뉴스가 '유일한' 최신 사실입니다.
// - 뉴스에서 "2020년부터 담합"이라고 했다면, 2010년 사례는 언급하지 마세요.

// ${input.latestNews}

// ## 🔗 출처 표기 규칙
// 1. 위 뉴스 데이터에 포함된 **언론사명과 URL**을 JSON 응답의 'references' 필드에 반드시 포함하세요.
// 2. 절대 가짜 URL이나 존재하지 않는 언론사를 지어내지 마세요.
// 3. 본문 중간에 "뉴스에 따르면", "보도에 의하면"과 같은 표현을 적절히 섞어 신뢰도를 높이세요.`;
//   }

//   // ==========================================
//   // 1. 시스템 역할 정의 (가이드라인 주입)
//   // ==========================================
//   const systemRole = `
// # 🎭 역할 정의
// 당신은 **${personaDetail.role}**입니다.

// ## 핵심 원칙
// ${personaDetail.principle}

// ## 문체 및 스타일
// ${personaDetail.style}

// ## 톤&매너
// ${toneInstruction}

// ## 비판적요소일때 가이드
// ${scandalGuideline}

// ## 현재 날짜
// ${new Date().toLocaleDateString("ko-KR")} - 최신 정보를 반영하세요.

// ## 전문 분야
// ${input.topic}
// `.trim();

//   // ==========================================
//   // 2. 페르소나별 상세 가이드 (기존 유지)
//   // ==========================================
//   const personaGuide = `
// # 📝 페르소나 상세 가이드

// ## 도입부 패턴 (다음 중 하나를 활용)
// ${personaDetail.hooks.map((hook, i) => `${i + 1}. ${hook}`).join("\n")}

// ## 본문 구조
// ${personaDetail.structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}

// ## 문단 연결 방식
// 다음과 같은 전환어를 자연스럽게 활용하세요:
// ${personaDetail.transitions.map((t) => `- "${t}"`).join("\n")}

// ## 마무리 스타일
// ${personaDetail.closingStyle}

// ## ⚠️ 절대 사용 금지 표현
// ${personaDetail.forbidden.map((f) => `- "${f}"`).join("\n")}
// ${toneConfig.avoid && toneConfig.avoid.length > 0 ? `\n## ⚠️ 톤 관련 금지 표현\n${toneConfig.avoid.map((a) => `- "${a}"`).join("\n")}` : ""}
// `.trim();

//   // ==========================================
//   // 3. 좋은 예시 / 나쁜 예시 (기존 유지)
//   // ==========================================
//   const examplesGuide = `
// # ✅ 좋은 문장 예시 (이렇게 작성하세요)

// ## 페르소나 예시
// ${examples.goodSentences.map((s, i) => `${i + 1}. "${s}"`).join("\n")}

// ## 톤 예시 (이 톤으로 작성)
// ${toneConfig?.examples ? toneConfig.examples.map((ex, i) => `${i + 1}. "${ex}"`).join("\n") : ""}

// # ❌ 나쁜 문장 예시 (절대 사용 금지)
// ${examples.badSentences.map((s, i) => `${i + 1}. "${s}"`).join("\n")}

// # 🔄 문단 전환 예시
// ${examples.transitions.map((s, i) => `${i + 1}. "${s}"`).join("\n")}
// `.trim();

//   // ==========================================
//   // 4. 레이아웃 및 포맷 규칙
//   // ✅ [수정 3] 이미지 개수 제한 로직 적용
//   // ==========================================
//   const layoutRules = `
// # 🎨 레이아웃 및 포맷 규칙

// ## 가독성 및 줄바꿈 (Mobile First)
// - **절대 원칙**: 한 문단은 **최대 3문장**까지만 작성하고, 반드시 줄바꿈(엔터)을 하세요.
// - **호흡**: 텍스트 뭉치(Wall of Text)가 보이면 독자가 이탈합니다. 짧게 끊어치세요.
// - **형식**: 문단 사이에는 빈 줄 하나를 추가하여 시각적 여백을 주세요.

// ## 소제목 구성
// - **개수**: **${metrics.headingCount - 1} ~ ${metrics.headingCount}개**
// - **형식**: 반드시 \`\\n> ## 소제목명\` 형식 사용
// - **규칙**:
//   1. 소제목 앞에는 줄바꿈 **한 번(\\n)**만 삽입
//   2. 소제목 기호(\`> ##\`)와 텍스트 사이 **한 칸 공백** 필수
//   3. 제목만 있고 내용 없는 빈 섹션은 절대 금지
//   4. 마지막 소제목도 최소 2개 이상의 문단으로 완성
//   5. 이모지는 ${
//     metrics.emojiUsage === "minimal"
//       ? "최소화 (소제목당 0~1개)"
//       : metrics.emojiUsage === "moderate"
//         ? "적절히 (소제목당 1개)"
//         : "활발히 (소제목당 1~2개)"
//   } 사용

// ## 문장 및 문단 길이
// - **문장**: 최대 **${metrics.sentenceMaxLength}자** 이하
// - **문단**: 최대 **${metrics.paragraphMaxLength}자** 이하
// - **가독성**: 2~3문장마다 빈 줄 삽입 (모바일 최적화)

// ## 시각적 요소
// - **표(Table)**: ${metrics.tableRequired ? "**필수** (비교/분석 데이터)" : "선택 (필요시에만)"}
// - **강조**: 핵심 키워드는 **볼드 처리**
// - **이미지**: 본문 전체에서 **최대 3개**로 제한 (권장 위치: 소제목 1, 3, 5 하단)
//   * **형식**: 반드시 \`\\n> [이미지: 검색키워드]\` 형태로만 작성

// ## 예상 글자 수
// ${metrics.targetLength[0]}자 ~ ${metrics.targetLength[1]}자
// `.trim();

//   // ==========================================
//   // 5. SEO 최적화 규칙 (기존 유지)
//   // ==========================================
//   const seoRules = `
// # 🔍 SEO 최적화 규칙

// ${keywordInstruction}

// ## 메타 정보
// - **메타 제목**: ${SEO_RULES.metaTitleLength[0]}~${SEO_RULES.metaTitleLength[1]}자
// - **메타 설명**: ${SEO_RULES.metaDescriptionLength[0]}~${SEO_RULES.metaDescriptionLength[1]}자
// - **포커스 키워드**: ${SEO_RULES.focusKeywordCount[0]}~${SEO_RULES.focusKeywordCount[1]}개 선정
// `.trim();

//   // ==========================================
//   // 6. 작성 미션 및 출력 형식 (references 필드 추가)
//   // ==========================================
//   const mission = `
// # 🎯 작성 미션
// "${input.topic}" 주제로 ${persona} 페르소나 블로그 포스트를 작성하세요.

// ## 📌 자동 분석 결과
// - **타겟 독자**: ${targetAudience}
// - **콘텐츠 목표**: ${contentGoal}
// - **주제 특성**: ${
//     topicIntent.isReview
//       ? "리뷰형"
//       : topicIntent.isHowTo
//         ? "가이드형"
//         : topicIntent.isComparison
//           ? "비교형"
//           : topicIntent.isOpinion
//             ? "의견형"
//             : "정보형"
//   }

// ## 문체 통합 원칙
// - **구조**: 페르소나(${persona})의 글쓰기 패턴을 따름
// - **말투**: 톤(${tone})의 예시 문장 스타일로 작성 - ${toneConfig.ending}
// - **금지**: 페르소나 금지 표현 + 톤 금지 표현 모두 회피

// ## ✅ 최종 체크리스트
// - [ ] 소제목은 4~5개이며 \`\\n> ## 소제목\` 형식을 지켰는가?
// - [ ] **모든 소제목** 아래에 최소 2개 이상의 충실한 문단이 있는가?
// - [ ] **마지막 소제목**도 빈 내용 없이 완성되었는가?
// - [ ] 금지 표현(${personaDetail.forbidden.slice(0, 2).join(", ")})을 사용하지 않았는가?
// - [ ] 톤 예시 문장 스타일을 따랐는가?
// - [ ] 문장은 ${metrics.sentenceMaxLength}자 이하인가?
// - [ ] ${metrics.tableRequired ? "비교 표를 포함했는가?" : ""}
// - [ ] 키워드가 자연스럽게 ${metrics.keywordDensity[0]}% 이상 포함되었는가?
// - [ ] "요약" 또는 "결론" 섹션에 실제 내용이 있는가? (제목만 있으면 안 됨)
// - [ ] **이미지가 3개 이하**로 제한되었는가?

// ## 📤 출력 형식 (순수 JSON만)
// \`\`\`json
// {
//   "title": "매력적인 제목 (${SEO_RULES.metaTitleLength[0]}~${SEO_RULES.metaTitleLength[1]}자)",
//   "outline": ["소제목1", "소제목2", "소제목3", "소제목4", "소제목5"],
//   "content": "본문 내용 (마크다운 형식, \\n으로 줄바꿈)",
//   "metaTitle": "SEO 최적화 제목",
//   "metaDescription": "SEO 설명 (${SEO_RULES.metaDescriptionLength[0]}~${SEO_RULES.metaDescriptionLength[1]}자)",
//   "focusKeywords": ["키워드1", "키워드2", "키워드3"],
//   "estimatedReadTime": 5,
//   "references": [
//      {"name": "언론사명", "url": "실제 뉴스 URL"}
//   ]
// }
// \`\`\`

// **중요**: 응답은 **오직 순수한 JSON 형식만** 허용하며, 줄바꿈은 \`\\n\` 기호로 처리하세요.
// `.trim();

//   // ==========================================
//   // 최종 프롬프트 조합
//   // ==========================================
//   return `
// ${newsInstruction}

// ${systemRole}

// ${personaGuide}

// ${examplesGuide}

// ${layoutRules}

// ${seoRules}

// ${mission}
// `.trim();
// }
