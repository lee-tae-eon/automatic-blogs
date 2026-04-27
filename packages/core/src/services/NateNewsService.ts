import axios from "axios";
import * as cheerio from "cheerio";

export interface NateNewsRanking {
  rank: number;
  title: string;
  link: string;
  medium: string;
}

/**
 * 네이트 뉴스 랭킹 정보를 수집하는 서비스입니다.
 */
export class NateNewsService {
  private readonly baseUrl = "https://news.nate.com/rank/interest?sc=all&p=day";

  /**
   * 주요 뉴스 랭킹 상위 항목을 가져옵니다.
   * @param limit 가져올 뉴스 개수 (기본 10개)
   */
  async fetchTopRankings(limit: number = 10): Promise<NateNewsRanking[]> {
    try {
      console.log(`🌐 [NateNews] 네이트 뉴스 랭킹 수집 중... (${this.baseUrl})`);
      
      const response = await axios.get(this.baseUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9"
        },
        responseType: "arraybuffer", // euc-kr 처리를 위해 바이너리로 받음
        timeout: 10000
      });

      // euc-kr 디코딩
      const decoder = new TextDecoder("euc-kr");
      const decodedHtml = decoder.decode(response.data);
      const $ = cheerio.load(decodedHtml);
      const rankings: NateNewsRanking[] = [];

      // 1. 1위~5위 추출 (MLT 스타일)
      $(".mduSubjectList").each((i, el) => {
        if (rankings.length >= limit) return false;

        const rankText = $(el).find(".mduRank dt em").text().trim();
        const rank = parseInt(rankText) || (rankings.length + 1);
        
        const contentArea = $(el).find(".mlt01");
        if (contentArea.length) {
          const titleTag = contentArea.find(".tit");
          const linkTag = contentArea.find("a.lt1");
          const mediumTag = contentArea.find(".medium");

          if (titleTag.length && linkTag.length) {
            rankings.push({
              rank,
              title: titleTag.text().trim(),
              link: this.formatLink(linkTag.attr("href") || ""),
              medium: mediumTag.contents().first().text().trim() // 날짜 em 제외
            });
          }
        }
      });

      // 2. 6위~50위 추출 (리스트 스타일)
      $(".mduRankSubject li").each((i, el) => {
        if (rankings.length >= limit) return false;

        const rankText = $(el).find(".mduRank dt em").text().trim();
        const rank = parseInt(rankText) || (rankings.length + 1);
        
        const titleTag = $(el).find("h2");
        const linkTag = $(el).find("a");
        const mediumTag = $(el).find(".medium");

        if (titleTag.length && linkTag.length) {
          // 이미 1~5위에서 수집된 순위라면 중복 방지
          if (rankings.some(r => r.rank === rank)) return;

          rankings.push({
            rank,
            title: titleTag.text().trim(),
            link: this.formatLink(linkTag.attr("href") || ""),
            medium: mediumTag.text().trim()
          });
        }
      });

      // 순위 순으로 정렬
      const result = rankings.sort((a, b) => a.rank - b.rank).slice(0, limit);
      console.log(`✅ [NateNews] ${result.length}개의 랭킹 뉴스 수집 완료`);
      return result;
    } catch (error: any) {
      console.error(`❌ [NateNews] 랭킹 수집 실패: ${error.message}`);
      return [];
    }
  }

  private formatLink(link: string): string {
    if (!link) return "";
    if (link.startsWith("//")) return "https:" + link;
    if (link.startsWith("/")) return "https://news.nate.com" + link;
    return link;
  }
}
