import { ChatOpenAI } from "@langchain/openai";
import { config, type ModelConfig } from "../config.ts";
import { z } from "zod/v3";
import { createAgent, HumanMessage, providerStrategy, SystemMessage } from "langchain";
import { error } from "console";

export class OpenRouterService {
  private config: ModelConfig;
  private llmClient: ChatOpenAI;

  constructor(configOverride?: ModelConfig) {
    this.config = configOverride ?? config;

    const model = this.config.models.at(0);
    this.llmClient = new ChatOpenAI(model!, {
      apiKey: this.config.apiKey,
      modelName: this.config.models.at(0),
      modelKwargs: {
        models: this.config.models,
        provider: this.config.provider,
      },
      temperature: this.config.temperature,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Refer': this.config.httpReferer,
          'X-Title': this.config.xTitle
        }
      },
    });
  }

  async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodSchema<T>
  ) {
    try {
      const agent = createAgent({
        model: this.llmClient,
        tools: [],
        responseFormat: providerStrategy(schema)
      });

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ];

      const data = await agent.invoke({ messages });
      return {
        success: true,
        data: data.structuredResponse
      };
    } catch (err) {
      console.error('Error OpenRouterService', err);

      return {
        success: false,
        error: err instanceof Error ?
          err.message :
          String(err),
      };
    }
  }
}