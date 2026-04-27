import { NateNewsService } from "@blog-automation/core";
import * as dotenv from "dotenv";
import { resolve } from "path";

// 환경 변수 로드 (프로젝트 루트의 .env)
dotenv.config({ path: resolve(__dirname, "../../../.env") });

async function testNate() {
  const nateService = new NateNewsService();
  console.log("🚀 [Test] 네이트 뉴스 랭킹 수집 테스트 시작...");
  
  try {
    const rankings = await nateService.fetchTopRankings(10);
    
    if (rankings.length === 0) {
      console.log("❌ [Test] 수집된 데이터가 없습니다. 셀렉터나 네트워크를 확인하세요.");
      return;
    }

    console.log("\n--- 🏆 네이트 뉴스 오늘의 주요 랭킹 (Top 10) ---");
    rankings.forEach(item => {
      console.log(`${item.rank}위. [${item.medium}] ${item.title}`);
      console.log(`    🔗 ${item.link}`);
    });
    console.log("-----------------------------------------------\n");
    
    console.log("✅ [Test] 테스트 완료");
  } catch (error) {
    console.error("❌ [Test] 에러 발생:", error);
  }
}

testNate();
