import OpenAI from "openai";


export type CardData = any;

export class DeepSeekCardEvaluator {
  public client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: apiKey
    });
  }

  async evaluateBatch(cards: CardData[], concurrency: number): Promise<any[]> {
    // Stub implementation
    return [];
  }

  saveResults(results: any[], filename: string): void {
    // Stub implementation
  }

  generateReport(results: any[]): void {
    // Stub implementation
  }
}
