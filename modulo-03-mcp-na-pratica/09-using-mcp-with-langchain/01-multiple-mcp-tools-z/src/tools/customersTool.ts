
export const getCustomersTool = () => {
    const serviceToken = process.env.SERVICE_TOKEN;
    if (!serviceToken) {
        throw new Error('SERVICE_TOKEN environment variable is required for customers-mcp tool');
    }

    return {
        'wb-customers-mcp': {
            transport: 'stdio' as const,
            command: 'npx',
            "args": ["-y", "@willian.dias360/wb-customers-mcp@latest"],
            env: {
                SERVICE_TOKEN: process.env.SERVICE_TOKEN as string,
            }
        },
    };
};
