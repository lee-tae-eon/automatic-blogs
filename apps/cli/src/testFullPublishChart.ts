import dotenv from "dotenv";
import path from "path";
import { GeminiClient, generatePost, NaverPublisher, markdownToHtml } from "@blog-automation/core";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function testFullPublishChart() {
  const geminiKey = process.env.VITE_GEMINI_API_KEY || "";
  const client = new GeminiClient(geminiKey, "gemini-2.5-flash");
  
  const topic = "2026년 서울 주요 구별 아파트 매매가 추이 및 전망";
  console.log(`🚀 [Full Publish Test] Topic: ${topic}`);

  const task: any = {
    topic,
    persona: "informative",
    tone: "professional",
    category: "경제정보",
    mode: "manual",
  };

  try {
    const result = await generatePost({
      client,
      task,
      projectRoot: path.join(__dirname, "../../../"),
      onProgress: (msg: string) => console.log(`[GEN] ${msg}`)
    });

    if (result) {
      console.log("✅ Content generated! Converting to HTML and starting publication...");
      
      // 마크다운을 HTML로 변환 (중요!)
      const htmlContent = await markdownToHtml(result.content);
      const publicationWithHtml = { ...result, content: htmlContent };

      const publisher = new NaverPublisher(path.join(__dirname, "../../../"), "eongon");
      await publisher.publish({
        blogId: "eongon",
        password: process.env.USER1_PW || "Woo8328055@",
        headless: false,
        onProgress: (msg: string) => console.log(`[PUB] ${msg}`)
      }, publicationWithHtml);

      console.log("\n🎉 All processes completed! Check your Naver Blog.");
    }
  } catch (error) {
    console.error("❌ Error occurred:", error);
  }
}

testFullPublishChart();
