import dotenv from "dotenv";
import path from "path";
import { DbService } from "./packages/core/src/services/dbService.ts";
import { PerformanceService } from "./packages/core/src/services/PerformanceService.ts";

dotenv.config();

async function testPerformanceTracking() {
  const projectRoot = process.cwd();
  const db = new DbService(projectRoot);
  const perf = new PerformanceService(db);

  console.log("🚀 [Guardian] 성과 분석 데이터 수집 테스트 시작...");

  // 1. 테스트 데이터 삽입
  const testUrl = "https://blog.naver.com/prettyhihihi/223415668350"; // 실제 존재하지 않아도 됨 (스크래핑 테스트용)
  db.savePublishedPost(
    "테스트 포스팅", 
    testUrl, 
    ["테스트"], 
    "IT", 
    "naver1", 
    "informative", 
    "professional"
  );
  console.log("✅ 테스트 포스팅 정보 저장 완료");

  // 2. 성과 데이터 수집 시뮬레이션
  console.log("🎬 성과 데이터 수집 시도...");
  const metrics = await perf.trackPostPerformance(testUrl, true);

  if (metrics) {
    console.log("📊 수집된 메트릭:", metrics);
    
    // 3. 최고 성과 스타일 조회 테스트
    const bestStyles = db.getBestPerformingStyles();
    console.log("🏆 최고 성과 스타일 조합:", bestStyles);
    
    if (bestStyles.length > 0) {
      console.log("✅ [Guardian] 성과 분석 피드백 루프 검증 성공!");
    } else {
      console.error("❌ [Guardian] 최고 성과 스타일 조회 실패");
    }
  } else {
    console.warn("⚠️ [Guardian] 실제 페이지에서 데이터를 가져오지 못했습니다. (네트워크/셀렉터 이슈 가능성)");
  }

  db.close();
}

testPerformanceTracking();
