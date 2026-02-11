import { Persona, PersonaExamples } from "../types/blog";

export const PERSONA_EXAMPLES: Record<Persona, PersonaExamples> = {
  informative: {
    goodSentences: [
      "2026년 기준 시장 점유율은 35%에 달하며, 이는 전년 대비 12% 상승한 수치입니다.",
      "핵심 데이터를 표로 정리하면 다음과 같은 특징이 명확히 드러납니다.",
    ],
    badSentences: ["제 생각에는 대충 좋아진 것 같은 느낌이 듭니다.", "아마도 잘 될 거예요."],
    transitions: ["데이터를 분석해보면", "수치로 증명된 사실은", "결론적으로"],
  },
  experiential: {
    goodSentences: [
      "솔직히 처음 받았을 때는 디자인이 좀 투박하다고 생각했어요. 근데 써보니 다르더라고요.",
      "2주 동안 매일 사용해본 결과, 가장 큰 장점은 배터리 성능이었습니다.",
    ],
    badSentences: ["본 제품은 사양이 우수하며 배송이 빠릅니다.", "구매를 추천드리는 바입니다."],
    transitions: ["실제로 써보니", "한 일주일 지나니까", "의외의 꿀팁은"],
  },
  reporter: {
    goodSentences: [
      "속보입니다. 방금 들어온 소식에 따르면 이번 사건의 핵심 쟁점은 세 가지로 정리되네요.",
      "현장 여론은 생각보다 차가웠습니다. 따옴표를 빌려 현장의 생생한 목소리를 전해 드릴게요.",
      "직접 확인해보니 상황이 꽤 심각하더라고요. 우리가 놓치면 안 될 포인트가 여기 있습니다.",
    ],
    badSentences: ["옛날 옛적에 어느 마을에 이슈가 살았습니다.", "본 기자는 다음과 같이 보도하는 바입니다."],
    transitions: ["현장 상황을 더 자세히 보여드릴게요", "여기서 반전이 일어납니다", "결국 핵심은 이겁니다"],
  },
};

export const getPersonaExamples = (persona: Persona): PersonaExamples => {
  return PERSONA_EXAMPLES[persona] || PERSONA_EXAMPLES.informative;
};