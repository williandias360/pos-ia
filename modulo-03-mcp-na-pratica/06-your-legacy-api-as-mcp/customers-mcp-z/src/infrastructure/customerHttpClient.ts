import { type CustomerUpdate, type CustomerMutation, type Customer } from "../domain/customer.ts";

export class CustomerHttpClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async listCustomers(): Promise<Customer[]> {
    const res = await fetch(`${this.baseUrl}/customers`);

    return res.json() as Promise<Customer[]>;
  }

  async createCustomer(customer: Customer): Promise<CustomerMutation> {
    const { _id, ...remaning } = customer;
    const res = await fetch(`${this.baseUrl}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });

    return res.json() as Promise<CustomerMutation>;
  }

  async updateCustomer(customer: CustomerUpdate): Promise<CustomerMutation> {
    const { _id, ...remaning } = customer;
    const res = await fetch(`${this.baseUrl}/customers/${customer._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(remaning)
    });

    return res.json() as Promise<CustomerMutation>;
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const res = await fetch(`${this.baseUrl}/customers/${id}`);
    if (res.status === 404) return null;

    return res.json() as Promise<Customer>;
  }

  async deleteCustomer(id: string): Promise<CustomerMutation> {
    const res = await fetch(`${this.baseUrl}/customers/${id}`, {
      method: 'DELETE',
    });

    return res.json() as Promise<CustomerMutation>;
  }
}