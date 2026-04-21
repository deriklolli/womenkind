const mockSend = jest.fn()

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  InvokeModelCommand: jest.fn().mockImplementation((input) => input),
}))

import { invokeModel } from '../bedrock'

describe('invokeModel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AWS_REGION = 'us-west-2'
    process.env.BEDROCK_MODEL_ID = 'us.anthropic.claude-sonnet-4-5-20250514-v1:0'
  })

  it('returns the text content from Bedrock response', async () => {
    const fakeBody = JSON.stringify({
      content: [{ type: 'text', text: 'Hello from Bedrock' }],
    })
    mockSend.mockResolvedValueOnce({
      body: new TextEncoder().encode(fakeBody),
    })

    const result = await invokeModel({
      messages: [{ role: 'user', content: 'Hello' }],
      maxTokens: 100,
    })

    expect(result).toBe('Hello from Bedrock')
  })

  it('includes system prompt when provided', async () => {
    const fakeBody = JSON.stringify({ content: [{ type: 'text', text: 'ok' }] })
    mockSend.mockResolvedValueOnce({ body: new TextEncoder().encode(fakeBody) })

    await invokeModel({
      system: 'You are a doctor.',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 50,
    })

    const commandArg = (jest.requireMock('@aws-sdk/client-bedrock-runtime').InvokeModelCommand as jest.Mock).mock.calls[0][0]
    const body = JSON.parse(commandArg.body)
    expect(body.system).toBe('You are a doctor.')
  })

  it('throws when content is empty or missing', async () => {
    const fakeBody = JSON.stringify({ content: [] })
    mockSend.mockResolvedValueOnce({ body: new TextEncoder().encode(fakeBody) })

    await expect(
      invokeModel({ messages: [{ role: 'user', content: 'Hi' }], maxTokens: 50 })
    ).rejects.toThrow('empty or unexpected')
  })

  it('throws when stop_reason is max_tokens', async () => {
    const fakeBody = JSON.stringify({
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: 'partial...' }],
    })
    mockSend.mockResolvedValueOnce({ body: new TextEncoder().encode(fakeBody) })

    await expect(
      invokeModel({ messages: [{ role: 'user', content: 'Hi' }], maxTokens: 10 })
    ).rejects.toThrow('max_tokens')
  })
})
