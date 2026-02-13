import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { GeminiClient, markdownToHtml } from "@blog-automation/core";
import { runAutoPilot } from "../../../packages/core/src/pipeline/autoPilotProcess";
import { naverIdProfile } from "./testConstant";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function testEnhancedProcess() {
  const config = {
    searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
    searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
    adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
    adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
    adCustomerId: process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
  };

  const geminiKey = process.env.VITE_GEMINI_API_KEY || "";
  const client = new GeminiClient(geminiKey, "gemini-2.5-flash");

  const options: any = {
    broadTopic: "2026년 태아보험 가입 시기 및 비갱신형 vs 갱신형 비교 분석",
    blogBoardName: "일상정보",
    config,
    userDataPath: path.join(__dirname, "../../../"),
    geminiClient: client,
    publishPlatforms: [], // 발행은 하지 않고 생성까지만 진행
    credentials: {
      naver: { id: naverIdProfile.id, pw: naverIdProfile.password }
    },
    headless: true,
    onProgress: (msg: string) => console.log(`[PROGRESS] ${msg}`),
  };

  console.log("🔍 [Enhanced Test] 오토파일럿 고도화 버전 생성 시작...");
  
  try {
    const result = await runAutoPilot(options);

    if (result.success && result.publication) {
      const rawMd = result.publication.content;
      const htmlContent = await markdownToHtml(rawMd);
      
      const outputDir = path.join(__dirname, "../output");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const mdPath = path.join(outputDir, "test_enhanced_post.md");
      const htmlPath = path.join(outputDir, "test_enhanced_post.html");

      fs.writeFileSync(mdPath, rawMd, "utf8");
      fs.writeFileSync(htmlPath, htmlContent, "utf8");

      console.log(`
✅ 테스트 완료!`);
      console.log(`📄 MD: ${mdPath}`);
      console.log(`🌐 HTML: ${htmlPath}`);
    } else {
      console.log(`
❌ 실패: ${result.error}`);
    }
  } catch (error) {
    console.error("❌ 실행 중 오류:", error);
  }
}

testEnhancedProcess();
