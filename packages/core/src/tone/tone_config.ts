import { Tone } from "../types/blog";

// ============================================
// 톤 설정 인터페이스
// ============================================
export interface ToneConfig {
  description: string;
  ending: string;
  examples?: string[]; // 좋은 예시 문장
  avoid?: string[]; // 피해야 할 표현
}

// ============================================
// 톤별 상세 설정
// ============================================
export const TONE_CONFIG: Record<Tone, ToneConfig> = {
  professional: {
    description: "신뢰감을 주는 격식 있는 표현과 객관적 데이터 중심의 서술",
    ending: "하십시오체 (~입니다, ~합니다)",
    examples: [
      "2026년 기준 국내 시장 점유율은 35%로, 전년 대비 12% 증가했습니다.",
      "이 방법은 평균 40%의 효율 개선 효과가 입증되었습니다.",
      "연구 결과에 따르면, 해당 기술은 향후 5년간 주류가 될 것으로 전망됩니다.",
    ],
    avoid: ["~것 같아요", "개인적으로 생각하기에", "느낌이 들어요"],
  },

  incisive: {
    description: "사안의 핵심을 찌르는 날카롭고 직설적인 비판적 화법",
    ending: "해요체 또는 하십시오체 (단호한 어조)",
    examples: [
      "단순한 실수가 아닙니다. 이는 명백한 도덕적 해이이자 대중을 기만한 행위입니다.",
      "화려한 겉모습 뒤에 감춰진 이면을 보니 씁쓸함을 감출 수 없습니다.",
      "우리가 분노하는 이유는 그가 가진 부가 아니라, 그 부를 쌓는 과정의 불투명함 때문입니다.",
    ],
    avoid: [
      "~인 것 같기도 해요 (애매한 태도)",
      "혹시 고민 있으세요? (엉뚱한 질문)",
      "함께 이겨내요 (부적절한 격려)",
    ],
  },

  serious: {
    description: "간결하고 힘 있는 문장, 사안의 엄중함을 전달하는 냉철한 태도",
    ending: "하십시오체 또는 하오체",
    examples: [
      "이는 단순한 문제가 아닙니다. 구조적 변화가 필요합니다.",
      "현재 상황은 심각합니다. 즉각적인 대응이 요구됩니다.",
      "결과는 명확합니다. 더 이상 지체할 시간이 없습니다.",
    ],
    avoid: ["~인 것 같아요", "ㅋㅋ, ㅎㅎ (가벼운 표현)", "어쩌면"],
  },
};

// ============================================
// 톤별 프롬프트 지시문 생성
// ============================================
export const getToneInstruction = (tone: Tone): string => {
  const config = TONE_CONFIG[tone];

  const examplesSection =
    config.examples && config.examples.length > 0
      ? `\n\n### ✅ 이 톤으로 쓰는 법 (예시)\n${config.examples.map((ex, i) => `${i + 1}. "${ex}"`).join("\n")}`
      : "";

  const avoidSection =
    config.avoid && config.avoid.length > 0
      ? `\n\n### ❌ 이 톤에서 피할 표현\n${config.avoid.map((av, i) => `${i + 1}. "${av}"`).join("\n")}`
      : "";

  return `
**톤**: ${tone}
**설명**: ${config.description}
**종결어미**: ${config.ending}${examplesSection}${avoidSection}
`.trim();
};

export const ALL_TONES = Object.keys(TONE_CONFIG) as Tone[];
