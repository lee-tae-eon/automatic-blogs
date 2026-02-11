import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { GeminiClient, generatePost, markdownToHtml } from "@blog-automation/core";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function manualTest() {
  const geminiKey = process.env.VITE_GEMINI_API_KEY || "";
  const client = new GeminiClient(geminiKey, "gemini-2.5-flash");

  const topic = "중국인 개발자, 퇴사 전 공격 테스트 논란";
  console.log(`Topic: ${topic}`);

  const task: any = {
    topic,
    persona: "reporter",
    tone: "professional",
    category: "it-news",
    mode: "auto",
    strategy: {
      headings: ["사건 개요", "충격적인 수법", "업계 반응", "시사점"],
      suggestedOutline: ["## 1. 퇴사 전 시스템 공격? 사건의 전말", "## 2. 정밀 분석: 그가 심어놓은 '시한폭탄'", "## 3. 현장 반응: 분노한 IT 업계와 법적 쟁점", "## 4. 재발 방지를 위한 기업들의 과제", "## 5. 결론"],
      differentiationStrategy: "단순 보도가 아닌, 기술적 관점에서의 공격 방식 분석과 업계의 생생한 목소리를 담은 긴급 리포트",
      styleDNA: "속도감 있는 리포터 문체, !!빨강!! 강조 다수 활용, 인용구 활용",
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

      const outputPathMd = path.join(outputDir, "test_result_china_dev.md");
      const outputPathHtml = path.join(outputDir, "test_result_china_dev.html");
      
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