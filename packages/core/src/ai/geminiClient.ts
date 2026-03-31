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
  private apiKey: string;

  constructor(apiKey: string, modelName: string = "gemini-2.5-flash") {
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.initModel(modelName);
  }

  private initModel(modelName: string): GenerativeModel {
    console.log(`🤖 [Gemini] 모델 초기화: ${modelName}`);
    return this.genAI.getGenerativeModel({
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
      console.error(`🛑 Gemini generateText 실패: ${err.message || err}`);
      throw err; // 상위에서 처리하도록 원본 에러 던짐
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
      console.error(`🛑 Gemini generateJson 호출 실패: ${error.message || error}`);
      throw error; // 상위에서 처리하도록 원본 에러 던짐
    }

    // API 호출은 성공했으나, 응답을 파싱하는 과정에서 에러가 발생할 수 있습니다.
    try {
      // 1. 마크다운 코드 블록 제거 및 텍스트 정제
      let cleanedText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      // 2. 만약 앞뒤에 설명이 붙어있을 경우를 대비해 JSON 시작점과 끝점을 찾음
      const objectStart = cleanedText.indexOf("{");
      const arrayStart = cleanedText.indexOf("[");
      
      let jsonStart = -1;
      if (objectStart !== -1 && arrayStart !== -1) {
        jsonStart = Math.min(objectStart, arrayStart);
      } else {
        jsonStart = objectStart !== -1 ? objectStart : arrayStart;
      }

      const objectEnd = cleanedText.lastIndexOf("}");
      const arrayEnd = cleanedText.lastIndexOf("]");
      const jsonEnd = Math.max(objectEnd, arrayEnd);

      if (jsonStart === -1 || jsonEnd === -1 || jsonStart >= jsonEnd) {
        throw new Error(`응답에서 JSON 형식을 찾을 수 없습니다.`);
      }
      
      let jsonString = cleanedText.substring(jsonStart, jsonEnd + 1);

      try {
        // 1차 시도: 단순 파싱
        return JSON.parse(jsonString.trim()) as T;
      } catch (e) {
        // 2차 시도: 값(Value) 부분의 줄바꿈 및 특수문자 정밀 정제
        let repaired = jsonString.replace(/(": *")([\s\S]*?)(",? *\n|",? *\r|",? *$)/g, (match, prefix, content, suffix) => {
          return prefix + content.replace(/\n/g, "\\n").replace(/\r/g, "\\r") + suffix;
        });

        try {
          return JSON.parse(repaired) as T;
        } catch (e2) {
          throw e2; 
        }
      }
    } catch (parseError: any) {
      console.error("JSON 파싱 에러. 원문 데이터:", responseText);
      throw new Error(
        `AI가 유효한 JSON 형식을 반환하지 않았습니다. ${parseError?.message || ""}`,
      );
    }
  }

  async searchWithGrounding(query: string): Promise<string> {
    try {
      const searchModel = this.genAI.getGenerativeModel({
        model: this.model.model,
        tools: [{ googleSearch: {} }] as any,
      });

      const prompt = `
        다음 주제에 대한 최신 뉴스, 가십, 트렌드를 구글에서 검색해서 자세히 알려줘.
        주제: ${query}
        
        [요청사항]
        - 현재 시점(Today)의 가장 핫한 이슈 위주로 찾아줘.
        - 한국 블로그 독자들이 흥미로워할 만한 자극적이거나 화제가 되는 내용을 포함해줘.
        - 검색 결과의 핵심 내용들을 요약해서 텍스트로 반환해줘.
      `;

      const result = await searchModel.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error: any) {
      console.warn("⚠️ Gemini Grounding 검색 실패:", error.message);
      return "";
    }
  }
}
