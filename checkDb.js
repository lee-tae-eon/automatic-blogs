const { DbService } = require("./packages/core/dist");
const path = require("path");

async function checkDb() {
  const db = new DbService(process.cwd());
  console.log("🔍 [DB Audit] 현재 저장된 발행 포스팅 데이터 확인 중...");

  try {
    // 1. 전체 데이터 수 및 계정 목록 확인
    // SQLite를 직접 조회하거나 existing methods 활용
    // 여기서는 SqliteStorage의 db 객체에 직접 접근할 수 없으므로, 더미 조회를 통해 데이터 존재 여부 확인
    const keywords = ["%"]; // 모든 키워드 매칭 시도
    const accounts = ["prettyhihihi", "eongon", "prettyhihihi@naver.com", "eongon@naver.com"];
    
    for (const acc of accounts) {
      const links = db.getRelatedPosts([" "], 100, acc);
      console.log(`👤 계정 [${acc}]: ${links.length}개의 포스팅 발견`);
      if (links.length > 0) {
        links.forEach(l => console.log(`   - ${l.title} (${l.url})`));
      }
    }

  } catch (e) {
    console.error("❌ 조회 실패:", e.message);
  } finally {
    db.close();
  }
}

checkDb();
