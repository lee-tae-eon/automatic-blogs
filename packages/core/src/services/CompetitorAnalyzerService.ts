import { KeywordAnalysis } from "./KeywordScoutService";

export interface ContentStructure {
  headings: string[];
  hasTable: boolean;
  hasList: boolean;
  estimatedLength: number;
  keyPhrases: string[];
  suggestedOutline: string[];
  differentiationStrategy: string;
  styleDNA: string;
}

export class CompetitorAnalyzerService {
  /**
   * 상위 노출된 블로그들의 제목과 요약문을 분석하여 
   * 최적의 글쓰기 구조와 문체 DNA를 제안합니다.
   */
  async analyzeStructure(analysis: KeywordAnalysis): Promise<ContentStructure> {
    const topTitles = analysis.topTitles;
    const topSnippets = analysis.topSnippets || [];
    
    // 1. 문체 DNA 분석 (Rhythm & Vocabulary)
    const snippetsText = topSnippets.join(" ");
    const hasEmojis = /[\u{1F300}-\u{1F9FF}]/u.test(snippetsText);
    
    // 경쟁자들이 사용하는 핵심 단어군 추출
    const commonWords = snippetsText.split(/\s+/).filter(w => w.length >= 2).slice(0, 10);
    
    const styleDNA = `
      - 경쟁사 사용 키워드: ${commonWords.join(", ")}
      - 이모지 사용 트렌드: ${hasEmojis ? "자주 사용함" : "거의 사용 안 함"}
      - 참고할 논리 전개: ${topSnippets[0]?.slice(0, 50)}...
    `;

    // 2. 상위 제목 키워드 분석
    const hasPrice = topTitles.some(t => t.includes("가격") || t.includes("비용") || t.includes("견적"));
    const hasComparison = topTitles.some(t => t.includes("비교") || t.includes("차이"));

    // 3. 차별화 전략
    const strategies = [];
    if (!hasPrice) strategies.push("구체적인 가격 정보가 부족합니다. 시뮬레이션 표를 활용하세요.");
    if (!hasComparison) strategies.push("단순 나열형 글이 많습니다. 장단점 비교 섹션을 강화하세요.");
    
    const differentiationStrategy = strategies.join("\n") || "전문적인 데이터와 수치를 활용하여 신뢰도를 높이세요.";

    // 4. 소제목 및 분량 설정 (v3.8 밀도 강화)
    const headings = topTitles.map(title => title.split(" ").slice(0, 3).join(" ")).slice(0, 3);
    let estimatedLength = analysis.totalSearchCnt > 5000 ? 3000 : 2500;
    
    const suggestedOutline = [
      `[심층 분석] ${analysis.keyword}의 진실과 오해 (전문가적 관점)`,
      `[핵심 비교] ${analysis.keyword} vs 경쟁 제품/서비스 완벽 비교`,
      `[실전 가이드] 실패 없는 선택을 위한 3가지 체크리스트`,
    ];

    // 차별화 전략에 밀도 강화 지시 추가
    const densityStrategy = "소제목은 3개로 제한하되, 각 소제목 아래에는 **최소 3~4개의 긴 문단과 1개의 상세 리스트(Bullet Points)**를 포함하여 정보의 밀도를 극대화하세요.";

    return {
      headings,
      hasTable: true, 
      hasList: true,
      estimatedLength,
      keyPhrases: analysis.keyword.split(" "),
      suggestedOutline,
      differentiationStrategy: `${differentiationStrategy}\n${densityStrategy}`,
      styleDNA
    };
  }
}