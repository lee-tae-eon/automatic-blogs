import { TavilyService } from "./tavilyService";
import { KeywordScoutService, KeywordAnalysis } from "./KeywordScoutService";

export interface RecommendedTopic {
  keyword: string;
  analysis: KeywordAnalysis;
  sourceUrl: string;
  title: string;
}

export class TrendTopicRecommenderService {
  constructor(
    private tavilyService: TavilyService,
    private keywordScoutService: KeywordScoutService
  ) {}

  /**
   * 실시간 트렌드로부터 포스팅하기 좋은 황금 키워드를 추천합니다.
   * @param region 'korea' 또는 'hollywood'
   * @param limit 추천할 키워드 개수
   */
  async recommendTrendTopics(region: "korea" | "hollywood" = "korea", limit: number = 3): Promise<RecommendedTopic[]> {
    console.log(`🌟 [Trend] '${region}' 지역 실시간 트렌드 분석 및 키워드 추천 시작...`);

    // 1. 실시간 트렌드 검색
    const trends = region === "korea" 
      ? await this.tavilyService.fetchTrendingKorea() 
      : await this.tavilyService.fetchTrendingHollywood();

    if (!trends || trends.length === 0) {
      console.warn("⚠️ [Trend] 트렌드 데이터를 가져오지 못했습니다.");
      return [];
    }

    const recommendations: RecommendedTopic[] = [];

    // 2. 검색된 트렌드 제목에서 키워드 추출 및 분석 (상위 5개 우선 분석)
    for (const trend of trends.slice(0, 5)) {
      // 제목에서 핵심 키워드 추출 (단순화를 위해 제목 그대로 사용하거나 핵심 구문 추출)
      const seedKeyword = this.extractMainKeyword(trend.title);
      
      // 3. 해당 키워드로 황금 키워드 탐색
      const result = await this.keywordScoutService.findGoldenKeywords(seedKeyword, 3);
      
      if (result.goldenKeywords.length > 0) {
        // 가장 점수가 높은 키워드 선택
        const bestKw = result.goldenKeywords[0];
        recommendations.push({
          keyword: bestKw.keyword,
          analysis: bestKw,
          sourceUrl: trend.url,
          title: trend.title
        });
      }
    }

    // 4. 최종 점수 순 정렬 후 제한된 개수만큼 반환
    return recommendations
      .sort((a, b) => b.analysis.score - a.analysis.score)
      .slice(0, limit);
  }

  /**
   * 뉴스 제목 등에서 핵심 키워드를 추출합니다.
   * (현재는 단순화를 위해 제목에서 불필요한 문자를 제거하는 수준)
   */
  private extractMainKeyword(title: string): string {
    return title
      .replace(/\[.*?\]/g, "") // 대괄호 제거
      .replace(/["'“”‘’]/g, "") // 따옴표 제거
      .split("|")[0] // 구분자 이후 제거
      .split("-")[0]
      .trim()
      .slice(0, 20); // 너무 길면 자름
  }
}
