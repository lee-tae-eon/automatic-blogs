import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { GeminiClient, generatePost, markdownToHtml } from "@blog-automation/core";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function manualTest() {
  const geminiKey = process.env.VITE_GEMINI_API_KEY || "";
  const client = new GeminiClient(geminiKey, "gemini-2.5-flash");

  const topic = "경남 양산 풍력발전기 화재";
  console.log(`Topic: ${topic}`);

  const task: any = {
    topic,
    persona: "informative",
    tone: "professional",
    category: "news",
    mode: "auto",
    strategy: {
      headings: ["사건 개요", "화재 원인 및 피해", "대응 현황", "시사점"],
      suggestedOutline: ["## 1. 경남 양산 풍력발전기 화재 사건 요약", "## 2. 발생 경위 및 피해 현황", "## 3. 소방 당국 및 지자체 대응 상황", "## 4. 풍력발전 설비 안전 관리의 필요성", "## 5. 결론"],
      differentiationStrategy: "3줄 요약과 핵심 수치 테이블을 통해 빠른 정보 전달",
      styleDNA: "건조한 분석가 톤, 2문장마다 줄바꿈 강제",
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

      const outputPathMd = path.join(outputDir, "test_result_yangsan.md");
      const outputPathHtml = path.join(outputDir, "test_result_yangsan.html");
      
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
