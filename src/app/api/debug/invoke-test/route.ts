import { NextResponse } from 'next/server'
import { invokeModel } from '@/lib/bedrock'

export async function GET() {
  try {
    const modelIdEnv = process.env.BEDROCK_MODEL_ID
    const text = await invokeModel({
      messages: [{ role: 'user', content: 'say hi' }],
      maxTokens: 50,
    })
    return NextResponse.json({ ok: true, text, modelIdEnv })
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      name: err.name,
      modelIdEnv: process.env.BEDROCK_MODEL_ID,
    }, { status: 500 })
  }
}
