import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export class AiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    // API 키가 없을 경우 에러 처리
    if (!apiKey) {
      throw new Error("Gemini API Key가 필요합니다.");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // 토이 프로젝트 테스트용으로 비용 효율적인 gemini-1.5-flash (Gemini 3 Flash 기반) 추천
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }

  /**
   * 텍스트 프롬프트를 보내고 응답을 받습니다.
   */
  async generateText(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini 생성 중 오류 발생:", error);
      throw error;
    }
  }

  /**
   * JSON 출력이 필요할 때 사용하는 메소드 (목차 생성 등에 유용)
   */
  async generateJson<T>(prompt: string): Promise<T> {
    try {
      const result = await this.model.generateContent([
        prompt,
        "반드시 순수한 JSON 형식으로만 응답해줘. Markdown code block(```json)은 제외해.",
      ]);
      const text = result.response.text();
      return JSON.parse(text) as T;
    } catch (error) {
      console.error("JSON 파싱 오류:", error);
      throw error;
    }
  }
}
