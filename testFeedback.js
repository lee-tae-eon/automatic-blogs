const { DbService, PerformanceService } = require("./packages/core/dist");
const path = require("path");
require("dotenv").config();

async function runTest() {
  const projectRoot = process.cwd();
  const db = new DbService(projectRoot);
  const perf = new PerformanceService(db);

  console.log("🚀 [Guardian] 성과 피드백 루프 검증 시작...");

  try {
    // 1. 가상의 성과 데이터 주입 (DB 연동 확인)
    const testUrl = "https://blog.naver.com/test/123";
    db.savePublishedPost("피드백 테스트", testUrl, ["테스트"], "IT", "naver1", "informative", "professional");
    
    // 강제로 조회수 업데이트
    db.updatePostMetrics(testUrl, { views: 1500, likes: 20, comments: 5 });
    console.log("✅ 가상 메트릭 주입 완료 (조회수: 1500)");

    // 2. 최고 성과 스타일 조회
    const bestStyles = db.getBestPerformingStyles(1);
    console.log("🏆 분석된 최고 성과 스타일:", bestStyles);

    if (bestStyles.length > 0 && bestStyles[0].persona === "informative") {
      console.log("✅ [Guardian] 성과 기반 스타일 분석 검증 성공!");
    } else {
      throw new Error("성과 데이터 분석 결과가 예상과 다릅니다.");
    }

  } catch (e) {
    console.error("❌ [Guardian] 검증 실패:", e.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTest();
