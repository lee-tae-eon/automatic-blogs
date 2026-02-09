import dotenv from "dotenv";
import path from "path";
import { runAutoPilot, GeminiClient } from "@blog-automation/core";
import { runAutoPilot as runAutoPilotDirect } from "../../../packages/core/src/pipeline/autoPilotProcess";
import { naverIdProfile } from "./testConstant";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function testAutoPilot() {
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
    broadTopic: "보험", // 구체적인 키워드가 아닌 넓은 주제 입력
    config,
    userDataPath: path.join(__dirname, "../../../"), // 프로젝트 루트 경로로 수정
    geminiClient: client,
    publishPlatforms: ["naver"], // 일단 네이버만 테스트
    credentials: {
      naver: {
        id: naverIdProfile.id,
        pw: naverIdProfile.password,
      },
    },
    headless: false, // 브라우저 창을 띄워서 확인
    onProgress: (msg: string) => console.log(`[LOG] ${msg}`),
  };

  console.log("🚀 오토파일럿 v2.0 테스트 시작...");
  console.log(
    `👤 사용 계정 (Naver): ${options.credentials.naver.id || "❌ 미설정"}`,
  );

  // 빌드 문제 방지를 위해 직접 경로 사용
  const result = await runAutoPilotDirect(options);

  if (result.success) {
    console.log("\n✨ 오토파일럿 작업 성공!");
    console.log(`📝 최종 점수: ${result?.analysis?.score}`);
  } else {
    console.log(`\n❌ 작업 실패: ${result.error}`);
  }
}

testAutoPilot();
