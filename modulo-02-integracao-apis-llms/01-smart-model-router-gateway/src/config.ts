console.assert(
  process.env.OPENROUTER_API_KEY,
  'OPENROUTER_API_KEY is not set in env variables'
);

export type ModelConfig = {
  apiKey: string;
  httpRefer: string;
  xTitle: string;
  port: number;
  models: string[];
  temperature: number;
  maxTokens: number;
  systemPrompts: string;

  provider: {
    sort: {
      by: string,
      partition: string;
    };
  };
};

export const config: ModelConfig = {
  apiKey: process.env.OPENROUTER_API_KEY!,
  httpRefer: 'http://pos-ia.com',
  xTitle: 'SmartModelRouterGateway',
  port: 3000,
  models: [
    //mais barato
    'stealth/space-bunny-alpha',

    //melhor throughput
    'inclusionai/ling-3.0-flash-sante:free',
  ],
  temperature: 0.2,
  maxTokens: 400,
  systemPrompts: 'You are a helpful assistant.',
  provider: {
    sort: {
      // by: 'price',
      // by: 'latency',
      by: 'throughput',
      partition: 'none'
    }
  }
};