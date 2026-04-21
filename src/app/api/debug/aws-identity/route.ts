import { NextResponse } from 'next/server'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'

export async function GET() {
  try {
    const sts = new STSClient({ region: process.env.AWS_REGION || 'us-west-2' })
    const res = await sts.send(new GetCallerIdentityCommand({}))
    const awsEnvKeys = Object.keys(process.env)
      .filter(k => k.startsWith('AWS_') || k.includes('AMZN') || k === 'VERCEL_OIDC_TOKEN')
      .map(k => ({
        key: k,
        valuePrefix: (process.env[k] || '').slice(0, 12),
        length: (process.env[k] || '').length,
      }))
    return NextResponse.json({
      arn: res.Arn,
      account: res.Account,
      userId: res.UserId,
      awsEnvKeys,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
