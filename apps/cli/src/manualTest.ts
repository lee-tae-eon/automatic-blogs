import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { GeminiClient, generatePost, markdownToHtml } from "@blog-automation/core";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function manualTest() {
  const geminiKey = process.env.VITE_GEMINI_API_KEY || "";
  const client = new GeminiClient(geminiKey, "gemini-2.5-flash");

  const topic = "일본 다카이치 총리 패딩 이슈와 패션 분석";
  console.log(`Topic: ${topic}`);

  const task: any = {
    topic,
    persona: "informative",
    tone: "professional",
    category: "international",
    mode: "auto", 
    strategy: {
      headings: ["다카이치 총리의 패딩 화제 이유", "패딩 브랜드 및 특징 분석", "일본 내 여론과 반응", "정치인의 패션이 가지는 의미"],
      suggestedOutline: ["## 1. 다카이치 사나에 총리의 패딩이 화제가 된 배경", "## 2. 해당 패딩 브랜드 정보 및 상세 스펙", "## 3. 일본 현지 반응: 찬반 양론 정리", "## 4. 정치적 메시지로서의 패션 분석", "## 5. 결론: 대중과 소통하는 새로운 방식"],
      differentiationStrategy: "단순 가십이 아닌, 해당 브랜드의 역사와 일본 내수 경제, 그리고 정치인의 이미지 메이킹 관점에서 심층 분석",
      styleDNA: "리드미컬한 문체, 수치와 브랜드 스펙은 리스트로 정리",
      estimatedLength: 2000,
      hasTable: true
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

      const outputPathMd = path.join(outputDir, "test_result_takaichi.md");
      fs.writeFileSync(outputPathMd, result.content);

      console.log("\nSuccess!");
      console.log(`MD: ${outputPathMd}`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

manualTest();
