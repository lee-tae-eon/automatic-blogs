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
  life: "생활정보 꿀팁 정부지원금 장려금 혜택",
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
   * [v11.5] 사용자 입력(userQuery)이 있을 경우 해당 맥락을 반영하도록 강화
   */
  private async generateDynamicSearchQueries(category: RecommendCategory, userQuery?: string): Promise<string[]> {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
    const categoryName = CATEGORY_MAP[category];

    // [v13.9.1] 카테고리별 집중 지침 생성
    let categoryFocus = "";
    switch(category) {
      case "parenting": categoryFocus = "아동 교육, 육아용품, 영유아 건강, 부모 교육, 어린이집/유치원 소식에 집중하세요. 절대 주식, 코인, AI 테크, 정치 소식을 포함하지 마세요."; break;
      case "tech": categoryFocus = "IT 신제품, 소프트웨어 업데이트, AI 기술 트렌드, 가젯 리뷰에 집중하세요."; break;
      case "economy": categoryFocus = "거시 경제, 산업 동향, 부동산 정책, 기업 실적에 집중하세요."; break;
      case "finance": categoryFocus = "재테크, 주식 시장, 금리 전망, 보험 가이드, 세무 정보에 집중하세요."; break;
      case "health": categoryFocus = "질병 예방, 영양제 정보, 다이어트, 정신 건강, 운동 가이드에 집중하세요."; break;
      case "life": categoryFocus = "정부 지원금, 생활 꿀팁, 절약 노하우, 법률 상식에 집중하세요."; break;
      default: categoryFocus = `${categoryName} 분야의 대중적인 관심사에 집중하세요.`;
    }

    const prompt = `
      당신은 블로그 트렌드 분석가입니다. 현재 시각은 **${dateStr}**입니다.
      '**${categoryName}**' 카테고리에 대해, **지금 이 순간** 가장 유입이 폭발할만한 구체적인 검색어 3개를 생성하세요.

      [카테고리 집중 지침 (CRITICAL)]:
      ${categoryFocus}

      ${userQuery ? `[사용자 집중 키워드]: "${userQuery}"
      위 키워드와 관련된 구체적인 하위 주제나 연관 트렌드 위주로 검색어를 생성하세요. 절대 주제와 상관없는 나물, 벚꽃 같은 계절 이슈로 이탈하지 마세요.` : ""}

      [제약 조건]:
      1. **주제 일치성 (ULTRA CRITICAL)**: 반드시 '${categoryName}'의 범주 내에서만 쿼리를 생성하세요. 육아 카테고리에 주식이나 테크 주제가 나오는 식의 '카테고리 침범'이 발생하면 실패로 간주합니다.
      2. **최신성 극대화**: 최근 24시간 이내의 뉴스나 이슈를 반영하세요.
      3. **형식**: 오직 검색어만 쉼표로 구분하여 출력하세요.
    `;

    try {
      const response = await this.aiClient.generateText(prompt);
      const queries = response.split(",").map(q => q.trim()).filter(q => q.length > 0);
      
      // 사용자 쿼리가 있다면 첫 번째는 무조건 포함
      if (userQuery && !queries.includes(userQuery)) {
        queries.unshift(userQuery);
      }
      
      return queries.length > 0 ? queries.slice(0, 3) : [userQuery || NAVER_BLOG_QUERIES[category]];
    } catch (e) {
      console.error("⚠️ [TopicRec] 동적 쿼리 생성 실패, 기본값 사용");
      return [userQuery || NAVER_BLOG_QUERIES[category]];
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
        // 사용자가 검색어를 입력한 경우 AI가 해당 맥락을 반영하여 쿼리 확장
        dynamicQueries = await this.generateDynamicSearchQueries(category, query.trim());
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

        ${query ? `[사용자 집중 키워드]: "${query}"
        **중요**: 모든 추천 토픽은 반드시 "${query}"와(과) 직접적으로 연관된 주제여야 합니다. 
        데이터에 있더라도 나물, 벚꽃, 연예인 소식 등 "${query}"와 관계없는 내용은 절대 추천하지 마세요.` : ""}

        [선정 지침 - 절대 준수]:
        1. **주제 일관성 (URGENT)**: 사용자 집중 키워드("${query || "없음"}")가 있다면, 그 범위를 절대 벗어나지 마세요. 
           - 예: '장려금' 입력 시 -> 근로장려금, 자녀장려금, 환급금, 지자체 지원금 등만 추천.
        2. **보험/금융 엄격 분리**: 현재 카테고리가 '금융/재테크/보험'이 아니라면, 금융 상품 관련 주제를 포함하지 마세요. (단, 정부 지원금/장려금은 생활/정보 카테고리 허용)
        3. **초단위 최신성**: 검색 데이터 중 가장 최근에 발생한 뉴스를 최우선으로 선정하세요.
        4. **극강의 다양성**: 동일 주제 내에서도 신청방법, 자격요건, 후기, 지급일 등 다양한 관점으로 배분하세요.
        5. **이유 명시**: '왜 지금 이 주제가 유입이 잘 될지' 분석적인 내용을 포함하세요.

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
