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
      당신은 10년차 전문 블로거이자 트렌드 분석가입니다. 
      주어진 주제를 바탕으로 네이버 블로그에서 실제 검색 수요가 있고 상위 노출 가능성이 높은 '황금 키워드' 10개를 발굴하세요.

      [주제]: ${broadTopic}

      [발굴 지침]:
      1. **맥락 유지 (가장 중요)**: 주제에 특정 인물, 브랜드, 사건이 포함되어 있다면 그 핵심 대상을 절대 변경하거나 엉뚱한 동음이의어(예: 인물 -> 기업)로 확장하지 마세요.
      2. **연도 사용 자제**: '${currentYear}'는 꼭 필요한 경우(예: 신년 전망, 최신 정책 등)에만 사용하세요. 모든 키워드에 기계적으로 연도를 붙이는 것은 금지입니다.
      3. **검색 의도 다양화**: 정보성(How-to), 리뷰(체험), 최신 이슈(News) 등 독자들이 실제로 검색창에 입력할 법한 구체적인 롱테일 키워드를 생성하세요.
      4. **품질 중심**: 단순히 키워드 나열이 아니라, 블로그 포스팅 주제로 바로 사용할 수 있을 만큼 매력적이고 구체적이어야 합니다.

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
