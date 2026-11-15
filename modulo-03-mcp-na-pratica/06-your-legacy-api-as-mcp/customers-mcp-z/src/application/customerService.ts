import { type CustomerQuery, type Customer, type CustomerUpdate } from "../domain/customer.ts";
import { CustomerHttpClient } from "../infrastructure/customerHttpClient.ts";

export class CustomerService {
  private readonly _client: CustomerHttpClient;

  constructor(client: CustomerHttpClient) {
    this._client = client;
  }

  async listCustomers(): Promise<Customer[]> {
    return this._client.listCustomers();
  }

  async createCustomer(customer: Omit<Customer, '_id'>) {
    return this._client.createCustomer(customer);
  }

  async updateCustomer(customer: CustomerUpdate) {
    return this._client.updateCustomer(customer);
  }

  async deleteCustomer(id: string) {
    return this._client.deleteCustomer(id);
  }

  async findCustomer(customerQuery: CustomerQuery): Promise<Customer | null> {
    if (customerQuery._id) return this._client.getCustomerById(customerQuery._id);

    const customers = await this._client.listCustomers();
    return (
      customers.find(customer => {
        const entries = Object.entries(customerQuery) as [keyof Customer, string][];

        return entries.every(([key, value]) => {
          const customerValue = customer[key];
          return customerValue?.includes(value);
        });
      }) ?? null
    );
  }
}