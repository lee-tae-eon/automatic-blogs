// apps/cli/src/batchIndex.ts

import {
  ExcelProcessor,
  generatePost,
  NaverPublisher,
  BLOG_PRESET,
  markdownToHtml,
} from "@blog-automation/core";
import { GeminiClient } from "@blog-automation/core/ai";
import { ENV } from "./env";

async function batchMain() {
  const apiKey = ENV.GEMINI_API_KEY;
  const modelName = ENV.GEMINI_MODEL_FAST;

  if (!apiKey || !modelName) {
    console.error("❌ API 키 없음");
    return;
  }

  // 1. 엑셀 파일 읽기
  const excelPath = process.env.EXCEL_PATH || "./blog-inputs.xlsx";
  console.log(`📊 엑셀 파일 읽는 중: ${excelPath}`);

  const inputs = ExcelProcessor.readTasks(excelPath);
  console.log(`✅ ${inputs.length}개 포스트 입력 데이터 로드 완료\n`);

  // 2. AI 클라이언트 초기화
  const aiClient = new GeminiClient(apiKey, modelName);
  const publisher = new NaverPublisher();

  // 3. 발행 설정
  const publishSettings = {
    blogId: process.env.NAVER_BLOG_ID || "",
    password: process.env.NAVER_PASSWORD,
    useAutoTags: true,
  };

  // 4. 각 포스트 생성 및 발행
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🤖 [${i + 1}/${inputs.length}] 포스트 생성 중...`);
    console.log(`📌 주제: ${input.topic}`);
    console.log(`🎭 페르소나: ${input.persona}`);
    console.log(`📁 카테고리: ${input.category}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      // 프리셋 적용
      const preset = BLOG_PRESET["naver"];

      // 페르소나 정규화 (Electron Main과 동일 로직)
      let persona = input.persona?.toLowerCase() || "informative";
      if (
        ["정보성", "정보", "info", "informative"].some((k) =>
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

      // 포스트 생성
      const post = await generatePost({
        client: aiClient,
        input: {
          ...input,
          persona, // 정규화된 페르소나 적용
          tone: input.tone || preset.tone,
          textLength: preset.textLength,
          sections: preset.sections,
        },
      });

      console.log(`✅ 포스트 생성 완료: ${post.title}`);

      // 마크다운 저장 (선택사항)
      // const filePath = await saveMarkdown(post);

      // HTML 변환
      const htmlContent = await markdownToHtml(post.content);

      // 네이버 블로그 발행
      if (publishSettings.blogId) {
        console.log(`\n🌐 네이버 블로그 업로드 중...`);

        await publisher.postToBlog({
          blogId: publishSettings.blogId,
          password: publishSettings.password,
          title: post.title,
          htmlContent: htmlContent,
          tags: publishSettings.useAutoTags ? post.tags : [],
          category: input.category, // 카테고리 정보 전달
        });

        console.log(`✅ [${i + 1}/${inputs.length}] 발행 완료!`);
      }

      // API 레이트 리밋 방지 (30초 대기)
      if (i < inputs.length - 1) {
        console.log(`\n⏳ 다음 포스트까지 30초 대기...`);
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    } catch (error) {
      console.error(`❌ [${i + 1}/${inputs.length}] 실패:`, error);

      // 실패해도 계속 진행할지 물어보기
      // 여기서는 계속 진행
      continue;
    }
  }

  console.log(`\n🎉 전체 배치 처리 완료!`);
}

batchMain().catch(console.error);
