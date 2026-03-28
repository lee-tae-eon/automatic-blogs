import dotenv from "dotenv";
import path from "path";

// 경로 설정은 유지하되, 키 값 매핑을 사용자 요청에 맞춤
const envPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: envPath });

export const ENV = {
  // 사용자님이 말씀하신 실제 API 키 변수명 적용
  GEMINI_API_KEY:
    process.env.VITE_GEMINI_API_SUB_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    "",
  // 우선순위별 모델 리스트
  GEMINI_MODELS: [
    process.env.VITE_GEMINI_MODEL_3_1_PRO || "gemini-3.1-pro-preview",
    process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3.0-flash-preview",
    process.env.VITE_GEMINI_MODEL_3_1_FLASH_LITE || "gemini-3.1-flash-lite-preview",
    process.env.VITE_GEMINI_MODEL_2_5_FLASH || "gemini-2.5-flash",
    process.env.VITE_GEMINI_MODEL_2_5_FLASH_LITE || "gemini-2.5-flash-lite",
  ].filter(Boolean),
  
  GEMINI_MODEL_DEFAULT: process.env.VITE_GEMINI_MODEL_3_0_FLASH || "gemini-3.0-flash-preview",
};