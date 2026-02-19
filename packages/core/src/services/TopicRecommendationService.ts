import { GeminiClient } from "../ai/geminiClient";
import { RssService } from "./RssService";
import { TavilyService } from "./tavilyService";

export interface RecommendedTopic {
  keyword: string;
  category: string;
  reason: string;
  source: string;
  hotness: number; // 1-100
}

export type RecommendCategory = "tech" | "economy" | "entertainment" | "life" | "travel";

export const CATEGORY_MAP: Record<RecommendCategory, string> = {
  tech: "IT/테크",
  economy: "경제/비즈니스",
  entertainment: "연예/방송",
  life: "생활/건강",
  travel: "여행/맛집",
};

export class TopicRecommendationService {
  private rssService = new RssService();
  private tavilyService = new TavilyService();

  constructor(private aiClient: GeminiClient) {}

  /**
   * 모든 카테고리에 대한 추천 토픽을 가져옵니다.
   */
  async getAllRecommendations(): Promise<Record<string, RecommendedTopic[]>> {
    const categories = Object.keys(CATEGORY_MAP) as RecommendCategory[];
    const results: Record<string, RecommendedTopic[]> = {};

    await Promise.all(
      categories.map(async (cat) => {
        results[cat] = await this.getRecommendationsByCategory(cat);
      })
    );

    return results;
  }

  /**
   * 특정 카테고리의 핫 토픽 10개를 가져옵니다.
   */
  async getRecommendationsByCategory(category: RecommendCategory): Promise<RecommendedTopic[]> {
    try {
      console.log(`📡 [TopicRec] '${CATEGORY_MAP[category]}' 트렌드 수집 중...`);
      
      // 1. 데이터 소스 수집 (RSS + Tavily)
      let rawData = "";
      
      if (category === "entertainment" || category === "economy") {
        // 연예나 경제는 RSS(Google Trends)가 매우 빠름
        const rssTrends = await this.rssService.fetchTrendingTopics("KR");
        rawData = rssTrends.map(t => t.title).join(", ");
      } else {
        // 테크, 생활, 여행은 Tavily 검색 시도, 실패 시 RSS로 대체
        try {
          const searchResult = await this.tavilyService.searchLatestNews(`${CATEGORY_MAP[category]} 최신 트렌드 이슈`);
          rawData = searchResult.context;
        } catch (e) {
          console.warn(`⚠️ [TopicRec] Tavily 검색 실패, RSS로 대체 시도: ${category}`);
          const rssTrends = await this.rssService.fetchTrendingTopics("KR");
          rawData = rssTrends.map(t => t.title).join(", ");
        }
      }

      if (!rawData || rawData.trim().length < 10) {
        throw new Error("분석할 충분한 트렌드 데이터를 수집하지 못했습니다.");
      }

      // 2. AI를 통한 토픽 큐레이션 및 전략 수립
      const prompt = `
        당신은 대한민국 최고의 블로그 콘텐츠 전략가입니다. 
        아래의 원천 데이터를 바탕으로 **'${CATEGORY_MAP[category]}'** 카테고리에서 오늘 블로그로 쓰기 가장 좋은 핫 토픽 10개를 선정하세요.

        [원천 데이터]:
        ${rawData}

        [선정 지침]:
        1. **화제성**: 현재 사람들이 가장 궁금해하고 검색량이 급증하는 주제여야 합니다.
        2. **차별화**: 뻔한 내용이 아니라, 블로거가 자신만의 시각을 더해 상위 노출될 수 있는 '전략적 키워드'로 가공하세요.
        3. **구체성**: 키워드는 블로그 제목으로 바로 써도 될 만큼 구체적이어야 합니다.
        4. **이유 명시**: 왜 이 주제를 오늘 써야 하는지(예: 정부 발표 직후, 커뮤니티 난리 남 등)를 짧고 강렬하게 적으세요.

        [출력 형식]: 반드시 아래 JSON 배열 형식으로만 응답하세요.
        [
          { "keyword": "구체적인 키워드", "reason": "전략적 선정이유", "hotness": 95 }
        ]
      `;

      const curated = await this.aiClient.generateJson<any[]>(prompt);
      
      return curated.map(item => ({
        ...item,
        category: CATEGORY_MAP[category],
        source: "AI Curated",
      }));

    } catch (error) {
      // 에러를 무시하지 않고 상위(main.ts)로 던져서 키 로테이션이 작동하게 함
      throw error;
    }
  }
}
