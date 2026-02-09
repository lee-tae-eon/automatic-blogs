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
   * 1. 월간 검색량 조회 (검색광고 API)
   */
  async getMonthlySearchVolume(keyword: string): Promise<{ pc: number; mobile: number }> {
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

      if (!data) return { pc: 0, mobile: 0 };

      const parseCnt = (val: any) => {
        if (val === undefined || val === null) return 0;
        if (typeof val === "number") return val;
        const strVal = String(val);
        if (strVal.startsWith("<")) return 10;
        return parseInt(strVal.replace(/,/g, ""), 10) || 0;
      };

      return {
        pc: parseCnt(data.monthlyPcQcCnt),
        mobile: parseCnt(data.monthlyMobileQcCnt),
      };
    } catch (error) {
      console.error("Search AD API Error:", error);
      return { pc: 0, mobile: 0 };
    }
  }

  /**
   * 2. 검색 결과 총 개수 및 상위 제목 조회 (검색 API)
   */
  async getSearchCompetition(keyword: string): Promise<{ total: number; titles: string[] }> {
    try {
      const response = await axios.get("https://openapi.naver.com/v1/search/blog.json", {
        params: { query: keyword, display: 10 },
        headers: {
          "X-Naver-Client-Id": this.config.searchClientId,
          "X-Naver-Client-Secret": this.config.searchClientSecret,
        },
      });

      const total = response.data.total || 0;
      const titles = response.data.items?.map((item: any) => 
        item.title.replace(/<[^>]*>?/gm, "") // HTML 태그 제거
      ) || [];

      return { total, titles };
    } catch (error) {
      console.error("Search API Error:", error);
      return { total: 0, titles: [] };
    }
  }

  /**
   * 3. 종합 점수 계산 (사용자 정의 로직)
   */
  calculateScore(analysis: Omit<KeywordAnalysis, "score" | "recommendation">): number {
    let score = 0;

    // A. 검색량 점수 (최대 40점)
    // 1,000 ~ 10,000 사이를 황금 구간으로 가정
    if (analysis.totalSearchCnt > 1000 && analysis.totalSearchCnt < 15000) {
      score += 40;
    } else if (analysis.totalSearchCnt >= 15000) {
      score += 25; // 너무 높으면 대형 블로거가 많음
    } else {
      score += 15;
    }

    // B. 경쟁자 수 점수 (최대 30점)
    // 발행량 / 검색량 비율이 낮을수록 좋음
    if (analysis.competitionIndex < 1) {
      score += 30; // 황금 키워드 (검색량이 발행량보다 많음)
    } else if (analysis.competitionIndex < 5) {
      score += 20;
    } else if (analysis.competitionIndex < 10) {
      score += 10;
    }

    // C. 광고 키워드 포함 여부 (최대 10점)
    const adKeywords = ["대출", "보험", "수술", "분양", "렌트"];
    const hasAdKeyword = adKeywords.some(kw => analysis.keyword.includes(kw));
    const titleAdCount = analysis.topTitles.filter(t => 
        adKeywords.some(ak => t.includes(ak))
    ).length;

    if (!hasAdKeyword && titleAdCount < 2) {
      score += 10;
    } else if (titleAdCount > 5) {
      score -= 20; // 광고판인 경우 감점
    }

    // D. 제목 길이 평균 (최대 20점)
    const avgTitleLength = analysis.topTitles.reduce((acc, t) => acc + t.length, 0) / (analysis.topTitles.length || 1);
    if (avgTitleLength > 20 && avgTitleLength < 40) {
      score += 20; // 적당한 제목 길이는 분석하기 좋음
    } else {
      score += 10;
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
    };

    const score = this.calculateScore(baseAnalysis);
    
    let recommendation = "보통";
    if (score >= 80) recommendation = "강력 추천 (황금)";
    else if (score >= 60) recommendation = "추천 (해볼만 함)";
    else if (score < 40) recommendation = "비추천 (레드오션)";

    return {
      ...baseAnalysis,
      score,
      recommendation,
    };
  }
}
