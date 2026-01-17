// import OpenAI from "openai";
import { BaseAiClient } from "./types";

export class GptClient implements BaseAiClient {
  // private client: OpenAI;
  constructor(apiKey: string) {
    // this.client = new OpenAI({ apiKey });
  }

  async generateText(prompt: string): Promise<string> {
    // GPT 구현 로직
    return "GPT 응답 데이터";
  }

  async generateJson<T>(prompt: string): Promise<T> {
    // GPT JSON 모드 로직
    return {} as T;
  }
}
