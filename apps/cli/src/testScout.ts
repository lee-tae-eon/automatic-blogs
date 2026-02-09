import dotenv from "dotenv";
import path from "path";
import { KeywordScoutService } from "../../../packages/core/src/services/KeywordScoutService";

// .env 로드 (루트 디렉토리 기준)
dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function testScout() {
  const config = {
    searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
    searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
    adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
    adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
    adCustomerId: process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
  };

  console.log("🚀 키워드 분석 테스트 시작...");
  console.log(`🔑 Client ID: ${config.searchClientId.slice(0, 5)}...`);

  const scout = new KeywordScoutService(config);

  // 테스트하고 싶은 키워드 리스트
  const testKeywords = [
    "제주도 여행",
    "아이폰 16 사전예약",
    "블로그 자동화",
    "오늘 점심 메뉴",
  ];

  for (const kw of testKeywords) {
    console.log(`
-----------------------------------`);
    console.log(`🔍 분석 중: [${kw}]`);

    try {
      const result = await scout.analyzeKeyword(kw);
      console.log(`📊 결과 요약:`);
      console.log(` - 점수: ${result.score}점 (${result.recommendation})`);
      console.log(
        ` - 월간 검색량: ${result.totalSearchCnt.toLocaleString()} (PC: ${result.monthlyPcSearchCnt}, Mo: ${result.monthlyMobileSearchCnt})`,
      );
      console.log(` - 총 발행량: ${result.totalResults.toLocaleString()}`);
      console.log(` - 경쟁률: ${result.competitionIndex.toFixed(2)}`);
      console.log(` - 상위 제목 예시: ${result.topTitles[0] || "없음"}`);
    } catch (error: any) {
      console.error(`❌ [${kw}] 분석 실패:`, error.message);
    }
  }
}

testScout();
