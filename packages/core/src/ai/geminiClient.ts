import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { BaseAiClient } from "./types";

export class GeminiClient implements BaseAiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string, modelName: string) {
    // 가장 가성비 좋은 flash 모델 사용
    // 2. this 키워드를 사용하여 멤버 변수에 할당
    this.genAI = new GoogleGenerativeAI(apiKey);

    // 최신 모델인 gemini-1.5-flash-latest 사용
    this.model = this.genAI.getGenerativeModel({
      model: modelName,
    });
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.log(`🛑 ${err}`);
      throw new Error("🛑 Fail to Generate Content");
    }
  }

  async generateJson<T>(prompt: string): Promise<T> {
    let cleanedText = "";

    try {
      const result = await this.model.generateContent([
        prompt,
        "반드시 다른 설명 없이 순수한 JSON 데이터만 응답하세요.",
      ]);
      const responseText = result.response.text();

      // 1. 마크다운 코드 블록 제거 및 텍스트 정제
      cleanedText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      // 2. 만약 앞뒤에 설명이 붙어있을 경우를 대비해 첫 '{'와 마지막 '}' 사이만 추출
      const jsonStart = cleanedText.indexOf("{");
      const jsonEnd = cleanedText.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error(`JSON 형식을 찾을 수 없습니다: ${responseText}`);
      }
      cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(cleanedText.trim()) as T;
    } catch (error) {
      console.error("JSON 파싱 에러. 원문 데이터:", cleanedText);
      throw new Error("AI가 유효한 JSON 형식을 반환하지 않았습니다.");
    }
  }
}
