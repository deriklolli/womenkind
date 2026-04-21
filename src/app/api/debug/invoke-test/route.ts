import { NextResponse } from 'next/server'
import { invokeModel } from '@/lib/bedrock'

export async function GET() {
  try {
    const text = await invokeModel({
      messages: [{ role: 'user', content: 'say hi' }],
      maxTokens: 50,
    })
    return NextResponse.json({ ok: true, text })
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      name: err.name,
      stack: err.stack,
    }, { status: 500 })
  }
}
