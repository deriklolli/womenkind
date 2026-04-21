import { NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

export async function GET() {
  const client = new BedrockRuntimeClient({
    region: 'us-west-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
  try {
    const res = await client.send(new InvokeModelCommand({
      modelId: 'us.anthropic.claude-sonnet-4-6',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    }))
    return NextResponse.json({ ok: true, body: new TextDecoder().decode(res.body) })
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      name: err.name,
      $metadata: err.$metadata,
    }, { status: 500 })
  }
}
