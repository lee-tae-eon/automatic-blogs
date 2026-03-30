import { GeminiClient } from "../ai/geminiClient";
import { RssService } from "./RssService";
import { TavilyService } from "./tavilyService";
import { NaverSearchService, NaverSearchConfig } from "./naverSearchService";

export interface RecommendedTopic {
  keyword: string;
  category: string;
  reason: string;
  source: string;
  hotness: number; // 1-100
  persona?: string; // 추천 페르소나 (v9.0)
  tone?: string;    // 추천 톤 (v9.0)
}

export type RecommendCategory = "trending" | "tech" | "economy" | "entertainment" | "life" | "travel" | "health" | "parenting";

export const CATEGORY_MAP: Record<RecommendCategory, string> = {
  trending: "⚡ 실시간 급상승 이슈",
  tech: "IT/테크",
  economy: "경제/비즈니스",
  entertainment: "연예/방송",
  life: "생활/건강",
  travel: "여행/맛집",
  health: "건강/의학/웰빙",
  parenting: "육아/아동",
};

/** 카테고리별 Naver 블로그 검색 쿼리 */
const NAVER_BLOG_QUERIES: Record<RecommendCategory, string> = {
  trending: "오늘의 뉴스 실시간 핫이슈 급상승 키워드",
  tech: "IT 트렌드 최신 테크",
  economy: "재테크 경제 금융 투자",
  entertainment: "연예 드라마 방송 핫이슈",
  life: "생활정보 건강 꿀팁",
  travel: "해외여행 국내여행 추천여행지",
  health: "건강관리 의료 보험 웰빙",
  parenting: "육아 아이 교육 학습지",
};

export class TopicRecommendationService {
  private rssService = new RssService();
  private tavilyService = new TavilyService();
  private naverSearchService?: NaverSearchService;

