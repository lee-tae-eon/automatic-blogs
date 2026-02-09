import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { GeminiClient } from "@blog-automation/core";
import { runAutoPilot } from "../../../packages/core/src/pipeline/autoPilotProcess";
import { naverIdProfile } from "./testConstant";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function debugAutoPilot() {
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
    broadTopic: "태아보험 가입시기와 주의사항",
    blogBoardName: "일상정보",
    config,
    userDataPath: path.join(__dirname, "../../../"),
    geminiClient: client,
    publishPlatforms: [], // 발행은 하지 않고 생성까지만 진행
    credentials: {
      naver: { id: naverIdProfile.id, pw: naverIdProfile.password }
    },
    headless: true,
    onProgress: (msg: string) => console.log(`[LOG] ${msg}`),
  };

  console.log("🔍 [Debug] 오토파일럿 마크다운 분석 시작...");
  
  const result = await runAutoPilot(options);

  if (result.success && result.publication) {
    const rawMd = result.publication.content;
    const filePath = path.join(__dirname, "../output/debug_post.md");
    
    // 디렉토리 생성
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    fs.writeFileSync(filePath, rawMd, "utf8");
    console.log(`\n✅ 원본 마크다운이 저장되었습니다: ${filePath}`);
    console.log("------------------------------------------");
    console.log("📄 마크다운 미리보기 (처음 500자):");
    console.log(rawMd.slice(0, 500));
    console.log("------------------------------------------");
  } else {
    console.log(`\n❌ 실패: ${result.error}`);
  }
}

debugAutoPilot();
