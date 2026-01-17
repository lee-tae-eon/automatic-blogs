import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { BaseAiClient } from "./types";

export class GeminiClient implements BaseAiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    // 가장 가성비 좋은 flash 모델 사용
    // 2. this 키워드를 사용하여 멤버 변수에 할당
    this.genAI = new GoogleGenerativeAI(apiKey);
    // 최신 모델인 gemini-1.5-flash-latest 사용
    this.model = this.genAI.getGenerativeModel({
      model: "models/gemini-1.5-flash",
    });
  }

  async generateText(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  async generateJson<T>(prompt: string): Promise<T> {
    const result = await this.model.generateContent([
      prompt,
      "반드시 Markdown code block(```json) 없이 순수한 JSON 데이터만 응답해줘.",
    ]);
    const text = result.response.text();

    try {
      // 혹시라도 AI가 앞뒤에 공백이나 설명을 붙일 경우를 대비해 trim() 추가
      return JSON.parse(text.trim()) as T;
    } catch (error) {
      console.error("JSON 파싱 에러. 원문 데이터:", text);
      throw new Error("AI가 유효한 JSON 형식을 반환하지 않았습니다.");
    }
  }
}
