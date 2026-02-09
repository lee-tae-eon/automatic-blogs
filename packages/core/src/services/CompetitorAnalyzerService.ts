import { KeywordAnalysis } from "./KeywordScoutService";

export interface ContentStructure {
  headings: string[];
  hasTable: boolean;
  hasList: boolean;
  estimatedLength: number;
  keyPhrases: string[];
  suggestedOutline: string[];
}

export class CompetitorAnalyzerService {
  /**
   * 상위 노출된 블로그들의 제목과 메타 데이터를 분석하여 
   * 최적의 글쓰기 구조(Structure)를 제안합니다.
   */
  async analyzeStructure(analysis: KeywordAnalysis): Promise<ContentStructure> {
    // 1. 상위 제목들로부터 핵심 소제목 패턴 추출
    const headings = analysis.topTitles.map(title => {
        // 제목에서 불필요한 단어 제거 및 핵심 단어 추출 (간이 분석)
        return title.split(" ").slice(0, 3).join(" ");
    });

    // 2. 검색량과 경쟁률에 따른 추천 분량 계산
    let estimatedLength = 2000; // 기본 2000자
    if (analysis.totalSearchCnt > 5000) estimatedLength = 3000; // 대형 키워드는 더 길게
    
    // 3. 제목 기반으로 추천 아웃라인(Outline) 생성
    // (이 부분은 나중에 AI에게 맡길 수도 있지만, 일단 규칙 기반으로 생성)
    const suggestedOutline = [
      `${analysis.keyword} 개요 및 필요성`,
      `${analysis.keyword} 핵심 특징 3가지`,
      "실제 사용 후기 및 장단점 비교",
      "자주 묻는 질문(FAQ)",
      "결론 및 요약"
    ];

    return {
      headings,
      hasTable: analysis.totalSearchCnt > 1000, // 검색량이 어느 정도 되면 표를 넣어 가독성 높임
      hasList: true,
      estimatedLength,
      keyPhrases: analysis.keyword.split(" "),
      suggestedOutline
    };
  }
}
