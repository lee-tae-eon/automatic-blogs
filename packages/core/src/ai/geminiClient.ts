import {
  GoogleGenerativeAI,
  GenerativeModel,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
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
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });
  }

  async generateText(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      console.log(`🛑 ${err}`);
      throw new Error(`🛑 Fail to Generate Content: ${err.message || err}`);
    }
  }

  async generateJson<T>(prompt: string): Promise<T> {
    let responseText = "";

    try {
      const result = await this.model.generateContent([
        prompt,
        "반드시 다른 설명 없이 순수한 JSON 데이터만 응답하세요.",
      ]);
      responseText = result.response.text();
    } catch (error: any) {
      // API 호출 자체에서 에러가 발생한 경우 (e.g., 429, 500)
      // 에러를 그대로 다시 던져서 상위에서 처리하도록 합니다.
      console.error("Gemini API 호출 실패:", error.message);
      throw error;
    }

    // API 호출은 성공했으나, 응답을 파싱하는 과정에서 에러가 발생할 수 있습니다.
    try {
      // 1. 마크다운 코드 블록 제거 및 텍스트 정제
      const cleanedText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      // 2. 만약 앞뒤에 설명이 붙어있을 경우를 대비해 첫 '{'와 마지막 '}' 사이만 추출
      const jsonStart = cleanedText.indexOf("{");
      const jsonEnd = cleanedText.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error(`응답에서 JSON 형식을 찾을 수 없습니다.`);
      }
      const jsonString = cleanedText.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonString.trim()) as T;
    } catch (parseError: any) {
      // 이 경우는 순수한 JSON 파싱 에러입니다.
      console.error("JSON 파싱 에러. 원문 데이터:", responseText);
      console.error("상세 파싱 에러:", parseError);
      throw new Error(
        `AI가 유효한 JSON 형식을 반환하지 않았습니다. ${parseError?.message || ""}`,
      );
    }
  }
}
