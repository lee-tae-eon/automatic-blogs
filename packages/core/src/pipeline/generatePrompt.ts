import { getToneInstruction } from "../tone/tone_config";
import { getPersonaDetail } from "../persona/persona.config";
import { getPersonaExamples } from "../persona/persona.example";
import { getQualityMetrics, SEO_RULES } from "../persona/quality-metrics";
import { BlogPostInput } from "../types/blog";
import { inferTargetAudience, inferContentGoal } from "../util/autoInference";

/**
 * [v4.0] 자연스러운 문맥 흐름 + 리스트 활용 프롬프트
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

  // 뉴스 데이터
  let newsInstruction = "";
  if (input.latestNews) {
    newsInstruction = `
# 📰 실시간 정보 (Source Material)
아래 정보를 바탕으로 글을 작성하되, **반드시 한국어로 자연스럽게 번역/가공**하세요.
- **절대 금지**: 문장 끝에 \`(출처)\`, \`[1]\` 등 붙이지 마세요. 본문에 녹여내세요.
${input.latestNews}
`;
  }

  // ✅ 핵심: 자연스러운 글쓰기 원칙
  const naturalWriting = `
# ✍️ 자연스러운 글쓰기 원칙 (Natural Flow)

## 🌊 문맥의 흐름을 최우선으로

당신은 **독자의 이해**를 돕는 작가입니다. 기계적인 규칙보다 **자연스러운 설명**이 우선입니다.

### 📖 기본 단위: "호흡"

**소문단 (Chunk)** = 2~3문장으로 하나의 작은 생각 전달
- 하나의 포인트, 하나의 팩트, 하나의 예시
- 약 100~150자 내외
- 소문단 끝에는 **빈 줄** (Enter 2번)

**중문단 (Section)** = 소문단 2개 정도로 하나의 완전한 논점 구성
- 소문단 1: 문제 제기 또는 주장
- 소문단 2: 구체적 설명, 예시, 데이터

**예시:**
\`\`\`
재생에너지 전환은 선택이 아닌 필수입니다. 2030년까지 탄소 배출 50% 감축이 목표이기 때문이죠.

풍력발전은 그 중심에 있습니다. 바람만으로 전기를 만들어 환경 오염이 없거든요. 하지만 초기 투자 비용과 입지 선정이 과제로 남아있습니다.
\`\`\`

### 🎯 정보 나열 시 = 리스트 필수

**3개 이상의 항목**을 나열할 때는 **절대 서술형 금지**. 반드시 리스트로:

**❌ 나쁜 예 (통글):**
\`\`\`
풍력발전의 장점으로는 첫째 무공해 에너지라는 점, 둘째 연료비가 들지 않는다는 점, 셋째 설치 후 유지비가 낮다는 점, 넷째 지역경제 활성화에 기여한다는 점이 있습니다.
\`\`\`

**✅ 좋은 예 (리스트):**
\`\`\`
풍력발전의 주요 장점은 다음과 같습니다:

- **무공해 에너지**: 탄소 배출 제로
- **연료비 절감**: 바람은 무료 자원
- **낮은 유지비**: 설치 후 관리 비용 최소화
- **지역경제 활성화**: 일자리 창출 및 관광 자원화
\`\`\`

### 📊 비교/대조 시 = 표(Table) 활용

2개 이상의 대상을 비교할 때는 표로 정리하면 한눈에 들어옵니다.

**모바일 최적화:**
- **최대 3열**까지만
- 각 셀은 **15자 이내 핵심어**로
- 서술형 금지, 단답형만

**예시:**
\`\`\`markdown
| 구분 | 풍력 | 태양광 |
|------|------|--------|
| 설치비 | 높음 | 중간 |
| 유지비 | 낮음 | 낮음 |
| 날씨 영향 | 중간 | 높음 |
\`\`\`

### 🎭 문장 길이 믹스 (리듬감)

모든 문장이 비슷한 길이면 지루합니다. **극단적으로 섞으세요**:

\`\`\`
풍력발전기 화재가 발생했습니다. (짧음 - 임팩트)

이번 사고는 경남 양산시 어곡동 에덴밸리 인근 야산에 위치한 높이 70m, 날개 길이 37.5m의 대형 발전기에서 발생했으며, 소방당국과 산불진화대 등 82명의 인력이 투입되어 약 2시간 20분 만에 진화에 성공했습니다. (긴 문장 - 디테일)

다행히 인명 피해는 없었죠. (짧음 - 안도)
\`\`\`
`;

  // 소제목 구성
  const sectionStructure = `
## 📑 소제목별 구성 가이드

각 소제목(\`> ##\`) 아래는 다음 패턴으로 작성하세요:

**1. 도입 소문단 (2~3문장)**
- 이 섹션이 왜 중요한지
- 핵심 주장이나 문제 제기

**2. 본론 소문단 (2~3문장)**
- 구체적 설명, 근거, 데이터

**3. 리스트 또는 표 (필요시)**
- 3개 이상 항목 나열 → 리스트
- 비교/대조 → 표

**4. 마무리 소문단 (2~3문장, 선택)**
- 핵심 요약 또는 다음 섹션 연결

**전체 흐름:**
\`\`\`
> ## 소제목

도입 소문단: 이 섹션의 배경과 중요성을 2~3문장으로 설명합니다.

본론 소문단: 구체적인 내용을 풀어냅니다. 예시나 데이터를 활용하죠.

핵심 정보가 있다면:

- **항목 1**: 설명
- **항목 2**: 설명
- **항목 3**: 설명

마무리 소문단: 이 섹션의 포인트를 한 번 더 강조하거나, 다음 섹션으로 자연스럽게 넘어갑니다.
\`\`\`
`;

  // 금지 사항
  const prohibitions = `
## 🚫 절대 금지 사항

1. **통글 금지**: 5문장 이상을 빈 줄 없이 이어쓰면 실패
2. **3개 이상 나열을 문장으로**: 리스트 쓰세요
3. **같은 종결어미 3연속**: ~다 ~다 ~다 (X)
4. **기계적 패턴**: "첫째, 둘째, 셋째" 대신 리스트
5. **제목 중복**: content에 \`# 제목\` 다시 쓰지 마세요
6. **페르소나 금지어**: ${personaDetail.forbidden.slice(0, 3).join(", ")}
`;

  // 품질 가이드
  const qualityGuide = `
# 📏 품질 가이드

- **글자 수**: ${metrics.targetLength[0]} ~ ${metrics.targetLength[1]}자
- **소제목**: ${metrics.headingCount}개
- **표**: ${metrics.tableRequired ? "1개 이상 필수" : "필요시 포함"}
- **이모지**: ${metrics.emojiUsage} 모드
- **이미지 태그**: 본문에 절대 금지
`;

  // SEO
  const seoGuide = `
# 🔍 SEO

- **메타 제목**: ${SEO_RULES.metaTitleLength[0]}~${SEO_RULES.metaTitleLength[1]}자
- **메타 설명**: ${SEO_RULES.metaDescriptionLength[0]}~${SEO_RULES.metaDescriptionLength[1]}자
- **키워드**: "${input.keywords?.join(", ") || input.topic}" 3~5회 자연스럽게 포함
`;

  // 톤
  const toneGuide = `
# 🎵 톤&매너

## 톤: ${tone}
${toneInstruction}

## 페르소나: ${personaDetail.role}
${personaDetail.principle}
`;

  // 미션
  const mission = `
# 🎯 최종 미션

**주제**: "${input.topic}"

## 작성 흐름

1. **도입부** (2~3문장): 흥미 유발, 배경 설명
2. **소제목 1~${metrics.headingCount}**: 위 가이드 따라 작성
3. **각 섹션**: 소문단 2개 + 필요시 리스트/표
4. **자연스러운 연결**: 문맥이 끊기지 않게

## 타겟

- **독자**: ${targetAudience}
- **목표**: ${contentGoal}

## 체크리스트

- [ ] 도입부로 시작했는가?
- [ ] 각 소문단은 2~3문장인가?
- [ ] 소문단 사이에 빈 줄이 있는가?
- [ ] 3개 이상 나열은 리스트로 처리했는가?
- [ ] 비교는 표로 정리했는가?
- [ ] 문장 길이가 다양한가?
- [ ] 문맥의 흐름이 자연스러운가?

## 📤 출력 (JSON만)

\`\`\`json
{
  "title": "클릭을 부르는 제목",
  "outline": ["소제목1", "소제목2", "소제목3", "소제목4", "소제목5"],
  "content": "마크다운 본문 (제목 제외)",
  "metaTitle": "SEO 제목",
  "metaDescription": "SEO 설명",
  "focusKeywords": ["키워드1", "키워드2", "키워드3"],
  "references": [{"name": "출처명", "url": "링크"}]
}
\`\`\`

**중요**: content에는 순수 마크다운 본문만. 제목, 아웃라인, 키워드 등 메타 정보 포함 금지.
`;

  return `
${newsInstruction}
${toneGuide}
${naturalWriting}
${sectionStructure}
${prohibitions}
${qualityGuide}
${seoGuide}
${mission}
`.trim();
}

// import { getToneInstruction } from "../tone/tone_config";
// import { getPersonaDetail } from "../persona/persona.config";
// import { getPersonaExamples } from "../persona/persona.example";
// import { getQualityMetrics, SEO_RULES } from "../persona/quality-metrics";
// import { BlogPostInput } from "../types/blog";
// import { inferTargetAudience, inferContentGoal } from "../util/autoInference";

// /**
//  * [v3.33] 모바일 가독성(호흡) 및 테이블 규격 강제화 프롬프트 엔진
//  */
// export function generateBlogPrompt(input: BlogPostInput): string {
//   const persona = input.persona;
//   const tone = input.tone;

