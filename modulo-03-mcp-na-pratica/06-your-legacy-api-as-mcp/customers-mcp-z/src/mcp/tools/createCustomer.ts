import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CustomerService } from "../../application/customerService.ts";
import z from "zod";


export function registerCreateCustomerTool(
  server: McpServer,
  service: CustomerService
) {
  server.registerTool(
    'create_customer',
    {
      description: 'List all customers',
      inputSchema: {
        name: z.string().describe('Full name of the customer'),
        phone: z.string().describe('Phone number of the customer')
      },
      outputSchema: {
        id: z.string().describe('MongoDB ObjectId of newerly created customer'),
        message: z.string().describe('Confirmation message'),
      }
    },
    async ({ name, phone }) => {
      try {
        const customer = await service.createCustomer({ name, phone });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(customer, null, 2)
            }
          ],
          structuredContent: customer
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to list customers. Error: ${err instanceof Error ? err : String(err)}`
            }
          ]
        };
      }
    }
  );
}