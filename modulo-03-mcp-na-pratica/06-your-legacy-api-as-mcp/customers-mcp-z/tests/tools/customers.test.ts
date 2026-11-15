import { describe, it, after, before } from 'node:test';
import assert from 'node:assert';
import { createTestClient } from '../helpers.ts';
import { Client } from '@modelcontextprotocol/sdk/client';
import { type CustomerUpdate, type Customer, type CustomerMutation } from '../../src/domain/customer.ts';

type CustomersResult = { structuredContent: { customers: Customer[]; }; };
type CustomerResult = { structuredContent: { customer: Customer; }; };
type CustomerMutationResult = { structuredContent: CustomerMutation; };

describe('Customer MCP Suite', () => {
  let _client: Client;
  before(async () => {
    _client = await createTestClient();
  });

  after(async () => {
    await _client.close();
  });

  it('should list all customers', async () => {
    const result = await _client.callTool({
      name: 'list_customers',
      arguments: {}
    }) as unknown as CustomersResult;

    assert.ok(
      Array.isArray(result.structuredContent.customers),
      'Should return an array of customers'
    );
  });

  //Parei na parte onde o servidor MCP já consegue cadastrar um customer
  it('should create a customer', async () => {
    const customer = {
      name: 'Teste',
      phone: '1111111111'
    };

    const result = await _client.callTool({
      name: 'create_customer',
      arguments: customer
    }) as unknown as CustomerMutationResult;

    assert.ok(
      result.structuredContent.id,
      'Should contain id'
    );

    assert.deepStrictEqual(
      result.structuredContent.message,
      `user ${customer.name} created!`,
    );
  });

  it('should create a customer', async () => {
    const customer = {
      name: 'Willian',
      phone: '1111111111'
    };

    await _client.callTool({
      name: 'create_customer',
      arguments: customer
    }) as unknown as CustomerMutationResult;

    const result = await _client.callTool({
      name: 'get_customer',
      arguments: {
        name: 'Will'
      }
    }) as unknown as CustomerResult;

    assert.ok(
      result.structuredContent.customer._id,
      'Should contain id'
    );

    assert.deepStrictEqual(
      result.structuredContent.customer.name,
      customer.name
    );

  });

  it('should update a customer', async () => {
    const customer = {
      name: 'Willian Dias Brito',
      phone: '123456789'
    };

    const { structuredContent: { id } } = await _client.callTool({
      name: 'create_customer',
      arguments: customer
    }) as unknown as CustomerMutationResult;

    const result = await _client.callTool({
      name: 'update_customer',
      arguments: {
        _id: id,
        name: 'José da Silva',
        phone: customer.phone,
      } as CustomerUpdate,
    }) as unknown as CustomerMutationResult;

    assert.ok(
      result.structuredContent.message,
      'Should contain message'
    );

    assert.ok(
      result.structuredContent.id,
      id,
    );
  });

  it('Should delete a customer by _id', async () => {
    const customer = {
      name: 'teste customer',
      phone: '3332222211'
    };

    const { structuredContent: { id } } = await _client.callTool({
      name: 'create_customer',
      arguments: customer
    }) as unknown as CustomerMutationResult;

    const result = await _client.callTool({
      name: 'delete_customer',
      arguments: {
        _id: id,
      } as CustomerUpdate
    }) as unknown as CustomerMutationResult;

    assert.deepStrictEqual(
      result.structuredContent.message,
      `User ${id} deleted!`,
      'Should show deleted message'
    );

    assert.deepStrictEqual(
      result.structuredContent.id,
      id,
    );
  });
});