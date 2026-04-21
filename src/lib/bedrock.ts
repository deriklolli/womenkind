import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

function getClient() {
  return new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' })
}

export async function invokeModel({
  system,
  messages,
  maxTokens = 2048,
}: {
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
}): Promise<string> {
  const client = getClient()
  const modelId = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250514-v1:0'

  const payload: Record<string, unknown> = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    messages,
  }
  if (system) payload.system = system

  const response = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    })
  )

  const body = JSON.parse(new TextDecoder().decode(response.body))
  return body.content?.[0]?.text || ''
}
