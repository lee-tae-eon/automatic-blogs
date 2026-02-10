import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { GeminiClient, markdownToHtml } from "@blog-automation/core";
import { generatePost } from "../../../packages/core/src/pipeline/generatePost";
import { runAutoPilot } from "../../../packages/core/src/pipeline/autoPilotProcess";
import { naverIdProfile } from "./testConstant";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function testBothModes() {
  const geminiKey = process.env.VITE_GEMINI_API_KEY || "";
  const client = new GeminiClient(geminiKey, "gemini-2.5-flash");
  const outputDir = path.join(__dirname, "../output/test_results");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const topic = "2026년 가계부채 관리 전략";

  // ==========================================
  // 1. Manual Mode 테스트
  // ==========================================
  console.log("🚀 [Manual Mode] 테스트 시작...");
  const manualTask: any = {
    topic,
    persona: "informative",
    tone: "professional",
    category: "경제/재테크",
    status: "진행",
    mode: "manual"
  };

  const manualPost = await generatePost({ client, task: manualTask });
  const manualHtml = await markdownToHtml(manualPost.content);
  
  fs.writeFileSync(path.join(outputDir, "manual_output.md"), manualPost.content, "utf8");
  fs.writeFileSync(path.join(outputDir, "manual_output.html"), manualHtml, "utf8");
  console.log("✅ Manual Mode 결과 저장 완료");

  // ==========================================
  // 2. Auto-Pilot Mode 테스트
  // ==========================================
  console.log("\n🚀 [Auto-Pilot Mode] 테스트 시작...");
  const config = {
    searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
    searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
    adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
    adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
    adCustomerId: process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
  };

  const autoResult = await runAutoPilot({
    broadTopic: topic,
    blogBoardName: "경제공부",
    config,
    userDataPath: path.join(__dirname, "../../../"),
    geminiClient: client,
    publishPlatforms: [], // 생성까지만
    credentials: { naver: { id: naverIdProfile.id, pw: naverIdProfile.password } },
    onProgress: (msg) => console.log(`[LOG] ${msg}`),
  });

  if (autoResult.success && autoResult.publication) {
    const autoHtml = await markdownToHtml(autoResult.publication.content);
    fs.writeFileSync(path.join(outputDir, "auto_output.md"), autoResult.publication.content, "utf8");
    fs.writeFileSync(path.join(outputDir, "auto_output.html"), autoHtml, "utf8");
    console.log("✅ Auto-Pilot Mode 결과 저장 완료");
  }

  console.log(`\n✨ 모든 테스트 완료! 결과물은 '${outputDir}' 폴더에서 확인하세요.`);
}

testBothModes();
