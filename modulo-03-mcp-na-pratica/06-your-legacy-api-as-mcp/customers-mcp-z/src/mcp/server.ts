import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CustomerHttpClient } from "../infrastructure/customerHttpClient.ts";
import { registerListCustomersTool } from "./tools/listCustomers.ts";
import { CustomerService } from "../application/customerService.ts";
import { registerApiInfoResource } from "./resources/apiInfo.ts";
import { registerCreateCustomerTool } from "./tools/createCustomer.ts";
import { registerGetCustomerTool } from "./tools/getCustomer.ts";
import { registerFindCustomerPrompt } from "./prompts/findCustomer.ts";
import { registerUpdateCustomerTool } from "./tools/updateCustomer.ts";
import { registerDeleteCustomerTool } from "./tools/deleteCustomer.ts";

const BASE_URL = "http://localhost:9000/v1";
const service = new CustomerService(new CustomerHttpClient(BASE_URL));

export const server = new McpServer({
    name: "@willianbrito/wdb-customers-mcp",
    version: "0.0.1",
});

registerListCustomersTool(server, service);
registerGetCustomerTool(server, service);
registerCreateCustomerTool(server, service);
registerUpdateCustomerTool(server, service);
registerDeleteCustomerTool(server, service);
registerApiInfoResource(server, BASE_URL);
registerFindCustomerPrompt(server);