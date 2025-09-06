import OpenAI from "openai"

export class DeepSeekCardEvaluator {
  public client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: apiKey
    })
  }
}
