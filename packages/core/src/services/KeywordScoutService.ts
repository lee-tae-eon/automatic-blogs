import axios from "axios";
import crypto from "crypto";

export interface KeywordAnalysis {
  keyword: string;
  totalResults: number; // 총 발행량 (경쟁자 수)
  monthlyPcSearchCnt: number; // PC 검색량
  monthlyMobileSearchCnt: number; // 모바일 검색량
  totalSearchCnt: number; // 총 검색량
  competitionIndex: number; // 경쟁률 (발행량 / 검색량)
  topTitles: string[]; // 상위 블로그 제목들
  topSnippets: string[]; // 상위 블로그 요약문들
  relatedKeywords: string[]; // v3.29: 세만틱 SEO를 위한 연관 키워드
  score: number; // 최종 점수
  recommendation: string; // 추천 등급
}

export interface ScoutConfig {
  searchClientId: string;
  searchClientSecret: string;
  adLicense: string;
  adSecret: string;
  adCustomerId: string;
}

export class KeywordScoutService {
  private config: ScoutConfig;

  constructor(config: ScoutConfig) {
    this.config = config;
  }

  /**
   * 네이버 검색광고 API용 시그니처 생성
   */
  private generateSignature(timestamp: string, method: string, uri: string): string {
    const message = `${timestamp}.${method}.${uri}`;
    const hash = crypto
      .createHmac("sha256", this.config.adSecret)
      .update(message)
      .digest("base64");
    return hash;
  }

  /**
   * 1. 월간 검색량 및 연관 키워드 조회 (검색광고 API)
   */
  async getMonthlySearchVolume(keyword: string): Promise<{ pc: number; mobile: number; related: string[] }> {
    try {
      const timestamp = Date.now().toString();
      const method = "GET";
      const uri = "/keywordstool";
      const signature = this.generateSignature(timestamp, method, uri);

      const response = await axios.get(`https://api.naver.com${uri}`, {
        params: {
          hintKeywords: keyword.replace(/\s+/g, ""), // API 제약: 공백 불가
          showDetail: 1,
        },
        headers: {
          "X-Timestamp": timestamp,
          "X-API-KEY": this.config.adLicense,
          "X-Customer": this.config.adCustomerId,
          "X-Signature": signature,
        },
      });

      // 입력한 키워드(공백 제거)와 가장 잘 맞는 데이터 찾기
      const list = response.data.keywordList || [];
      const strippedKeyword = keyword.replace(/\s+/g, "");
      const data = list.find((item: any) => item.relKeyword === strippedKeyword) || list[0];
      
      if (!data) return { pc: 0, mobile: 0, related: [] };

      const parseCnt = (val: any) => {
        if (val === undefined || val === null) return 0;
        if (typeof val === "number") return val;
        const strVal = String(val);
        if (strVal.startsWith("<")) return 10;
        return parseInt(strVal.replace(/,/g, ""), 10) || 0;
      };

      // 상위 10개 연관 키워드 추출 (본인 제외)
      const related = list
        .filter((item: any) => item.relKeyword !== strippedKeyword)
        .slice(0, 10)
        .map((item: any) => item.relKeyword);

      return {
        pc: parseCnt(data.monthlyPcQcCnt),
        mobile: parseCnt(data.monthlyMobileQcCnt),
        related
      };
    } catch (error) {
      console.error("Search AD API Error:", error);
      return { pc: 0, mobile: 0, related: [] };
    }
  }

  /**
   * 2. 검색 결과 총 개수 및 상위 제목/요약 조회 (검색 API)
   */
  async getSearchCompetition(keyword: string): Promise<{ total: number; titles: string[]; snippets: string[] }> {
    try {
      const response = await axios.get("https://openapi.naver.com/v1/search/blog.json", {
        params: { query: keyword, display: 5 }, // 상위 5개 분석
        headers: {
          "X-Naver-Client-Id": this.config.searchClientId,
          "X-Naver-Client-Secret": this.config.searchClientSecret,
        },
      });

      const total = response.data.total || 0;
      const items = response.data.items || [];
      const titles = items.map((item: any) => 
        item.title.replace(/<[^>]*>?/gm, "") // HTML 태그 제거
      );
      const snippets = items.map((item: any) => 
        item.description.replace(/<[^>]*>?/gm, "") // HTML 태그 제거
      );

      return { total, titles, snippets };
    } catch (error) {
      console.error("Search API Error:", error);
      return { total: 0, titles: [], snippets: [] };
    }
  }

  /**
   * 3. 종합 점수 계산 (사용자 정의 로직)
   */
  calculateScore(analysis: Omit<KeywordAnalysis, "score" | "recommendation">): number {
    let score = 0;

    // A. 검색량 점수 (최대 40점)
    // 소형 블로그를 위해 현실적인 구간으로 조정
    if (analysis.totalSearchCnt > 5000) {
      score += 40; 
    } else if (analysis.totalSearchCnt > 1000) {
      score += 30;
    } else if (analysis.totalSearchCnt > 100) {
      score += 20;
    } else {
      score += 10; // 아주 적어도 기본 점수
    }

    // B. 경쟁률 점수 (최대 50점) - v2.0 핵심: 검색량 대비 발행량
    // Index가 낮을수록(발행량이 적을수록) 고점
    if (analysis.competitionIndex < 1) {
      score += 50; // 황금 (발행량 < 검색량)
    } else if (analysis.competitionIndex < 10) {
      score += 40; // 블루오션
    } else if (analysis.competitionIndex < 50) {
      score += 30; // 경쟁 있음
    } else if (analysis.competitionIndex < 200) {
      score += 20; // 레드오션
    } else {
      score += 5;  // 극심한 레드오션
    }

    // C. 제목 및 광고 필터 (최대 10점)
    const adKeywords = ["대출", "보험", "수술", "분양", "렌트", "광고", "협찬"];
    const hasAdKeyword = adKeywords.some(kw => analysis.keyword.includes(kw));
    const titleAdCount = analysis.topTitles.filter(t => 
        adKeywords.some(ak => t.includes(ak))
    ).length;

    if (!hasAdKeyword && titleAdCount < 2) {
      score += 10;
    } else if (titleAdCount >= 5) {
      score -= 20; // 광고 도배 키워드 강력 감점
    }

    return score;
  }

  /**
   * 전체 분석 프로세스 실행
   */
  async analyzeKeyword(keyword: string): Promise<KeywordAnalysis> {
    const [volume, competition] = await Promise.all([
      this.getMonthlySearchVolume(keyword),
      this.getSearchCompetition(keyword),
    ]);

    const totalSearchCnt = volume.pc + volume.mobile;
    const competitionIndex = totalSearchCnt > 0 ? competition.total / totalSearchCnt : competition.total;

    const baseAnalysis: Omit<KeywordAnalysis, "score" | "recommendation"> = {
      keyword,
      totalResults: competition.total,
      monthlyPcSearchCnt: volume.pc,
      monthlyMobileSearchCnt: volume.mobile,
      totalSearchCnt,
      competitionIndex,
      topTitles: competition.titles,
      topSnippets: competition.snippets, 
      relatedKeywords: volume.related, // 추가
    };

    const score = this.calculateScore(baseAnalysis);
    
    let recommendation = "일반 토픽";
    if (score >= 80) recommendation = "🔥 화제성/전략적 가치 높음";
    else if (score >= 60) recommendation = "✅ 안정적인 정보성 토픽";
    else if (score < 40) recommendation = "⚠️ 검색 수요 대비 경쟁 과다";

    return {
      ...baseAnalysis,
      score,
      recommendation,
    };
  }
}
