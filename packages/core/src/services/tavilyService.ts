import axios from "axios";

export class TavilyService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.tavily.com/search";

  constructor() {
    this.apiKey = (process.env.VITE_TAVILY_API_KEY || "").trim();
  }

  async searchLatestNews(query: string) {
    try {
      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query: `${query} 최신 뉴스 팩트`,
        search_depth: "advanced", // 사실 관계 확인을 위해 advanced 권장
        max_results: 3, // 건당 3개면 충분
        include_images: false, // 우리는 Pexels를 따로 쓰니까 false
      });

      // AI가 읽기 좋게 출처와 본문을 문자열로 가공
      return response.data.results
        .map(
          (r: any, i: number) =>
            `[뉴스 ${i + 1}] 제목: ${r.title}\n내용: ${r.content}\n출처: ${r.url}`,
        )
        .join("\n\n");
    } catch (error) {
      console.error("❌ Tavily 검색 중 오류:", error);
      return ""; // 에러 시 빈 문자열 반환하여 기존 로직 유지
    }
  }

  /**
   * 실시간 헐리우드 핫이슈를 검색하여 원문 리스트를 반환합니다.
   * @param customQuery - 특정 배우나 주제가 있을 경우 해당 키워드로 검색
   */
  async fetchTrendingHollywood(customQuery?: string) {
    try {
      const query = customQuery 
        ? `${customQuery} Hollywood celebrity news gossip trending today`
        : "top trending Hollywood celebrity gossip news today tmz people dailymail";

      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query,
        search_depth: "basic",
        max_results: 8,
      });
      return response.data.results;
    } catch (error) {
      console.error("❌ 헐리우드 트렌드 검색 실패:", error);
      return [];
    }
  }

  /**
   * 실시간 한국 핫이슈를 검색하여 원문 리스트를 반환합니다.
   * @param customQuery - 특정 주제가 있을 경우 해당 키워드로 검색
   */
  async fetchTrendingKorea(customQuery?: string) {
    try {
      const query = customQuery
        ? `${customQuery} 대한민국 오늘 실시간 인기 이슈 뉴스 트렌드`
        : "오늘 대한민국 실시간 인기 검색어 핫이슈 뉴스 트렌드 커뮤니티 반응";

      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query,
        search_depth: "basic",
        max_results: 8,
      });
      return response.data.results;
    } catch (error) {
      console.error("❌ 한국 트렌드 검색 실패:", error);
      return [];
    }
  }
}
