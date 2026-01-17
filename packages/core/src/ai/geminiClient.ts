import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { BaseAiClient } from "./types";

export class GeminiClient implements BaseAiClient {
  private model: GenerativeModel;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 가장 가성비 좋은 flash 모델 사용
    this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  async generateText(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  async generateJson<T>(prompt: string): Promise<T> {
    const result = await this.model.generateContent([
      prompt,
      "반드시 Markdown code block 없이 순수한 JSON 데이터만 응답해줘.",
    ]);
    const text = result.response.text();
    return JSON.parse(text) as T;
  }
}