//   // 1. 설정값 가져오기
//   const toneInstruction = getToneInstruction(tone);
//   const personaDetail = getPersonaDetail(persona);
//   const examples = getPersonaExamples(persona);
//   const metrics = getQualityMetrics(persona);

//   const targetAudience = inferTargetAudience(input.topic, persona);
//   const contentGoal = inferContentGoal(persona);

//   // 2. 뉴스 데이터 지침
//   let newsInstruction = "";
//   if (input.latestNews) {
//     newsInstruction = `
// # 📰 실시간 정보 (Source Material)
// 아래 정보를 바탕으로 글을 작성하되, **반드시 한국어로 자연스럽게 번역/가공**하세요.
// - **🚨 절대 금지**: 문장 끝에 \`(출처)\`, \`[1]\` 등을 붙이지 마세요. 본문에 녹여내세요.
// ${input.latestNews}
// `;
//   }

//   // 3. 리스트 감지 로직
//   const listPriorityInstruction = input.topic.includes("리스트")
//     ? `
// ## 📋 [CRITICAL] 리스트 중심 구성 (Listicle Structure)
// - 주제 특성상 서술형보다는 **불렛 포인트(Bullet Points)** 위주로 작성해야 합니다.
// - 정보의 계층(Depth)을 명확히 하세요. (예: 항목 > 특징 > 혜택)
// `
//     : "";

