import { GeminiClient } from "../ai/geminiClient";

export interface ExpandedKeyword {
  keyword: string;
  intent: string; // 검색 의도 (정보성, 상업성 등)
  reason: string; // 왜 이 키워드를 추천하는지
}

export class TopicExpanderService {
  constructor(private aiClient: GeminiClient) {}

  /**
   * 상위 주제(Seed)를 바탕으로 블로그로 쓰기 좋은 전략적 토픽 10개를 확장합니다.
   * 단순히 키워드 나열이 아닌, 검색 사용자가 궁금해할 '맥락'과 '각도'를 중심으로 확장합니다.
   */
  async expandTopic(broadTopic: string): Promise<ExpandedKeyword[]> {
    const currentYear = new Date().getFullYear();
    const prompt = `
      당신은 10년차 전문 블로거이자 검색 최적화 전략가입니다. 
      주어진 주제를 분석하여 네이버 블로그에서 독자들이 클릭할 수밖에 없는 '전략적 토픽' 10개를 발굴하세요.

      [주제]: ${broadTopic}

      [발굴 전략 - 반드시 아래 5가지 각도를 골고루 섞으세요]:
      1. **심층 분석 (Deep Dive)**: 겉으로 드러나지 않은 본질이나 상세한 원리 설명
      2. **실전 꿀팁 (Practical Tips)**: 독자가 바로 따라할 수 있는 구체적인 가이드나 체크리스트
      3. **최신 화제 (Hot Issues)**: 현재 시점에서 논란이 되거나 실시간으로 궁금해하는 정보
      4. **비교/대안 (Comparison)**: 기존 방식과의 차이점이나 가성비 좋은 대안 제시
      5. **숨은 인사이트 (Hidden Insight)**: 남들이 다 아는 얘기가 아닌, 독특한 시선이나 비하인드 스토리

      [지침]:
      - **다양성 극대화**: 모든 토픽이 비슷하면 안 됩니다. 주제를 관통하는 10가지 서로 다른 이야기 거리를 만드세요.
      - **연도 사용**: 꼭 필요한 경우(예: 신년 전망)에만 '${currentYear}'를 사용하세요.
      - **언어**: 반드시 한국어로 응답하세요.

      [출력 형식]: 반드시 아래 JSON 배열 형식으로만 응답하세요.
      [
        { "keyword": "사용자가 검색할만한 구체적 키워드", "intent": "정보/리뷰/이슈 중 하나", "reason": "이 토픽이 왜 독자에게 매력적인지에 대한 전략적 이유" }
      ]
    `;

    try {
      const results = await this.aiClient.generateJson<ExpandedKeyword[]>(prompt);
      return results;
    } catch (error) {
      console.error("Topic Expansion Error:", error);
      return [];
    }
  }
}
