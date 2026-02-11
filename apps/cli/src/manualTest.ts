import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { GeminiClient, generatePost, markdownToHtml } from "@blog-automation/core";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function manualTest() {
  const geminiKey = process.env.VITE_GEMINI_API_SUB_KEY || "";
  const client = new GeminiClient(geminiKey, "gemini-2.5-flash");

  const topic = "2026년 최저임금 결정 구조 개편안 추진 배경과 노동계·경영계 반응";
  console.log(`Topic: ${topic}`);

  const task: any = {
    topic,
    persona: "reporter",
    tone: "professional",
    category: "economy",
    mode: "auto",
    strategy: {
      headings: ["개편안 핵심 내용", "노동계 반발 이유", "경영계 요구 사항", "향후 전망"],
      suggestedOutline: ["## 1. 최저임금 결정 방식, 37년 만에 바뀐다", "## 2. 핵심 포인트: 산정 기준과 위원회 구성 변화", "## 3. 팽팽한 입장 차이: 노동계 vs 경영계", "## 4. 전문가 제언 및 향후 일정", "## 5. 결론: 상생을 위한 합의가 관건"],
      differentiationStrategy: "복잡한 법안 개편 내용을 쉼표 뒤 줄바꿈을 통해 시각적으로 아주 쉽게 풀어내고 핵심 키워드 볼드 처리",
      styleDNA: "현장감 있는 리포터 문체, 마이크로 브리딩 필수 적용, 핵심 단어 굵게 강조",
      estimatedLength: 1500,
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

      const outputPathMd = path.join(outputDir, "test_result_minimum_wage.md");
      const outputPathHtml = path.join(outputDir, "test_result_minimum_wage.html");
      
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