//   // ✅ 4. [NEW] 모바일 가독성 절대 규칙 (Mobile Breathing Rule)
//   // AI가 문단을 통으로 뱉는 것을 방지하기 위한 강력한 제약 조건
//   const mobileReadability = `
// ## 📱 [CRITICAL] 모바일 가독성 절대 규칙 (Mobile First Writing)
// 이 글은 100% 모바일 사용자가 읽습니다. **"벽돌 같은 텍스트(Wall of Text)"는 즉시 이탈을 부릅니다.** 아래 규칙을 어길 시 글 생성을 실패로 간주합니다.

// 1.  **호흡 끊기 (Chunking)**:
//     - 절대로 4문장 이상을 한 문단에 이어 쓰지 마세요.
//     - **2~3문장(최대 150자)**이 모이면 무조건 줄을 바꾸세요(Line Break).
//     - 문단 사이에는 반드시 **빈 줄(Enter 2번)**을 넣어 시각적 여백을 확보하세요.
// 2.  **시각적 리듬**:
//     - 독자가 스크롤을 멈추지 않도록 짧고 간결한 문장을 사용하세요.
//     - 접속사(그리고, 하지만 등)로 문장을 길게 늘이지 말고, 단문으로 끊으세요.
// `;

//   // ✅ 5. 테이블 모바일 최적화 절대 규칙
//   const tableRule = `
// ## 📊 [CRITICAL] 표(Table) 작성 절대 규칙 (Mobile First)
// 모바일 화면 폭(360px)을 고려하여 아래 규칙을 엄수하세요.

// 1.  **생성 여부**: ${metrics.tableRequired ? "**반드시 1개 이상 포함**" : "내용 비교/요약이 필요할 때만 사용"}
// 2.  **컬럼(열) 제한**: **최대 3열(Column)**까지만 허용합니다. (4열 이상 금지)
// 3.  **텍스트 제한**: 각 셀(Cell)은 **최대 15자 이내의 '핵심 키워드'**로만 채우세요.
//     - ❌ 나쁜 예: "이 제품은 배터리가 오래 가서 좋습니다." (서술형 절대 금지)
//     - ⭕ 좋은 예: "배터리 효율 우수" (단답형)
// 4.  **목적**: 독자가 1초 만에 훑어볼 수 있는 **요약/비교용**으로만 사용하세요.
// `;

//   // 6. 톤앤매너 & 페르소나 가이드
//   const styleGuide = `
// # 🎭 문체 및 화법 가이드 (Voice & Tone)

// ## 🎵 1. 기본 톤(Tone) 설정: [${tone.toUpperCase()}]
// ${toneInstruction}
// (위 톤 설정에 정의된 '종결어미'와 '피해야 할 표현'을 1순위로 준수하세요.)

