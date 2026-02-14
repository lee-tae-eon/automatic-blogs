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

  constructor(apiKey: string, modelName: string = "gemini-2.5-flash") {
    // 가장 가성비 좋은 flash 모델 사용
    // 2. this 키워드를 사용하여 멤버 변수에 할당
    this.genAI = new GoogleGenerativeAI(apiKey);

    // 최신 모델인 gemini-1.5-flash-latest 사용
    this.model = this.genAI.getGenerativeModel({
      model: modelName || "gemini-2.5-flash",
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
      let cleanedText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      // 2. 만약 앞뒤에 설명이 붙어있을 경우를 대비해 JSON 시작점과 끝점을 찾음
      // { 또는 [ 중 먼저 나오는 것을 시작점으로, } 또는 ] 중 마지막에 나오는 것을 끝점으로 설정
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

      // [v4.10] JSON 파싱 안정성 극대화 로직
      const sanitizeJsonString = (str: string) => {
        return str
          .replace(/\n/g, "\\n") // 모든 실제 줄바꿈을 \n 문자로 변환
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t");
      };

      try {
        // 1차 시도: 단순 파싱
        return JSON.parse(jsonString.trim()) as T;
      } catch (e) {
        // 2차 시도: 값(Value) 부분의 줄바꿈 및 특수문자 정밀 정제
        // 큰따옴표로 감싸진 값 내부의 실제 줄바꿈만 타겟팅하여 변환
        let repaired = jsonString.replace(/(": *")([\s\S]*?)(",? *\n|",? *\r|",? *$)/g, (match, prefix, content, suffix) => {
          return prefix + content.replace(/\n/g, "\\n").replace(/\r/g, "\\r") + suffix;
        });

        try {
          return JSON.parse(repaired) as T;
        } catch (e2) {
          // 3차 시도: 더욱 공격적인 정제 (문자열 내 큰따옴표 중첩 문제 해결 시도)
          // 실제 JSON 구조용 따옴표를 제외한 나머지 따옴표를 작은따옴표로 변환하거나 이스케이프
          const doubleFix = repaired.replace(/([^\\])"/g, '$1\\"'); // 모든 따옴표 이스케이프 (임시)
          // 단, JSON 키와 구조용 따옴표는 복구해야 함 (매우 복잡하므로 여기서는 2차 시도까지만 우선 적용 후 관찰)
          throw e2; 
        }
      }
    } catch (parseError: any) {
      // 이 경우는 순수한 JSON 파싱 에러입니다.
      console.error("JSON 파싱 에러. 원문 데이터:", responseText);
      console.error("상세 파싱 에러:", parseError);
      throw new Error(
        `AI가 유효한 JSON 형식을 반환하지 않았습니다. ${parseError?.message || ""}`,
      );
    }
  }

  /**
   * Gemini의 Google Search Grounding 기능을 사용하여 최신 정보를 검색합니다.
   * @param query 검색어
   */
  async searchWithGrounding(query: string): Promise<string> {
    try {
      // 검색 기능을 위해 모델을 새로 인스턴스화 (tools 설정 필요)
      const searchModel = this.genAI.getGenerativeModel({
        model: this.model.model, // 기존 인스턴스에 설정된 모델명(e.g. gemini-2.5-flash) 사용
        tools: [{ googleSearch: {} }] as any, // 구글 검색 도구 활성화 (타입 에러 방지를 위해 any 캐스팅)
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
      console.warn("⚠️ Gemini Grounding 검색 실패 (Tavily로 대체 진행):", error.message);
      // 검색 실패 시 빈 문자열 반환 (메인 로직에서 Tavily 결과만 사용하게 됨)
      return "";
    }
  }
}
