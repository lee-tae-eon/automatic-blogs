import { delay } from "./delay";

export async function safeGenerate<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  const maxRetries = 3;

  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      attempt++;
      if (attempt >= maxRetries) throw e;

      // Gemini 429 대응
      if (e?.status === 429 || e?.message?.includes("429")) {
        console.log(
          `⏳ Gemini quota 초과, 25초 대기 후 재시도... (${attempt}/${maxRetries})`,
        );
        await delay(25000);
        continue;
      }

      // JSON 파싱 에러 대응
      if (
        e?.message?.includes("JSON") ||
        e?.message?.includes("SyntaxError") ||
        e?.message?.includes("유효한 JSON")
      ) {
        console.log(
          `⚠️ JSON 파싱 오류, 재시도합니다... (${attempt}/${maxRetries})`,
        );
        await delay(2000);
        continue;
      }

      throw e;
    }
  }
}

// 유틸리티 함수 추가
export const extractJson = (text: any): any => {
  // 이미 객체라면(이미 파싱되었다면) 그대로 반환
  if (typeof text !== "string") return text;

  try {
    // 1. 마크다운 코드 블록 제거 (```json ... ```)
    const jsonMatch = text.match(/```json?\s*([\s\S]*?)\s*```/);
    const targetText = jsonMatch ? jsonMatch[1] : text;

    // 2. 중괄호 { } 사이의 내용만 추출
    const firstBrace = targetText.indexOf("{");
    const lastBrace = targetText.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1) {
      const cleanJson = targetText.substring(firstBrace, lastBrace + 1);
      return JSON.parse(cleanJson);
    }

    return JSON.parse(targetText);
  } catch (e) {
    console.error("JSON 파싱 실패. 원문 요약:", text.substring(0, 100));
    throw new Error("AI가 유효한 JSON 형식을 보내지 않았습니다.");
  }
};
