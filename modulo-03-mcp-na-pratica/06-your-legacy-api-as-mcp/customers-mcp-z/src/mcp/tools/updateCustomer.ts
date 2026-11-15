import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CustomerService } from "../../application/customerService.ts";
import { CustomerMutationSchema, CustomerUpdateSchema } from "../../domain/customer.ts";

export function registerUpdateCustomerTool(
  server: McpServer,
  service: CustomerService
) {
  server.registerTool(
    'update_customer',
    {
      description: 'Update an existing customer',
      inputSchema: CustomerUpdateSchema.shape,
      outputSchema: CustomerMutationSchema.shape,
    },
    async (customer) => {
      try {
        const result = await service.updateCustomer(customer);
        return {
          content: [
            {
              type: 'text',
              text: result.message ?? ''
            }
          ],
          structuredContent: result
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to list customers. Erro: ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        };
      }
    }
  );
}