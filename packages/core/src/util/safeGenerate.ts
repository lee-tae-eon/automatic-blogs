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
