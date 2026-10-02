import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.ts';


console.assert(
  process.env.OPENROUTER_API_KEY,
  'OPENROUTER_API_KEY is not set in env variables'
);

test.todo('routes to cheapes model by default');