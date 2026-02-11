import { Tone } from "../types/blog";

export interface ToneConfig {
  description: string;
  ending: string;
}

// 톤은 복잡한 형용사가 아니라 '말투(Ending)'를 결정하는 요소로 단순화
export const TONE_CONFIG: Record<Tone, ToneConfig> = {
  // 1. 분석가 (The Analyst) - 하십시오체
  professional: {
    description: "감정을 배제하고 팩트 위주로 건조하게 전달",
    ending: "하십시오체 (~입니다, ~합니다) 위주. '저는', '제 생각엔' 같은 주관적 표현 배제.",
  },

  // 2. 리뷰어 (The Reviewer) - 해요체
  incisive: { // 기존 코드 호환을 위해 incisive 키 유지 (실제 역할: Friendly Reviewer)
    description: "옆집 언니/형이 말해주듯 친근하고 솔직한 화법",
    ending: "해요체 (~에요, ~거든요). 짧은 문장 위주. 가끔 'ㅋㅋ', 'ㅠㅠ' 허용.",
  },

  // 3. 리포터 (The Reporter) - 평어체/간결체
  serious: { 
    description: "뉴스 속보를 전달하듯 빠르고 간결한 화법",
    ending: "기본적으로 '~습니다'를 사용하여 신뢰감을 주되, 독자와의 소통이나 부드러운 흐름이 필요할 때는 '~요'를 허용.",
  },

  // 4. 공감형 (The Human) - 해요체/네체
  empathetic: {
    description: "독자의 마음에 공감하고 아쉬움이나 기쁨을 함께 나누는 따뜻한 화법",
    ending: "부드러운 해요체 (~요, ~네요) 위주. 감성적인 단어(아쉽게도, 다행히도, 마음이 무겁네요 등) 사용 권장.",
  },
};

export const getToneInstruction = (tone: Tone): string => {
  const config = TONE_CONFIG[tone];
  return `**어조(Tone)**: ${config.description}\n**종결어미**: ${config.ending}`;
};

export const ALL_TONES = Object.keys(TONE_CONFIG) as Tone[];