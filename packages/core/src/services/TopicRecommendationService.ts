import { GeminiClient } from "../ai/geminiClient";
import { RssService } from "./RssService";
import { TavilyService } from "./tavilyService";
import { NaverSearchService, NaverSearchConfig } from "./naverSearchService";
import { KeywordScoutService, ScoutConfig } from "./KeywordScoutService";

export interface RecommendedTopic {
  keyword: string;
  category: string;
  reason: string;
  source: string;
  hotness: number; // 1-100
  persona?: string; // 추천 페르소나 (v9.0)
  tone?: string;    // 추천 톤 (v9.0)
  goldenScore?: number;      // [v11.4] 황금키워드 점수
  searchVolume?: number;     // [v11.4] 월간 검색량
  competitionIndex?: number; // [v11.4] 경쟁 지수
}

export type RecommendCategory = "trending" | "tech" | "economy" | "finance" | "entertainment" | "life" | "travel" | "health" | "parenting";

export const CATEGORY_MAP: Record<RecommendCategory, string> = {
  trending: "⚡ 실시간 급상승 이슈",
  tech: "IT/테크",
  economy: "경제/비즈니스",
  finance: "금융/재테크/보험",
  entertainment: "연예/방송",
  life: "생활/정보",
  travel: "여행/맛집",
  health: "건강/의학/웰빙",
  parenting: "육아/아동",
};

/** 카테고리별 기본 Naver 블로그 검색 쿼리 (동적 쿼리 생성 실패 시 대비) */
const NAVER_BLOG_QUERIES: Record<RecommendCategory, string> = {
  trending: "오늘의 뉴스 실시간 핫이슈 급상승 키워드",
  tech: "IT 트렌드 최신 테크",
  economy: "비즈니스 산업 동향 뉴스",
  finance: "재테크 경제 금융 투자 보험",
  entertainment: "연예 드라마 방송 핫이슈",
  life: "생활정보 꿀팁",
  travel: "해외여행 국내여행 추천여행지",
  health: "건강관리 의료 웰빙",
  parenting: "육아 아이 교육",
};

export class TopicRecommendationService {
  private rssService = new RssService();
  private tavilyService = new TavilyService();
  private naverSearchService?: NaverSearchService;
  private keywordScoutService?: KeywordScoutService;

  constructor(
    private aiClient: GeminiClient,
    naverConfig?: NaverSearchConfig,
    scoutConfig?: ScoutConfig
  ) {
    if (naverConfig && naverConfig.clientId && naverConfig.clientSecret) {
      this.naverSearchService = new NaverSearchService(naverConfig);
      console.log("✅ [TopicRec] 네이버 블로그 검색 연동 활성화");
    }
    if (scoutConfig) {
      this.keywordScoutService = new KeywordScoutService(scoutConfig);
      console.log("✅ [TopicRec] 황금키워드 스코어링 엔진 활성화");
    }
  }

