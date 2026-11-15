import { describe, it, after, before } from 'node:test';
import assert from 'node:assert';
import { createTestClient } from '../helpers.ts';
import { Client } from '@modelcontextprotocol/sdk/client';

describe('Customer Resources', () => {
  let _client: Client;

  before(async () => {
    _client = await createTestClient();
  });

  after(async () => {
    await _client.close();
  });

  it('should list the customers://api-info resource', async () => {
    const { resources } = await _client.listResources();
    const info = resources.find(r => r.uri === 'customers://api-info');

    assert.ok(
      info,
      'customers://api-info should exists'
    );

    assert.deepStrictEqual(
      info.description,
      'describes the customers rest API that this MCP Server wraps',
      'description should be correct'
    );
  });
});