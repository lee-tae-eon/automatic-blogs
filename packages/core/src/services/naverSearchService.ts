import axios from "axios";

export interface NaverSearchConfig {
  clientId: string;
  clientSecret: string;
}

export class NaverSearchService {
  private readonly baseUrl = "https://openapi.naver.com/v1/search/blog.json";

  constructor(private config: NaverSearchConfig) {}

  /**
   * 네이버 블로그 검색 결과를 가져옵니다.
   */
  async searchBlog(query: string, display: number = 5): Promise<string> {
    if (!this.config.clientId || !this.config.clientSecret) {
      console.warn("⚠️ Naver Search API Key가 설정되지 않았습니다.");
      return "";
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          query: query,
          display: display,
          sort: "sim", // 유사도순 (상위 노출 위주)
        },
        headers: {
          "X-Naver-Client-Id": this.config.clientId,
          "X-Naver-Client-Secret": this.config.clientSecret,
        },
      });

      const items = response.data.items || [];
      
      // HTML 태그 제거 및 데이터 가공
      return items
        .map((item: any, i: number) => {
          const cleanTitle = item.title.replace(/<[^>]*>/g, "");
          const cleanDescription = item.description.replace(/<[^>]*>/g, "");
          return `[네이버 블로그 ${i + 1}] 제목: ${cleanTitle}\n요약: ${cleanDescription}\n출처: ${item.link}`;
        })
        .join("\n\n");
    } catch (error) {
      console.error("❌ Naver Blog 검색 중 오류:", error);
      return "";
    }
  }
}
