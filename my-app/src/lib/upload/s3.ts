import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

/**
 * Amazon S3 upload. Activate with UPLOAD_PROVIDER=s3 plus the four S3 vars.
 * The bucket must allow public reads (bucket policy) for the returned URL to
 * render in <img> tags — ACLs are intentionally not set so this works on
 * modern buckets that have ACLs disabled (Object Ownership = bucket-owner-enforced).
 */
export async function uploadToS3(input: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}): Promise<{ fileUrl: string; storageKey: string }> {
  if (
    !env.S3_BUCKET ||
    !env.S3_REGION ||
    !env.AWS_ACCESS_KEY_ID ||
    !env.AWS_SECRET_ACCESS_KEY
  ) {
    throw new Error(
      "S3 not configured — set S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.",
    );
  }

  const client = new S3Client({
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `asana-clone/${Date.now()}-${safeName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: input.buffer,
      ContentType: input.contentType,
    }),
  );

  return {
    fileUrl: `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`,
    storageKey: key,
  };
}
