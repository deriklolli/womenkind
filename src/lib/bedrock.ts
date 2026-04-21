import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

let _client: BedrockRuntimeClient | null = null

function getClient(): BedrockRuntimeClient {
  if (!_client) {
    _client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' })
  }
  return _client
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

  let body: Record<string, unknown>
  try {
    body = JSON.parse(new TextDecoder().decode(response.body))
  } catch {
    throw new Error('Bedrock returned a non-JSON response body')
  }
  if (body.stop_reason === 'max_tokens') {
    throw new Error('Bedrock response truncated: max_tokens reached. Increase maxTokens.')
  }
  const text = (body.content as Array<{ text?: string }>)?.[0]?.text
  if (!text) throw new Error('Bedrock returned an empty or unexpected content structure')
  return text
}
