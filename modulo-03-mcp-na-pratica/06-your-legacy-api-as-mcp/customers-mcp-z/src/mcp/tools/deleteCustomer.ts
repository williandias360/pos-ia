import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CustomerService } from "../../application/customerService.ts";
import z from "zod";
import { CustomerMutationSchema } from "../../domain/customer.ts";

export function registerDeleteCustomerTool(
  server: McpServer,
  service: CustomerService
) {
  server.registerTool(
    'delete_customer',
    {
      description: 'Delete a existing customer by _id',
      inputSchema: {
        _id: z.string().describe('MongoDB ObjectId of the customer to delete')
      },
      outputSchema: CustomerMutationSchema.shape,
    },
    async ({ _id }) => {
      try {
        const result = await service.deleteCustomer(_id);
        return {
          content: [
            {
              type: 'text',
              text: result.message ?? ''
            }
          ],
          structuredContent: result,
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to delete customer. Error: ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        };
      }
    }
  );
}