import dotenv from "dotenv";
import path from "path";
import { TavilyService } from "./packages/core/src/services/tavilyService";
import { GeminiClient } from "./packages/core/src/ai/geminiClient";

dotenv.config();

/**
 * [v11.0] 유튜브 연관성 검증 로직 테스트
 */
async function testYoutubeRefinement() {
  const topic = "2026년 청년도약계좌 금리 비교 및 신청 방법";
  console.log(`🚀 [Test] 주제: ${topic}`);

  const tavily = new TavilyService();
  const apiKey = process.env.VITE_GEMINI_API_KEY || "";
  // 실제 사용되는 모델명으로 업데이트 필요 (예: gemini-1.5-flash)
  const client = new GeminiClient(apiKey, "gemini-1.5-flash");

  console.log("🎬 1. 유튜브 영상 검색 중 (후보군 확보)...");
  const videoCandidates = await tavily.searchYoutubeVideo(topic);

  if (!videoCandidates || videoCandidates.length === 0) {
    console.log("❌ 검색된 영상 후보가 없습니다.");
    return;
  }

  console.log(`📡 2. 검색 결과 발견 (${videoCandidates.length}개 후보)`);
  videoCandidates.forEach((v, i) => console.log(`   [${i + 1}] ${v.title} (${v.url})`));

  console.log("\n🤖 3. AI 최적 영상 선별 시작...");
  const checkPrompt = `
    [블로그 주제]: ${topic}
    [후보 유튜브 영상들]:
    ${videoCandidates.map((v, i) => `${i + 1}. 제목: ${v.title} / URL: ${v.url}`).join("\n")}
    
    위 후보 중 블로그 주제와 밀접한 연관이 있고 독자에게 유익한 정보/후기를 제공하는 최적의 영상 1개를 선택해줘.
    단순히 단어가 겹치는 수준이 아닌, 본문 내용의 신뢰도를 높여줄 수 있는 실전 가이드나 리뷰 영상이어야 해.
    
    응답은 반드시 아래 JSON 형식으로만 해줘:
    { "bestIndex": number, "isRelevant": boolean, "reason": "선택한 이유" }
    (만약 모두 연관성이 현저히 떨어진다면 "isRelevant": false로 응답해줘. bestIndex는 1부터 시작)
  `;

  try {
    const verification = await client.generateJson<{ bestIndex: number; isRelevant: boolean; reason: string }>(checkPrompt);
    console.log("\n==================================================");
    console.log("📊 [최종 테스트 보고서]");
    
    if (verification.isRelevant && verification.bestIndex > 0) {
      const selected = videoCandidates[verification.bestIndex - 1];
      console.log(`✅ 최종 선택: ${selected.title}`);
      console.log(`🔗 URL: ${selected.url}`);
      console.log(`📝 선택 사유: ${verification.reason}`);
    } else {
      console.log(`❌ 결과: 적합한 영상 없음`);
      console.log(`📝 판단 근거: ${verification.reason}`);
    }
    console.log("==================================================\n");
  } catch (error: any) {
    console.error("❌ AI 검증 중 에러 발생:", error.message);
  }
}

testYoutubeRefinement();
