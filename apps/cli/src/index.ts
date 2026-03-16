// ✅ Node.js 환경 패치
import { File } from "node:buffer";
if (typeof global.File === "undefined") {
  (global as any).File = File;
}

// ⚠️ 중요: 환경 변수 로드가 다른 모듈보다 먼저 실행되어야 함
import { ENV } from "./env";

import {
  BatchTask,
  GeminiClient,
  generatePost,
  NaverPublisher,
  markdownToHtml,
} from "@blog-automation/core";

import { naverIdProfile } from "./testConstant";

async function main() {
  const isVerbose = process.argv.includes("--verbose");
  const isDryRun = process.argv.includes("--dry-run"); // 실제 발행은 안 하고 로그만 확인

  console.log(`\n🛠️  [DEBUG MODE] 블로그 자동화 로직 검증 시작`);

  // 1. 최신 규격에 맞춘 테스트 입력 데이터
  const input: BatchTask = {
    topic: "청라 맛집", // 살고 계신 지역 기반 예시
    persona: "informative", // 이제 문자열 매칭 대신 enum/type 사용
    tone: "professional", // 새로 추가한 톤앤매너
    keywords: ["청라맛집", "인천맛집", "내돈내산"],
    category: "맛집",
    status: "대기",
  };

  const aiClient = new GeminiClient(ENV.GEMINI_API_KEY, ENV.GEMINI_MODEL_DEFAULT);

  try {
    // 2. AI 포스트 생성 (최신 프롬프트 생성 로직 연동)
    console.log(
      `   🤖 AI 글 생성 중... (Persona: ${input.persona}, Tone: ${input.tone})`,
    );
    const post = await generatePost({
      client: aiClient,
      task: input,
      onProgress: (msg) => console.log(`      > ${msg}`),
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
    const publisher = new NaverPublisher();
    
    // Markdown -> HTML 변환 (데스크탑 앱과 동일하게 처리)
    const htmlContent = await markdownToHtml(post.content);

    console.log("   🌐 네이버 블로그 업로드 시작...");
    await publisher.postToBlog({
      blogId: naverIdProfile.id,
      password: naverIdProfile.password,
      title: post.title,
      htmlContent: htmlContent, 
      tags: post.tags || post.focusKeywords,
      category: input.category,
      references: post.references,
      persona: input.persona, // ✅ 추가된 필드
      tone: input.tone,       // ✅ 추가된 필드
      onProgress: (msg) => console.log(`      > ${msg}`),
    });

    console.log("\n✨ 디버깅 프로세스가 성공적으로 완료되었습니다!");
  } catch (error) {
    console.error("\n🚨 디버깅 중 오류 발생:");
    console.error(error instanceof Error ? error.stack : error);
  }
}

main();
