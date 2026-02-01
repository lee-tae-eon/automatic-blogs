// ✅ Node.js 환경 패치
import { File } from "node:buffer";
if (typeof global.File === "undefined") {
  (global as any).File = File;
}

import {
  BatchTask,
  GeminiClient,
  generatePost,
  NaverPublisher,
} from "@blog-automation/core";

import { ENV } from "./env";
import { naverIdProfile } from "./testConstant";

async function main() {
  const isVerbose = process.argv.includes("--verbose");
  const isDryRun = process.argv.includes("--dry-run"); // 실제 발행은 안 하고 로그만 확인

  console.log(`\n🛠️  [DEBUG MODE] 블로그 자동화 로직 검증 시작`);

  // 1. 최신 규격에 맞춘 테스트 입력 데이터
  const input: BatchTask = {
    topic: "청라 ", // 살고 계신 지역 기반 예시
    persona: "informative", // 이제 문자열 매칭 대신 enum/type 사용
    tone: "professional", // 새로 추가한 톤앤매너
    keywords: ["영종도맛집", "인천여행", "내돈내산"],
    category: "일상정보",
    platform: "naver",
    status: "대기",
  };

  const aiClient = new GeminiClient(ENV.GEMINI_API_KEY, ENV.GEMINI_MODEL_FAST);

  try {
    // 2. AI 포스트 생성 (최신 프롬프트 생성 로직 연동)
    console.log(
      `   🤖 AI 글 생성 중... (Persona: ${input.persona}, Tone: ${input.tone})`,
    );
    const post = await generatePost({
      client: aiClient,
      task: input,
    });

    console.log(`   ✅ 글 생성 완료: ${post.title}`);

    if (isVerbose) {
      console.log("\n--- [생성된 본문 미리보기] ---");
      console.log(post.content.substring(0, 500) + "...");
      console.log("----------------------------\n");
    }

    if (isDryRun) {
      console.log("   ℹ️  Dry-run 모드이므로 발행을 생략합니다.");
      return;
    }

    // 3. 최신 NaverPublisher 로직 실행
    // 이제 NaverPublisher 내부의 NaverEditor가
    // 우리가 만든 HTML 붙여넣기 + 이미지 정제 로직을 실행함
    const publisher = new NaverPublisher();

    console.log("   🌐 네이버 블로그 업로드 시작...");
    await publisher.postToBlog({
      blogId: naverIdProfile.id,
      password: naverIdProfile.password,
      title: post.title,
      htmlContent: post.content, // 이제 core 내부에서 HTML 변환까지 처리되도록 연결
      tags: post.focusKeywords,
      category: input.category,
    });

    console.log("\n✨ 디버깅 프로세스가 성공적으로 완료되었습니다!");
  } catch (error) {
    console.error("\n🚨 디버깅 중 오류 발생:");
    console.error(error instanceof Error ? error.stack : error);
  }
}

main();