  constructor(
    private aiClient: GeminiClient,
    naverConfig?: NaverSearchConfig
  ) {
    if (naverConfig && naverConfig.clientId && naverConfig.clientSecret) {
      this.naverSearchService = new NaverSearchService(naverConfig);
      console.log("✅ [TopicRec] 네이버 블로그 검색 연동 활성화");
    }
  }

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
   * 특정 카테고리의 핫 토픽 20개를 가져옵니다.
   * [v7.0] 뉴스(RSS/Tavily) + 네이버 블로그 검색 결합
   */
  async getRecommendationsByCategory(category: RecommendCategory): Promise<RecommendedTopic[]> {
    try {
      console.log(`📡 [TopicRec] '${CATEGORY_MAP[category]}' 트렌드 수집 중...`);
      
      // ─── 1. 뉴스 데이터 수집 ───────────────────────────────────
      let newsData = "";
      
      if (category === "trending" || category === "entertainment" || category === "economy") {
        // [v7.1] 실시간 이슈는 구글 트렌드(RSS)를 최우선으로 수집
        const rssTrends = await this.rssService.fetchTrendingTopics("KR");
        newsData = rssTrends.map(t => t.title).join(", ");
        
        if (category === "trending") {
          // 실시간 카테고리는 뉴스 검색 데이터도 추가하여 풍부하게 만듦
          const searchResult = await this.tavilyService.searchLatestNews(`대한민국 현재 실시간 급상승 뉴스 핫이슈`);
          newsData += `\n\n${searchResult.context}`;
        }
      } else if (category === "health") {
        const searchResult = await this.tavilyService.searchLatestNews(`환절기 건강 관리 트렌드 OR 직장인 통증 관리 OR 최신 영양제 성분 효능`);
        newsData = searchResult.context;
      } else if (category === "parenting") {
        const searchResult = await this.tavilyService.searchLatestNews(`한국 육아 꿀팁 OR 영유아 아동 발달 가이드 OR 신생아 초보 부모 가이드`);
        newsData = searchResult.context;
      } else if (category === "travel") {
        const searchResult = await this.tavilyService.searchLatestNews(`해외 여행 인기 트렌드 OR 이색 해외 여행지 추천 OR 가성비 해외 여행 국가`);
        newsData = searchResult.context;
      } else {
        try {
          const searchResult = await this.tavilyService.searchLatestNews(`${CATEGORY_MAP[category]} 최신 트렌드 이슈`);
          newsData = searchResult.context;
        } catch (e) {
          console.warn(`⚠️ [TopicRec] Tavily 실패, RSS로 대체: ${category}`);
          const rssTrends = await this.rssService.fetchTrendingTopics("KR");
          newsData = rssTrends.map(t => t.title).join(", ");
        }
      }

      // ─── 2. [NEW v7.0] 네이버 블로그 검색 (실제 블로그 유입 트렌드) ───
      let naverBlogData = "";
      if (this.naverSearchService) {
        try {
          const query = NAVER_BLOG_QUERIES[category];
          const blogResults = await this.naverSearchService.searchBlog(query, 20);
          if (blogResults) {
            naverBlogData = blogResults;
            console.log(`✅ [TopicRec] 네이버 블로그 유입 데이터 수집 완료: ${category}`);
          }
        } catch (e) {
          console.warn(`⚠️ [TopicRec] 네이버 블로그 검색 실패 (무시): ${category}`);
        }
      }

      const rawData = [newsData, naverBlogData].filter(Boolean).join("\n\n");

      if (!rawData || rawData.trim().length < 10) {
        throw new Error("분석할 충분한 트렌드 데이터를 수집하지 못했습니다.");
      }

      // ─── 3. AI 큐레이션 ────────────────────────────────────────────
      const now = new Date();
      const currentDateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
      
      const prompt = `
        당신은 대한민국 최고의 블로그 콘텐츠 전략가이자 수익화 마케터입니다. 
        현재는 **${currentDateStr}**입니다. 반드시 현재 시점에서 가장 유효한 정보를 바탕으로 **'${CATEGORY_MAP[category]}'** 카테고리에서 오늘 블로그로 쓰기 가장 좋은, **수익성(상업적 의도)과 화제성을 동시에 갖춘 핫 토픽 20개**를 선정하세요.

        [원천 데이터]:
        === 📰 최신 뉴스/검색 이슈 ===
        ${newsData || "(데이터 없음)"}

        === 📝 네이버 블로그 실제 인기 키워드 (블로그 유입 반영) ===
        ${naverBlogData ? naverBlogData : "(네이버 블로그 검색 미연동 - 뉴스 데이터만 사용)"}

        [선정 지침 - 절대 준수]:
        1. **최신성 필터링 (CRITICAL)**: 과거 연도 관련 키워드나 이미 지나간 이슈는 절대 포함하지 마세요. 2026년 현재 유효한 트렌드만 다룹니다.
        2. **수익 극대화 우선 (CRITICAL - Best Blogger Strategy)**: 단순 화제성을 넘어, 사람들이 지갑을 열거나 고단가 광고(대출, 보험, IT솔루션, 부동산, 교육, 여행상품)를 클릭할 만한 **'상업적 의도(Commercial Intent)'**가 높은 주제를 최우선으로 선정하세요.
           - 예: '일본 여행' (X) -> '일본 여행자 보험 비교 및 추천' (O - 금융 브릿징)
           - 예: '아이폰 출시' (X) -> '아이폰 자급제 할인 카드 혜택' (O - 금융 브릿징)
        3. **분야 엄수 (CRITICAL)**: 제공된 데이터에 '${CATEGORY_MAP[category]}'와 전혀 관련 없는 내용이 포함되어 있다면 무시하세요. 단, 해당 카테고리와 '금융/건강/IT' 등 고수익 도메인을 자연스럽게 연결(Domain Bridging)하는 것은 적극 권장합니다.
        4. **블로그 유입 우선**: 네이버 블로그 데이터에서 등장하는 키워드를 뉴스 이슈와 결합하여 '실제 독자들이 검색하는' 주제를 만드세요.
        5. **다양성 (CRITICAL)**: 뻔한 주제를 피하고, 매번 [창의적이고 다채로운 수익화 앵글]로 20가지 전혀 다른 차별화된 키워드를 기획하세요. (Random Seed: ${Math.random().toString(36).substring(7)})
        6. **구체성**: 키워드는 블로그 제목으로 바로 써도 될 만큼 구체적이어야 합니다.
        7. **이유 명시**: 왜 이 주제가 화제성이 있고 **동시에 수익을 낼 수 있는지**(예: "정부 지원금 신청 기간이라 관련 트래픽 및 금융 광고 단가 상승")를 짧고 강렬하게 적으세요.
        8. **페르소나/톤 추천 (NEW v9.0)**: 각 키워드의 의도에 가장 적합한 페르소나와 톤을 지정하세요.
           - 페르소나 후보: informative(정보분석), experiential(후기), reporter(뉴스), entertainment(엔터), travel(여행), financeMaster(금융), healthExpert(건강)
           - 톤 후보: professional(전문적), serious(냉철), incisive(비판적), empathetic(공감)

        [출력 형식]: 반드시 아래 JSON 배열 형식으로만 응답하세요.
        [
          { 
            "keyword": "구체적인 키워드", 
            "reason": "선정 이유", 
            "hotness": 95,
            "persona": "추천 페르소나 키",
            "tone": "추천 톤 키"
          }
        ]
      `;

      const curated = await this.aiClient.generateJson<any[]>(prompt);
      
      return curated.map(item => ({
        ...item,
        category: CATEGORY_MAP[category],
        source: naverBlogData ? "AI Curated (News + Naver Blog)" : "AI Curated (News)",
      }));

    } catch (error) {
      throw error;
    }
  }
}
