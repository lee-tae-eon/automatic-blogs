export interface BaseAiClient {
  generateText(prompt: string): Promise<string>;
  generateJson<T>(prompt: string): Promise<T>;
}
