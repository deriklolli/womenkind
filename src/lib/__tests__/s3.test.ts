// Mock the AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/signed-url'),
}))

import { getUploadUrl, getDownloadUrl } from '../s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

describe('s3 helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AWS_S3_BUCKET = 'womenkind-recordings'
    process.env.AWS_REGION = 'us-west-2'
  })

  afterEach(() => {
    delete process.env.AWS_S3_BUCKET
  })

  it('getUploadUrl returns a signed PUT URL', async () => {
    const url = await getUploadUrl('ambient/123_abc.webm', 'audio/webm')
    expect(url).toBe('https://s3.amazonaws.com/signed-url')
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'womenkind-recordings',
      Key: 'ambient/123_abc.webm',
      ContentType: 'audio/webm',
    })
    expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 300 })
  })

  it('getDownloadUrl returns a signed GET URL', async () => {
    const url = await getDownloadUrl('ambient/123_abc.webm')
    expect(url).toBe('https://s3.amazonaws.com/signed-url')
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'womenkind-recordings',
      Key: 'ambient/123_abc.webm',
    })
    expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 3600 })
  })

  it('throws when AWS_S3_BUCKET is not set', async () => {
    delete process.env.AWS_S3_BUCKET
    await expect(getUploadUrl('key', 'audio/webm')).rejects.toThrow('AWS_S3_BUCKET')
  })
})
