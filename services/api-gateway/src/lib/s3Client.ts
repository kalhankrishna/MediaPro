import { S3Client } from '@aws-sdk/client-s3';

if (!process.env.AWS_REGION) throw new Error('AWS_REGION is not defined');
if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET is not defined');

export const s3 = new S3Client({ region: process.env.AWS_REGION });
export const S3_BUCKET = process.env.S3_BUCKET;