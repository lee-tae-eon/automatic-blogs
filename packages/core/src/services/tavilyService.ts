import axios from "axios";

export class TavilyService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.tavily.com/search";

  constructor() {
    this.apiKey = (process.env.VITE_TAVILY_API_KEY || "").trim();
  }

  async searchLatestNews(query: string, timeRange: "day" | "week" | "month" | "year" = "week"): Promise<{ context: string; rawResults: { name: string; url: string }[] }> {
    try {
      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query: query,
        search_depth: "basic", // [v12.5] 속도 개선을 위해 basic으로 하향 조정
        max_results: 3,
        include_images: false,
        include_raw_content: true // 본문 전체 텍스트 포함
        // time_range 제거 (432 에러 방지)
      });

      const results = response.data.results || [];

      // AI가 읽기 좋게 출처와 본문을 문자열로 가공 (raw_content 우선 사용)
      const context = results
        .map(
          (r: any, i: number) => {
            const bodyContent = r.raw_content || r.content || "내용 없음";
            // 너무 긴 경우 AI 토큰 제한을 고려해 약 3000자 정도로 제한 (필요시 조절)
            const truncatedContent = bodyContent.length > 3000 ? bodyContent.slice(0, 3000) + "..." : bodyContent;
            return `[참고자료 ${i + 1}] 제목: ${r.title}\n내용: ${truncatedContent}\n출처: ${r.url}`;
          },
        )
        .join("\n\n");

      return {
        context,
        rawResults: results.map((r: any) => ({ name: r.title, url: r.url }))
      };
    } catch (error) {
      console.error("❌ Tavily 검색 중 오류:", error);
      return { context: "", rawResults: [] };
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
        search_depth: "basic", // [v12.5] 속도 개선을 위해 basic으로 하향 조정
        max_results: 8
        // time_range: "day" 제거 (432 에러 방지)
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
        search_depth: "basic", // [v12.5] 속도 개선을 위해 basic으로 하향 조정
        max_results: 8
        // time_range: "day" 제거 (432 에러 방지)
      });
      return response.data.results;
    } catch (error) {
      console.error("❌ 한국 트렌드 검색 실패:", error);
      return [];
    }
  }

  /**
   * 주제와 관련된 최신/인기 유튜브 영상 정보를 검색합니다.
   * [v11.0] 검색 품질 개선: 쿼리 유연화 및 상위 후보군 추출 (AI 검증용)
   */
  async searchYoutubeVideo(topic: string): Promise<{ title: string; url: string }[]> {
    try {
      // [v11.0] 쿼리 유연화: 너무 구체적인 키워드보다는 핵심 주제 위주로 검색
      const query = `site:youtube.com ${topic} 최신 정보 리뷰 가이드`;
      
      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query: query,
        max_results: 15 // 충분한 후보군 확보
      }, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000
      });

      const results = response.data.results || [];
      console.log(`🎬 [Tavily YouTube] 전체 결과 ${results.length}개 중 유효 영상 필터링 중...`);

      // 1. 유튜브 URL 정밀 필터링 및 제목 정제
      const validVideos = results
        .filter((r: any) => 
          r.url.toLowerCase().includes("youtube.com/watch") || 
          r.url.toLowerCase().includes("youtu.be/") ||
          r.url.toLowerCase().includes("youtube.com/v/")
        )
        .map((v: any) => ({
          title: v.title.replace(/<[^>]*>?/gm, "").trim(),
          url: v.url
        }))
        .slice(0, 3); // 상위 3개만 후보로 선정

      if (validVideos.length > 0) {
        console.log(`✅ [Tavily YouTube] ${validVideos.length}개의 유효 후보 영상 발견`);
        return validVideos;
      }
      return [];
    } catch (error: any) {
      console.error(`❌ [Tavily YouTube] 검색 실패: ${error.message}`);
      return [];
    }
  }
}
