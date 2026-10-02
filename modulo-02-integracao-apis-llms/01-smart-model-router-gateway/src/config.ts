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
    //top 1 para a listagem ordenada por preço
    // 'thinkingmachines/inkling-small:free',
    //'stealth/space-bunny-alpha',
    //top 5 para a listagem de thoughput
    // 'nex-agi/nex-n2.5-mini',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'liquid/lfm-2.5-2.6b:free',
    // 'apodex/apodex-1.1-mini:free'
    'google/gemini-2.5-flash-lite',
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