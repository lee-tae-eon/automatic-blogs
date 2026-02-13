import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { GeminiClient, generatePost } from "@blog-automation/core";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function testChartManual() {
  const geminiKey = process.env.VITE_GEMINI_API_KEY || "";
  const client = new GeminiClient(geminiKey, "gemini-2.5-flash");

  const topic = "2026년 서울 주요 구별 아파트 평균 매매가 비교 분석";
  console.log(`[Manual Chart Test] Topic: ${topic}`);

  const task: any = {
    topic,
    persona: "informative",
    tone: "professional",
    category: "부동산/경제",
    mode: "manual",
  };

  try {
    const result = await generatePost({
      client,
      task,
      projectRoot: path.join(__dirname, "../../../"),
      onProgress: (msg: string) => console.log(`[PROGRESS] ${msg}`)
    });

    if (result) {
      const outputDir = path.join(__dirname, "../output");
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const outputPathMd = path.join(outputDir, "test_manual_chart.md");
      fs.writeFileSync(outputPathMd, result.content);

      console.log("\nSuccess!");
      console.log(`MD: ${outputPathMd}`);
      
      if (result.content.includes("[차트:")) {
        console.log("Chart tag generated!");
      } else {
        console.log("No chart tag generated.");
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testChartManual();
