import { NextResponse } from 'next/server'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'

export async function GET() {
  try {
    const sts = new STSClient({ region: process.env.AWS_REGION || 'us-west-2' })
    const res = await sts.send(new GetCallerIdentityCommand({}))
    return NextResponse.json({
      arn: res.Arn,
      account: res.Account,
      userId: res.UserId,
      keyIdPrefix: (process.env.AWS_ACCESS_KEY_ID || '').slice(0, 8),
      region: process.env.AWS_REGION,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
