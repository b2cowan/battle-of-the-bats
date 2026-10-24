import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const bucket = process.env.BOOKKEEPING_S3_BUCKET;
if (bucket !== 'fieldlogichq-bookkeeping-receipts-dev-859850635274') {
  throw new Error('This receipt probe is restricted to the development bucket');
}

const client = new S3Client({ region: 'us-east-2' });
const key = `receipts/__probe/${randomUUID()}`;
const bytes = new TextEncoder().encode('%PDF-1.7\nsynthetic receipt probe\n');
let versionId;
try {
  const uploaded = await client.send(new PutObjectCommand({ Bucket: bucket, Key: key,
    Body: bytes, ContentType: 'application/pdf', IfNoneMatch: '*' }));
  versionId = uploaded.VersionId;
  if (!versionId) throw new Error('Versioned bucket did not return an object version');
  const downloaded = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const received = downloaded.Body && await downloaded.Body.transformToByteArray();
  if (!received || !Buffer.from(received).equals(Buffer.from(bytes)) ||
      downloaded.ContentType !== 'application/pdf') {
    throw new Error('Receipt bytes or content type did not round-trip');
  }
  console.log('Development S3 receipt upload/download passed');
} finally {
  try {
    if (versionId) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key, VersionId: versionId }));
  } finally {
    client.destroy();
  }
}
