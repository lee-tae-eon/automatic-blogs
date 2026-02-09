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
    const prompt = `
      당신은 10년차 전문 블로거이자 마케팅 전략가입니다. 
      다음 주어진 주제와 관련하여, 네이버 블로그에서 '황금 키워드'(검색량은 많지만 경쟁이 적거나, 상위 노출 시 수익성이 높은 키워드) 10개를 발굴하세요.

      [주제]: ${broadTopic}

      [발굴 규칙]:
      1. 사람들이 실제로 궁금해할 만한 구체적인 질문 형태나 '정보성' 키워드 위주로 선정하세요.
      2. 단순한 단어보다는 '롱테일 키워드'(3단어 이상의 조합)를 선호합니다.
      3. 현재 트렌드나 시즌성에 맞는 주제를 포함하세요.

      [출력 형식]: 반드시 아래 JSON 배열 형식으로만 응답하세요.
      [
        { "keyword": "키워드", "intent": "의도", "reason": "선정이유" },
        ...
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
