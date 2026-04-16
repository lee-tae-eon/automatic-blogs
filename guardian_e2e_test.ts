
import { DbService } from "./packages/core/src/services/dbService";
import path from "path";

async function verifyIsolation() {
  const db = new DbService(process.cwd());
  const keywords = ["삼성", "주식", "보험"];
  
  console.log("🔍 [Guardian Test] 계정별 데이터 격리 테스트 시작...");

  // 1. 이슈슈 카테고리 테스트 (prettyhihihi@naver.com 매핑 확인)
  const ishuAccount = "prettyhihihi@naver.com";
  const ishuLinks = db.getRelatedPosts(keywords, 5, ishuAccount);
  console.log(`\n[Test 1] '이슈슈' 계정 (${ishuAccount}) 결과:`);
  ishuLinks.forEach(link => {
    console.log(` - 제목: ${link.title} | URL: ${link.url}`);
  });

  // 2. 일반 카테고리 테스트 (eongon@naver.com 매핑 확인)
  const normalAccount = "eongon@naver.com";
  const normalLinks = db.getRelatedPosts(keywords, 5, normalAccount);
  console.log(`\n[Test 2] 일반 계정 (${normalAccount}) 결과:`);
  normalLinks.forEach(link => {
    console.log(` - 제목: ${link.title} | URL: ${link.url}`);
  });

  // 3. 검증
  const ishuViolation = ishuLinks.some(link => !link.url.includes("prettyhihihi") && ishuAccount === "prettyhihihi@naver.com");
  // 참고: 실제 네이버 URL에는 계정명이 포함되어 있을 것이므로 이를 통해 검증 가능
  
  console.log("\n✅ [Guardian Audit] 테스트 완료.");
  db.close();
}

verifyIsolation();
