import axios from "axios";

export interface RssTrend {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export class RssService {
  /**
   * 구글 트렌드 및 뉴스 RSS에서 최신 이슈를 가져옵니다.
   * @param region 지역 (KR/US)
   * @param query 검색어 (없으면 기본 테크 뉴스)
   */
  async fetchTrendingTopics(region: "KR" | "US" = "KR", query?: string): Promise<RssTrend[]> {
    let url = "";
    
    if (query && query.trim()) {
      // 🔍 검색어가 있는 경우: 구글 뉴스 검색 RSS 사용
      const encodedQuery = encodeURIComponent(query);
      url = region === "KR"
        ? `https://news.google.com/rss/search?q=${encodedQuery}&hl=ko&gl=KR&ceid=KR:ko`
        : `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;
    } else {
      // 📰 검색어가 없는 경우: 기본 테크 뉴스 헤드라인
      url = region === "KR" 
        ? "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko"
        : "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en";
    }

    try {
      const response = await axios.get(url);
      const xml = response.data;

      // 정규식을 사용하여 <item> 태그 내의 <title> 추출 (XML 파서 의존성 제거)
      const items: RssTrend[] = [];
      const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

      for (const match of itemMatches) {
        const itemBody = match[1];
        const title = this.extractTagContent(itemBody, "title");
        const link = this.extractTagContent(itemBody, "link");
        const pubDate = this.extractTagContent(itemBody, "pubDate");

        if (title) {
          items.push({
            title: title.split(" - ")[0], // 출처 제거
            link,
            pubDate,
            source: "Google News"
          });
        }
        if (items.length >= 10) break; // 상위 10개만
      }

      return items;
    } catch (error) {
      console.error("RSS Fetch Error:", error);
      return [];
    }
  }

  private extractTagContent(xml: string, tagName: string): string {
    const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, "i");
    const match = xml.match(regex);
    return match ? match[1].replace("<![CDATA[", "").replace("]]>", "") : "";
  }
}
