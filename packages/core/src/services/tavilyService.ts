import axios from "axios";

export class TavilyService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.tavily.com/search";

  constructor() {
    this.apiKey = (process.env.VITE_TAVILY_API_KEY || "").trim();
  }

  async searchLatestNews(query: string): Promise<{ context: string; rawResults: { name: string; url: string }[] }> {
    try {
      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query: query,
        search_depth: "advanced",
        max_results: 3,
        include_images: false,
        include_raw_content: true, // 본문 전체 텍스트 포함
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

  /**
   * 주제와 관련된 최신/인기 유튜브 영상 정보를 검색합니다.
   */
  async searchYoutubeVideo(topic: string): Promise<{ title: string; url: string } | null> {
    try {
      // Tavily API 스펙에 맞춰 요청 구조 정규화
      // 432 에러 방지를 위해 쿼리를 단순화하고 불필요한 연산자 제거 시도
      const cleanTopic = topic.replace(/[^\w\s가-힣]/g, " ").trim();
      const query = `youtube.com ${cleanTopic} official video tips`;
      
      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query: query,
        search_depth: "basic",
        max_results: 5,
        include_domains: ["youtube.com"], // 다시 도메인 포함 시도 (헤더/바디 구조가 맞으면 성공함)
      }, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000
      });

      const results = response.data.results || [];
      // URL에 youtube가 포함된 결과 찾기
      const video = results.find((r: any) => 
        r.url.includes("youtube.com/watch") || 
        r.url.includes("youtu.be/") ||
        r.url.includes("youtube.com/embed")
      );
      
      if (video) {
        return {
          title: video.title.replace(/<[^>]*>?/gm, "").trim(),
          url: video.url
        };
      }
      return null;
    } catch (error: any) {
      // 432 에러 발생 시 도메인 필터 없이 재시도 (Fallback)
      if (error.response?.status === 432) {
        console.warn("⚠️ Tavily 432 Error 감지: 도메인 필터 없이 재시도합니다.");
        try {
          const response = await axios.post(this.baseUrl, {
            api_key: this.apiKey,
            query: `youtube ${topic}`,
            search_depth: "basic",
            max_results: 5
          });
          const results = response.data.results || [];
          const video = results.find((r: any) => r.url.includes("youtube.com") || r.url.includes("youtu.be"));
          if (video) return { title: video.title, url: video.url };
        } catch (e) {
          console.error("❌ Tavily 재시도 실패:", e);
        }
      }
      console.error(`❌ Tavily 유튜브 검색 최종 실패 (${error.response?.status}):`, error.message);
      return null;
    }
  }
}
