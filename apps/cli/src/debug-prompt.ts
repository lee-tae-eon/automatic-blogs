import {
  generateBlogPrompt,
  BlogPostInput,
  PERSONA_CONFIG,
  TONE_CONFIG,
} from "@blog-automation/core";

// --- 디버깅할 입력값을 여기에서 수정하세요 ---
const sampleInput: BlogPostInput = {
  topic: "오늘의 날씨와 패션",
  persona: PERSONA_CONFIG.informative, // 테스트하고 싶은 페르소나
  tone: TONE_CONFIG.professional, // 테스트하고 싶은 톤
  category: "일상",
};
// -----------------------------------------

console.log("--- [Debug] 입력값 ---");
console.log(sampleInput);
console.log("---------------------\n");

try {
  console.log("🚀 generateBlogPrompt 함수를 호출합니다...");
  generateBlogPrompt(sampleInput);
  console.log("\n✅ 프롬프트가 성공적으로 생성되었습니다.");
  // console.log(prompt); // 전체 프롬프트를 보고 싶으면 주석 해제
} catch (error) {
  console.error("\n❌ 프롬프트 생성 중 오류 발생:", error);
}
