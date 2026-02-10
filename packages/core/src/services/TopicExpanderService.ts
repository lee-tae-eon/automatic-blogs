import { GeminiClient } from "../ai/geminiClient";

export interface ExpandedKeyword {
  keyword: string;
  intent: string; // 검색 의도 (정보성, 상업성 등)
  reason: string; // 왜 이 키워드를 추천하는지
}

export class TopicExpanderService {
  constructor(private aiClient: GeminiClient) {}

  /**
   * 상위 주제(Seed)를 바탕으로 블로그로 쓰기 좋은 황금 키워드 10개를 확장합니다.
   */
  async expandTopic(broadTopic: string): Promise<ExpandedKeyword[]> {
    const currentYear = new Date().getFullYear();
    const prompt = `
      당신은 10년차 전문 블로거이자 마케팅 전략가입니다. 
      **현재 시점은 ${currentYear}년 2월**입니다. 당신은 지금 이 순간의 최신 트렌드와 정보를 완벽히 파악하고 있습니다.

      다음 주어진 주제와 관련하여, 네이버 블로그에서 상위 노출될 수 있는 '황금 키워드' 10개를 발굴하세요.

      [주제]: ${broadTopic}

      [발굴 규칙]:
      1. **컨텐츠의 최신성**: 2024년, 2025년의 낡은 정보가 아닌, **지금(2026년) 바로 써먹을 수 있는 유효한 주제**여야 합니다.
      2. **자연스러운 키워드**: 모든 키워드에 '${currentYear}'를 붙이지 마세요. 꼭 필요한 경우(예: 전망, 정책 등)가 아니면 연도 없이 자연스러운 핵심 키워드로 구성하세요.
      3. **과거 정보 배제**: 이미 지나간 이벤트나 낡은 데이터와 관련된 키워드는 무조건 제외하세요.
      4. 사람들이 궁금해할 만한 구체적인 질문이나 '정보성' 롱테일 키워드 위주로 선정하세요.

      [출력 형식]: 반드시 아래 JSON 배열 형식으로만 응답하세요.
      [
        { "keyword": "키워드", "intent": "의도", "reason": "선정이유" }
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
