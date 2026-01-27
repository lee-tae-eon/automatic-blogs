import OpenAI from "openai";
import dotEnv from "dotenv";

export class GroqClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: process.env.GLOQ_ENDPOINT, // Groq 엔드포인트
    });
  }

  async generateJson<T>(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      // llama-3.3-70b-versatile가 현재 가장 똑똑하고 블로그 글쓰기에 좋습니다.
      model: "llama-3.3-70b-specdec",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that outputs only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }, // JSON 출력 강제 (꿀기능!)
    });

    return response.choices[0].message.content || "";
  }
}
