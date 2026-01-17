import { delay } from "./delay";

export async function safeGenerate<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    // Gemini 429 대응
    if (e?.status === 429 || e?.message?.includes("429")) {
      console.log("⏳ Gemini quota 초과, 25초 대기 후 재시도...");
      await delay(25000);
      return await fn();
    }
    throw e;
  }
}
