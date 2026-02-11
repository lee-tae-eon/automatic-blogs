import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { GeminiClient, generatePost, markdownToHtml } from "@blog-automation/core";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function manualTest() {
  // 서브 키 사용 (할당량 이슈 방지)
  const geminiKey = process.env.VITE_GEMINI_API_SUB_KEY || "";
  const client = new GeminiClient(geminiKey, "gemini-2.5-flash");

  const topic = "백악관과 미 하원의 쿠팡 조사 착수 배경과 파장";
  console.log(`Topic: ${topic}`);

  const task: any = {
    topic,
    persona: "reporter",
    tone: "professional",
    category: "world-news",
    mode: "auto",
    strategy: {
      headings: ["조사 착수 배경", "주요 조사 쟁점", "쿠팡 및 업계 반응", "향후 전망"],
      suggestedOutline: ["## 1. 미 백악관·하원, 쿠팡 전격 조사 착수 왜?", "## 2. 핵심 쟁점: 노동 환경과 반독재 행위 여부", "## 3. 쿠팡의 공식 입장과 미국 내 여론", "## 4. 이번 조사가 국내외 시장에 미칠 파장", "## 5. 결론: 글로벌 스탠다드와 기업의 과제"],
      differentiationStrategy: "단순 보도를 넘어 미 정계의 시각과 기술적 독점 문제를 리포터 시각에서 심층 분석",
      styleDNA: "생동감 있는 리포터 문체, 쉼표 뒤 줄바꿈(Micro-Breathing) 필수, 핵심 단어 굵게 강조",
      estimatedLength: 1500,
      hasTable: false
    }
  };

  try {
    const result = await generatePost({
      client,
      task,
      projectRoot: path.join(__dirname, "../../../"),
      onProgress: (msg: string) => console.log(`[LOG] ${msg}`)
    });

    if (result) {
      const html = await markdownToHtml(result.content);
      const outputDir = path.join(__dirname, "../output");
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const outputPathMd = path.join(outputDir, "test_result_coupang_investigation.md");
      const outputPathHtml = path.join(outputDir, "test_result_coupang_investigation.html");
      
      fs.writeFileSync(outputPathMd, result.content);
      fs.writeFileSync(outputPathHtml, html);

      console.log("\nSuccess!");
      console.log(`MD: ${outputPathMd}`);
      console.log(`HTML: ${outputPathHtml}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

manualTest();