// ## ✍️ [CRITICAL] 작문 스타일 및 문체 지시 (Anti-Machine)
// 당신은 기계적인 AI가 아닌, 독자의 몰입을 이끌어내는 **전문 칼럼니스트**입니다.
// 1. **시각적 구조화(Data Visualization)**:
//    - 통계 수치(%), 비교 데이터, 단계별 목록 등이 포함된 내용은 **절대 서술형 문단으로 쓰지 마세요.**
//    - 반드시 **마크다운 리스트(\`-\`)** 또는 **표(Table)**를 사용하여 독자가 3초 안에 핵심을 파악하게 하세요.
// 2. **리듬감(Rhythm)**: 모든 문장의 길이가 비슷하면 글이 지루해집니다. [단문 - 단문 - 장문] 또는 [장문 - 단문] 식으로 문장 길이를 극단적으로 섞으세요.
// 3. **패턴 파괴(Pattern Breaking)**:
//    - '~다', '~죠', '~요' 등 어떤 종결 어미든 **3번 이상 연속으로 같은 계열을 쓰면 실패**로 간주합니다.
//    - 문단 중간에 호흡을 끊어주는 짧은 문장을 배치하세요.
// ${personaDetail.writingTips ? personaDetail.writingTips.map(tip => `- ${tip}`).join('\n') : ''}

// ## 🗣️ 2. 페르소나 역할: [${personaDetail.role}]
// 당신은 **${personaDetail.role}**입니다. 기본 톤을 유지하되, 위 작문 스타일을 섞으세요.

// ### 🚫 [CRITICAL] 절대 금지 표현 (Prohibited)
// 아래 리스트에 포함된 표현이나 말투를 단 하나라도 사용할 경우, 글의 신뢰도가 무너집니다. **절대로 사용하지 마세요.**
// ${personaDetail.forbidden.map((f) => `- **${f}**`).join("\n")}
// `.trim();

//   // 7. 품질 및 구조 가이드 (위에서 정의한 규칙 통합)
//   const qualityGuide = `
// # 📏 품질 및 구조 가이드라인 (Structure Rules)
// - **목표 글자 수**: ${metrics.targetLength[0]} ~ ${metrics.targetLength[1]}자
// - **소제목 개수**: 정확히 ${metrics.headingCount}개
// ${mobileReadability}
// ${tableRule}
// - **이모지 사용**: **${metrics.emojiUsage}** 모드
// - **이미지**: 본문에 이미지 태그 절대 금지
// `.trim();

//   // 8. SEO 규칙
//   const seoGuide = `
// # 🔍 SEO 최적화 (Technical Rules)
// - **메타 제목**: ${SEO_RULES.metaTitleLength[0]}~${SEO_RULES.metaTitleLength[1]}자
// - **메타 설명**: ${SEO_RULES.metaDescriptionLength[0]}~${SEO_RULES.metaDescriptionLength[1]}자
// - **키워드 배치**: 포커스 키워드 "${input.keywords?.join(", ") || input.topic}"를 3~5회 자연스럽게 포함
// `.trim();

//   const mission = `
// # 🎯 최종 미션
// 주제 **"${input.topic}"**에 대해 위 규칙들을 완벽히 결합하여 블로그 포스팅을 작성하세요.

// ## ⚠️ [ULTRA CRITICAL] 본문(content) 구성 주의사항
// - **도입부 필수**: 본문 시작 시 바로 소제목(\`##\`)부터 나오지 마세요. 반드시 **글의 배경이나 흥미를 유발하는 도입 문단(Intro)**을 2~3문장 작성한 후 첫 번째 소제목을 시작하세요.
// - **제목 중복 금지**: \`content\` 필드 내부에 제목(\`# 제목\`)을 다시 쓰지 마세요. 제목은 시스템이 별도로 처리합니다.
// - **메타 정보 금지**: 아웃라인, 키워드, 태그 등을 \`content\` 필드에 텍스트로 포함하지 마세요. 오직 마크다운 본문만 들어갑니다.

// ## 👥 타겟 독자
// - **독자**: ${targetAudience}
// - **목표**: ${contentGoal}

// ## 📤 출력 형식 (JSON Only)
// \`\`\`json
// {
//   "title": "클릭을 부르는 매력적인 제목",
//   "outline": ["소제목1", "소제목2", ...],
//   "content": "마크다운 본문 내용...",
//   "metaTitle": "SEO 메타 제목",
//   "metaDescription": "SEO 메타 설명",
//   "focusKeywords": ["키워드1", "키워드2"],
//   "references": [{"name": "매체명", "url": "..."}]
// }
// \`\`\`
// `.trim();

//   return `
// ${newsInstruction}
// ${styleGuide}
// ${qualityGuide}
// ${seoGuide}
// ${listPriorityInstruction}
// ${mission}
// `.trim();
// }