  /**
   * 동적 검색 쿼리를 생성합니다. (v10.0)
   * 매번 다른 주제를 탐색하기 위해 AI가 검색어를 제안합니다.
   */
  private async generateDynamicSearchQueries(category: RecommendCategory): Promise<string[]> {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const categoryName = CATEGORY_MAP[category];

    const prompt = `
      당신은 블로그 트렌드 분석가입니다. 오늘은 **${dateStr}**입니다.
      '**${categoryName}**' 카테고리에 대해, 오늘 블로그 포스팅 소재를 찾기 위한 **다양하고 구체적인 검색 쿼리 3개**를 생성하세요.

      [제약 조건]:
      1. **다양성**: 매번 뻔한 검색어(예: '여행지 추천') 대신, 시즈널리티나 구체적인 상황을 반영하세요.
      2. **중복 배제**: 3개의 쿼리는 서로 다른 앵글이어야 합니다.
      3. **보험/금융 배제 (중요)**: 만약 카테고리가 '금융/재테크/보험'이 **아니라면**, 절대 보험(실비, 자동차, 종신 등)이나 대출 관련 쿼리를 생성하지 마세요.
      4. **형식**: 오직 검색어만 쉼표로 구분하여 출력하세요. (예: 쿼리1, 쿼리2, 쿼리3)

      카테고리: ${categoryName}
    `;

    try {
      const response = await this.aiClient.generateText(prompt);
      const queries = response.split(",").map(q => q.trim()).filter(q => q.length > 0);
      return queries.length > 0 ? queries : [NAVER_BLOG_QUERIES[category]];
    } catch (e) {
      console.error("⚠️ [TopicRec] 동적 쿼리 생성 실패, 기본값 사용");
      return [NAVER_BLOG_QUERIES[category]];
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
   * [v10.0] 동적 쿼리 + 보험 카테고리 분리
   * [v10.7] 사용자 입력 쿼리(query) 지원 추가
   */
  async getRecommendationsByCategory(
    category: RecommendCategory,
    query?: string
  ): Promise<RecommendedTopic[]> {
    try {
      console.log(`📡 [TopicRec] '${CATEGORY_MAP[category]}' 트렌드 수집 시작 (검색어: ${query || "없음"})...`);
      
      // 1. 쿼리 준비
      let dynamicQueries: string[] = [];
      if (query && query.trim()) {
        // 사용자가 검색어를 입력한 경우 해당 검색어 사용
        dynamicQueries = [query.trim()];
      } else {
        // 검색어가 없는 경우 AI가 동적으로 쿼리 생성
        dynamicQueries = await this.generateDynamicSearchQueries(category);
      }
      console.log(`🔍 [TopicRec] 수집 대상 쿼리: ${dynamicQueries.join(" | ")}`);

      // 2. 데이터 수집 (Tavily + Naver)
      let combinedData = "";

      // ─── 2-1. Tavily 최신 뉴스 수집 ───────────────────────────────────
      const newsResults = await Promise.all(
        dynamicQueries.map(q => this.tavilyService.searchLatestNews(q, "day").catch(() => ({ context: "" })))
      );
      combinedData += newsResults.map(r => r.context).join("\n\n");

      // ─── 2-2. RSS (Trending Only) ──────────────────────────────────
      if (category === "trending") {
        const rssTrends = await this.rssService.fetchTrendingTopics("KR");
        combinedData += "\n\n=== 실시간 급상승 뉴스 ===\n" + rssTrends.map(t => t.title).join(", ");
      }

      // ─── 2-3. 네이버 블로그 검색 ──────────────────────────────────
      if (this.naverSearchService) {
        const naverResults = await Promise.all(
          dynamicQueries.map(q => this.naverSearchService!.searchBlog(q, 10).catch(() => ""))
        );
        const naverData = naverResults.filter(Boolean).join("\n\n");
        if (naverData) {
          combinedData += "\n\n=== 네이버 블로그 인기 키워드 ===\n" + naverData;
          console.log(`✅ [TopicRec] 네이버 블로그 데이터 수집 완료 (${category})`);
        }
      }

      if (!combinedData || combinedData.trim().length < 20) {
        throw new Error("분석할 충분한 트렌드 데이터를 수집하지 못했습니다.");
      }

      // 3. AI 큐레이션
      const now = new Date();
      const currentDateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
      const isFinanceCategory = category === "finance";
      
      const prompt = `
        당신은 대한민국 최고의 블로그 콘텐츠 전략가입니다. 오늘은 **${currentDateStr}**입니다.
        '**${CATEGORY_MAP[category]}**' 카테고리에서 오늘 블로그로 쓰기 가장 좋은 핫 토픽 20개를 선정하세요.

        [수집된 데이터]:
        ${combinedData}

        [선정 지침 - 절대 준수]:
        1. **보험/금융 엄격 분리 (CRITICAL)**:
           - 현재 카테고리가 '**금융/재테크/보험**'이 **아니라면**, 절대 보험(실비, 암, 자동차, 종신 등), 대출, 카드 신청 등 금융 상품 관련 주제를 포함하지 마세요.
           - 다른 카테고리에서 금융 데이터가 섞여 들어왔다면 과감히 무시하고 순수하게 해당 카테고리(예: 여행이면 여행 정보만)에 집중하세요.
        2. **최신성 및 구체성**: 2026년 현재 시점에서 유효한 구체적인 키워드를 선정하세요.
        3. **다양성**: 검색 결과 중 가장 흥미롭고 유입이 기대되는 다양한 앵글의 20가지 키워드를 기획하세요.
        4. **이유 명시**: 왜 이 주제가 오늘 유망한지 수익화/화제성 관점에서 설명하세요.
        5. **페르소나/톤 추천**: 각 키워드에 적합한 페르소나와 톤을 지정하세요.

        [출력 형식]: 반드시 아래 JSON 배열 형식으로만 응답하세요.
        [
          { 
            "keyword": "구체적인 키워드", 
            "reason": "선정 이유", 
            "hotness": 95,
            "persona": "informative | experiential | reporter | financeMaster | healthExpert",
            "tone": "professional | serious | empathetic"
          }
        ]
      `;

      const curated = await this.aiClient.generateJson<any[]>(prompt);
      
      const topics: RecommendedTopic[] = curated.map(item => ({
        ...item,
        category: CATEGORY_MAP[category],
        source: "AI Curated (Dynamic Multi-Source)",
      }));

      // [v11.4] 황금키워드 스코어링 적용
      if (this.keywordScoutService) {
        console.log(`📊 [TopicRec] ${topics.length}개 토픽에 대해 황금키워드 분석 시작...`);
        
        // 병렬 분석 실행 (API 부하를 고려하여 순차적 병렬 처리 등 고려 가능하나 일단 단순 병렬)
        const analyzedTopics = await Promise.all(
          topics.map(async (topic) => {
            try {
              const analysis = await this.keywordScoutService!.analyzeKeyword(topic.keyword);
              return {
                ...topic,
                goldenScore: analysis.score,
                searchVolume: analysis.totalSearchCnt,
                competitionIndex: analysis.competitionIndex
              };
            } catch (err) {
              console.warn(`⚠️ [TopicRec] '${topic.keyword}' 분석 실패:`, err);
              return topic;
            }
          })
        );

        // 점수순으로 정렬하여 반환
        return analyzedTopics.sort((a, b) => (b.goldenScore || 0) - (a.goldenScore || 0));
      }
      
      return topics;

    } catch (error) {
      console.error(`❌ [TopicRec] ${category} 추천 생성 실패:`, error);
      throw error;
    }
  }
}
