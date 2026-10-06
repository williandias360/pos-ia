import { createServer } from "./server.ts";

const app = createServer();

await app.listen({ port: 5000, host: '0.0.0.0' });
console.log('server running at 5000');

app.inject({
  method: 'POST',
  url: '/chat',
  body: { question: 'O que é rate limiting?' }
}).then((response) => {
  console.log('Response status', response.statusCode);
  console.log('Response body', response.body);
});