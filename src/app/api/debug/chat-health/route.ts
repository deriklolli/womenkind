import { NextResponse } from 'next/server'
import { getServerSession } from '@/lib/getServerSession'
import { invokeModel } from '@/lib/bedrock'

export async function GET() {
  const result: Record<string, unknown> = {}

  try {
    const session = await getServerSession()
    result.session = session ? { role: session.role, hasProviderId: !!session.providerId } : null
  } catch (err: any) {
    result.session_error = err.message
    return NextResponse.json(result)
  }

  if (!result.session) {
    result.step = 'blocked: no session'
    return NextResponse.json(result)
  }

  if ((result.session as any).role !== 'provider') {
    result.step = 'blocked: not a provider session'
    return NextResponse.json(result)
  }

  result.step = 'session ok — testing bedrock'

  try {
    const text = await invokeModel({
      maxTokens: 50,
      messages: [{ role: 'user', content: 'Reply with just the word: OK' }],
    })
    result.bedrock = 'ok'
    result.bedrock_response = text
  } catch (err: any) {
    result.bedrock = 'error'
    result.bedrock_error = err.message
  }

  return NextResponse.json(result)
}
