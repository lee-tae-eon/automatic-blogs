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
  // 기본 모델명을 명시적으로 지정 (404 에러 방지)
  GEMINI_MODEL_FAST: process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-1.5-flash",
  VITE_GEMINI_MODEL_NORMAL: process.env.VITE_GEMINI_MODEL_NORMAL || "gemini-1.5-flash",
};