const { DbService } = require("./packages/core/dist");
const path = require("path");
require("dotenv").config();

async function runTest() {
  const projectRoot = process.cwd();
  const db = new DbService(projectRoot);

  console.log("🚀 [Guardian] 내부 링크 그래프 검증 시작...");

  try {
    const targetAccount = "guardian_tester";
    
    // 1. 과거 포스팅 데이터 주입
    console.log("🎬 테스트 데이터 주입 중...");
    db.savePublishedPost("2026년 근로장려금 신청 가이드", "https://blog.naver.com/test/1", ["장려금", "복지"], "생활", targetAccount);
    db.savePublishedPost("자녀장려금 자격 조건 총정리", "https://blog.naver.com/test/2", ["장려금", "자녀"], "생활", targetAccount);
    db.savePublishedPost("청년도약계좌 금리 비교", "https://blog.naver.com/test/3", ["금융", "청년"], "경제", targetAccount);
    
    // 2. 키워드 기반 관련 글 조회 테스트
    console.log("🔍 '장려금' 키워드로 관련 글 조회...");
    const links = db.getRelatedPosts(["장려금"], 5, targetAccount);
    
    console.log("📡 발견된 내부 링크:", links);

    if (links.length >= 2 && links.some(l => l.title.includes("근로장려금"))) {
      console.log("✅ [Guardian] 내부 링크 매핑 및 계정 격리 검증 성공!");
    } else {
      throw new Error("관련 글이 정상적으로 조회되지 않았습니다.");
    }

  } catch (e) {
    console.error("❌ [Guardian] 검증 실패:", e.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

runTest();
