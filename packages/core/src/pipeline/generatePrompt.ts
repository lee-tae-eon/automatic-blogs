// ============================================
// 통합 블로그 프롬프트 생성기

import { getPersonaDetail } from "@/persona/persona.config";
import { getPersonaExamples } from "@/persona/persona.example";
import { getQualityMetrics, SEO_RULES } from "@/persona/quality-metrics";
import { BlogPostInput } from "@/types/blog";
import { autoInferMetadata } from "@/util/autoInference";

// ============================================
export function generateBlogPrompt(input: BlogPostInput): string {
  // 단일 페르소나 처리 (하이브리드는 추후 확장)
  const persona = input.persona;

  // ==========================================
  // 자동 추론 시스템 적용
  // ==========================================
  const autoInferred = autoInferMetadata(input.topic, persona);

  // 사용자 입력이 있으면 우선, 없으면 자동 추론값 사용
  const keywords = input.keywords || autoInferred.keywords;
  const targetAudience = autoInferred.targetAudience;
  const contentGoal = autoInferred.contentGoal;

  const personaDetail = getPersonaDetail(persona);
  const examples = getPersonaExamples(persona);
  const metrics = getQualityMetrics(persona);

  // ==========================================
  // 1. 시스템 역할 정의
  // ==========================================
  const systemRole = `
# 🎭 역할 정의
당신은 **${personaDetail.role}**입니다.

## 핵심 원칙
${personaDetail.principle}

## 문체 및 스타일
${personaDetail.style}

## 현재 날짜
${new Date().toLocaleDateString("ko-KR")} - 최신 정보를 반영하세요.

## 전문 분야
${input.topic}
`.trim();

  // ==========================================
  // 2. 페르소나별 상세 가이드
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
`.trim();

  // ==========================================
  // 3. 좋은 예시 / 나쁜 예시
  // ==========================================
  const examplesGuide = `
# ✅ 좋은 문장 예시 (이렇게 작성하세요)
${examples.goodSentences
  .slice(0, 5)
  .map((s, i) => `${i + 1}. "${s}"`)
  .join("\n")}

# ❌ 나쁜 문장 예시 (절대 사용 금지)
${examples.badSentences.map((s, i) => `${i + 1}. "${s}"`).join("\n")}

# 🔄 문단 전환 예시
${examples.transitions
  .slice(0, 3)
  .map((s, i) => `${i + 1}. "${s}"`)
  .join("\n")}
`.trim();

  // ==========================================
  // 4. 레이아웃 및 포맷 규칙
  // ==========================================
  const layoutRules = `
# 🎨 레이아웃 및 포맷 규칙

## 소제목 구성
- **개수**: 정확히 **${metrics.headingCount}개**
- **형식**: 반드시 \`\\n> ## 소제목명\` 형식 사용
- **규칙**:
  1. 소제목 앞에는 줄바꿈 **한 번(\\n)**만 삽입
  2. 소제목 기호(\`> ##\`)와 텍스트 사이 **한 칸 공백** 필수
  3. 이모지는 ${
    metrics.emojiUsage === "minimal"
      ? "최소화 (소제목당 0~1개)"
      : metrics.emojiUsage === "moderate"
        ? "적절히 (소제목당 1개)"
        : "활발히 (소제목당 1~2개)"
  } 사용

## 문장 및 문단 길이
- **문장**: 최대 **${metrics.sentenceMaxLength}자** 이하
- **문단**: 최대 **${metrics.paragraphMaxLength}자** 이하
- **가독성**: 2~3문장마다 빈 줄 삽입 (모바일 최적화)

## 시각적 요소
- **표(Table)**: ${metrics.tableRequired ? "**필수** (비교/분석 데이터)" : "선택 (필요시에만)"}
- **강조**: 핵심 키워드는 **볼드 처리**
- **구분선**: 각 소제목 섹션 상단에 \`---\` 삽입
- **이미지**: 약 ${metrics.imageCount}개 위치 제안

## 예상 글자 수
${metrics.targetLength[0]}자 ~ ${metrics.targetLength[1]}자
`.trim();

  // ==========================================
  // 5. SEO 최적화 규칙
  // ==========================================
  const seoRules = `
# 🔍 SEO 최적화 규칙

## 키워드 사용
- **주요 키워드**: ${keywords.join(", ")}
- **키워드 밀도**: ${metrics.keywordDensity[0]}% ~ ${metrics.keywordDensity[1]}%
- **첫 문단**: 반드시 주요 키워드 포함
- **소제목**: 5개 중 최소 3개에 키워드 포함

## 메타 정보
- **메타 제목**: ${SEO_RULES.metaTitleLength[0]}~${SEO_RULES.metaTitleLength[1]}자
- **메타 설명**: ${SEO_RULES.metaDescriptionLength[0]}~${SEO_RULES.metaDescriptionLength[1]}자
- **포커스 키워드**: ${SEO_RULES.focusKeywordCount[0]}~${SEO_RULES.focusKeywordCount[1]}개 선정
`.trim();

  // ==========================================
  // 6. 작성 미션 및 출력 형식
  // ==========================================
  const mission = `
# 🎯 작성 미션
"${input.topic}" 주제로 ${persona} 페르소나 블로그 포스트를 작성하세요.

## 📌 자동 분석 결과
- **타겟 독자**: ${targetAudience}
- **콘텐츠 목표**: ${contentGoal}
- **주제 특성**: ${
    autoInferred.topicIntent.isReview
      ? "리뷰형"
      : autoInferred.topicIntent.isHowTo
        ? "가이드형"
        : autoInferred.topicIntent.isComparison
          ? "비교형"
          : autoInferred.topicIntent.isOpinion
            ? "의견형"
            : "정보형"
  }

## ✅ 최종 체크리스트
- [ ] 소제목은 정확히 ${metrics.headingCount}개이며 \`\\n> ## 소제목\` 형식을 지켰는가?
- [ ] 금지 표현(${personaDetail.forbidden.slice(0, 2).join(", ")})을 사용하지 않았는가?
- [ ] 좋은 예시 문장 스타일을 따랐는가?
- [ ] 문장은 ${metrics.sentenceMaxLength}자 이하인가?
- [ ] ${metrics.tableRequired ? "비교 표를 포함했는가?" : ""}
- [ ] 키워드가 자연스럽게 ${metrics.keywordDensity[0]}% 이상 포함되었는가?

## 📤 출력 형식 (순수 JSON만)
\`\`\`json
{
  "title": "매력적인 제목 (${SEO_RULES.metaTitleLength[0]}~${SEO_RULES.metaTitleLength[1]}자)",
  "outline": ["소제목1", "소제목2", "소제목3", "소제목4", "소제목5"],
  "content": "본문 내용 (마크다운 형식, \\n으로 줄바꿈)",
  "metaTitle": "SEO 최적화 제목",
  "metaDescription": "SEO 설명 (${SEO_RULES.metaDescriptionLength[0]}~${SEO_RULES.metaDescriptionLength[1]}자)",
  "focusKeywords": ["키워드1", "키워드2", "키워드3"],
  "estimatedReadTime": 5
}
\`\`\`

**중요**: 응답은 **오직 순수한 JSON 형식만** 허용하며, 줄바꿈은 \`\\n\` 기호로 처리하세요.
`.trim();

  // ==========================================
  // 최종 프롬프트 조합
  // ==========================================
  return `
${systemRole}

${personaGuide}

${examplesGuide}

${layoutRules}

${seoRules}

${mission}
`.trim();
}
