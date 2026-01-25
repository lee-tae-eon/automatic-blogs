// ✅ Node.js 20 미만 버전 호환성 패치 (undici 에러 해결)
import { File } from "node:buffer";
// import fs from "node:fs"; // fs 모듈 임포트
// import path from "node:path";

if (typeof global.File === "undefined") {
  (global as any).File = File;
}

import { GeminiClient } from "@blog-automation/core/src/ai";
import { BlogPostInput } from "@blog-automation/core/src/types/blog";
import {
  generatePost,
  NaverPublisher,
  pubProcess,
  saveMarkdown,
} from "@blog-automation/core/src";
import { ENV } from "./env";
import { BLOG_PRESET } from "@blog-automation/core/src/util/platform";
import { naverIdProfile } from "./testConstant";

const preset = BLOG_PRESET["naver"];

// 사용자 인터페이스 (입구)
async function main() {
  const isVerbose = process.argv.includes("--verbose");
  const apiKey = ENV.GEMINI_API_KEY;
  const modelName = ENV.GEMINI_MODEL_FAST;

  if (!apiKey || !modelName) {
    console.error(
      "❌ GEMINI_API_KEY 또는 modelName이 없습니다. .env 파일을 확인해주세요.",
    );
    return;
  }

  const input = {
    topic: "Kospi 5000",
    tone: preset.tone,
    textLength: preset.textLength,
    persona: "주식 전문가",
    sections: preset.sections,
    keywords: "코스피, 주식, 전망", // 테스트용 키워드 추가
    category: "경제", // 테스트용 카테고리 추가
  };
  console.log(`\n🚀 블로그 자동 생성 시작!`);
  console.log(`📌 주제: ${input.topic}`);
  // Gemini 클라이언트 초기화
  const aiClient = new GeminiClient(apiKey, modelName);

  try {
    // 페르소나 정규화 (Desktop 앱과 동일 로직)
    let persona = input.persona;
    if (
      ["정보성", "정보", "info", "informative", "전문가", "분석"].some((k) =>
        persona.includes(k),
      )
    ) {
      persona = "informative";
    } else if (
      ["공감형", "공감", "empathy", "empathetic"].some((k) =>
        persona.includes(k),
      )
    ) {
      persona = "empathetic";
    }

    const post = await generatePost({
      client: aiClient,
      input: { ...input, persona },
    });

    try {
      console.log("\n✅ 포스트 생성이 완료되었습니다!");

      if (isVerbose) {
        console.log("--------------------------------------");
        console.log(post.content);
        console.log("--------------------------------------");
      }

      const filePath = await saveMarkdown(post);
      console.log(`📄 마크다운 저장 완료: ${filePath}`);

      const fileHtml = await pubProcess(filePath);
      console.log(`📄 HTML 변환 완료 (길이: ${fileHtml.length}자)`);

      if (isVerbose) {
        console.log("--------------------------------------");
        console.log(fileHtml);
        console.log("--------------------------------------");
      }

      const publisher = new NaverPublisher();

      // const testFileName =
      //   "1769027964377_2026년_달라지는_육아휴직_최신_제도_분석_및_현명한_활용법.html";
      // const filePath = path.join(process.cwd(), "output", testFileName);

      // // 2. 파일 읽기
      // if (!fs.existsSync(filePath)) {
      //   console.error("❌ 파일을 찾을 수 없습니다. 경로를 확인해주세요.");
      //   return;
      // }
      // const fileHtml = fs.readFileSync(filePath, "utf-8");

      // 3. (옵션) 제목은 파일명에서 추출하거나 수동 지정
      // const testTitle = "2026년 육아휴직 가이드 (로컬 테스트)";

      console.log("🌐 네이버 블로그 업로드 프로세스 시작...");
      // ! 테스트코드
      // await publisher.postToBlog({
      //   blogId: naverIdProfile.id,
      //   title: testTitle,
      //   htmlContent: fileHtml,
      //   password: naverIdProfile.password,
      // });
      // ! 실행코드
      await publisher.postToBlog({
        blogId: naverIdProfile.id,
        title: post.title,
        htmlContent: fileHtml,
        password: naverIdProfile.password,
        tags: post.focusKeywords,
        category: input.category, // 카테고리 정보 전달
      });
    } catch (fileError) {
      // 포스트는 생성됐는데 파일 시스템 에러가 난 경우
      console.error("🚨 파일 처리 중 오류 발생:", fileError);
      // 여기서 post 데이터를 로그로 찍어두면 나중에 수동 복구라도 가능합니다.
    }
  } catch (aiError) {
    console.error("🚨 Ai agent 오류 발생:", aiError);
  }
}

main();
