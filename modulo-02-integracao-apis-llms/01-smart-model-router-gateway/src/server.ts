import Fastify from "fastify";
import { OpenRouterService } from "./openRouterService.ts";

export const createServer = (routerService: OpenRouterService) => {
  const app = Fastify({ logger: false });

  app.get('/ping', {}, async (request, reply) => {
    reply.send('pong');
  });

  app.post('/chat', {
    schema: {
      body: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { type: 'string', minLength: 5 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { question } = request.body as { question: string; };
      const response = await routerService.generate(question);
      reply.send(response);
    } catch (err) {
      console.error('error handling /chat request', err);
      reply.code(500);
    }
  });

  return app;
};