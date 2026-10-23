import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type UploadInput = {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  fileSize: number;
};

export type UploadResult = {
  fileUrl: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
};

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/uri-list",
  "text/csv",
  "application/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
]);

export function isAllowedContentType(contentType: string): boolean {
  const base = contentType.split(";")[0]?.trim() ?? "";
  return ALLOWED_CONTENT_TYPES.has(base) || base.startsWith("image/");
}

/**
 * Upload a file to the configured storage provider (UPLOAD_PROVIDER env var):
 *   google-oauth  — personal Google Drive via OAuth2 refresh token
 *   google-drive  — shared Google Drive via service account
 *   s3            — Amazon S3
 */
export async function uploadFile(input: UploadInput): Promise<UploadResult> {
  const { buffer, fileName, contentType, fileSize } = input;
  const provider = env.UPLOAD_PROVIDER;

  switch (provider) {
    case "google-oauth":
      return uploadGoogleOAuth(buffer, fileName, contentType, fileSize);
    case "google-drive":
      return uploadGoogleServiceAccount(buffer, fileName, contentType, fileSize);
    case "s3":
      return uploadS3(buffer, fileName, contentType, fileSize);
    default:
      throw new Error(
        "UPLOAD_PROVIDER is not set. " +
          "Add UPLOAD_PROVIDER=google-oauth (or google-drive / s3) to .env.local and supply the matching credentials.",
      );
  }
}

// ---------------------------------------------------------------------------
// Google Drive — OAuth2 (personal Gmail / Drive)
// ---------------------------------------------------------------------------

async function uploadGoogleOAuth(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  fileSize: number,
): Promise<UploadResult> {
  const { google } = await import("googleapis");
  const { Readable } = await import("node:stream");

  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID } =
    env;

  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) {
    throw new Error(
      "UPLOAD_PROVIDER=google-oauth requires GOOGLE_OAUTH_CLIENT_ID, " +
        "GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN in .env.local.\n" +
        "Run: npx tsx --env-file=.env.local scripts/google-oauth-token.ts",
    );
  }

  const auth = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN });

  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      ...(GOOGLE_DRIVE_FOLDER_ID ? { parents: [GOOGLE_DRIVE_FOLDER_ID] } : {}),
    },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id",
  });

  const fileId = res.data.id;
  if (!fileId) throw new Error("Google Drive upload returned no file ID.");

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  logger.info("upload.google-oauth", { fileName, fileId });

  return {
    fileUrl: `https://drive.google.com/file/d/${fileId}/view`,
    storageKey: `gdrive:${fileId}`,
    mimeType,
    fileSize,
  };
}

// ---------------------------------------------------------------------------
// Google Drive — Service Account (shared Drives / server-to-server)
// ---------------------------------------------------------------------------

async function uploadGoogleServiceAccount(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  fileSize: number,
): Promise<UploadResult> {
  const { google } = await import("googleapis");
  const { Readable } = await import("node:stream");

  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID } = env;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error(
      "UPLOAD_PROVIDER=google-drive requires GOOGLE_SERVICE_ACCOUNT_EMAIL and " +
        "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env.local.",
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      ...(GOOGLE_DRIVE_FOLDER_ID ? { parents: [GOOGLE_DRIVE_FOLDER_ID] } : {}),
    },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id",
  });

  const fileId = res.data.id;
  if (!fileId) throw new Error("Google Drive upload (service account) returned no file ID.");

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  logger.info("upload.google-drive", { fileName, fileId });

  return {
    fileUrl: `https://drive.google.com/file/d/${fileId}/view`,
    storageKey: `gdrive:${fileId}`,
    mimeType,
    fileSize,
  };
}

// ---------------------------------------------------------------------------
// Amazon S3
// ---------------------------------------------------------------------------

async function uploadS3(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  fileSize: number,
): Promise<UploadResult> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const { S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = env;

  if (!S3_BUCKET || !S3_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "UPLOAD_PROVIDER=s3 requires S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, " +
        "and AWS_SECRET_ACCESS_KEY in .env.local.",
    );
  }

  const client = new S3Client({
    region: S3_REGION,
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  });

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `attachments/${Date.now()}-${safeFileName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: fileSize,
    }),
  );

  logger.info("upload.s3", { fileName, key });

  return {
    fileUrl: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`,
    storageKey: key,
    mimeType,
    fileSize,
  };
}
