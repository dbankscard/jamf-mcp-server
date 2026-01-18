# Optional Dependencies

## AWS Bedrock Support

The Jamf MCP Server includes support for AWS Bedrock as an AI provider for the agent functionality. The AWS SDK is included as a development dependency to ensure the project builds correctly in all environments.

### Runtime Usage

To use AWS Bedrock at runtime:
1. Ensure you have AWS credentials configured
2. Set the appropriate environment variables:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION` (optional, defaults to us-east-1)

### When is this needed?

- Only if you plan to use the agent CLI functionality (`npm run agent`)
- Only if you want to use AWS Bedrock (Claude) as your AI provider
- NOT needed for:
  - Running the MCP server
  - Using skills functionality
  - ChatGPT integration

### Alternative AI Providers

If you don't have AWS credentials, you can use:
- OpenAI (set `OPENAI_API_KEY` environment variable)
- Mock provider (for testing)

### Build Note

The AWS SDK (`@aws-sdk/client-bedrock-runtime`) is included as a development dependency to ensure TypeScript compilation works correctly. The BedrockProvider is dynamically imported only when AWS credentials are detected at runtime.