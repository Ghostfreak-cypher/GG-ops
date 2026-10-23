import { env } from "@/lib/env";
import { uploadToCloudinary } from "@/lib/upload/cloudinary";
import { uploadToGoogleDrive } from "@/lib/upload/google-drive";
import { uploadToGoogleOAuth } from "@/lib/upload/google-oauth";
import { uploadToS3 } from "@/lib/upload/s3";

export type UploadInput = {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  fileSize: number;
};

export type UploadResult = {
  fileUrl: string;
  storageKey: string;
};

const ALLOWED_TYPES = [
  /^image\//,
  /^application\/pdf$/,
  /^text\/uri-list$/,
];

export function isAllowedContentType(contentType: string): boolean {
  return ALLOWED_TYPES.some((re) => re.test(contentType));
}

export async function uploadFile(input: UploadInput): Promise<UploadResult> {
  const provider = env.UPLOAD_PROVIDER ?? "google-drive";

  switch (provider) {
    case "google-drive":
      return uploadToGoogleDrive(input);
    case "google-oauth":
      return uploadToGoogleOAuth(input);
    case "cloudinary":
      return uploadToCloudinary(input);
    case "s3":
      return uploadToS3(input);
    default:
      throw new Error(`Unknown UPLOAD_PROVIDER: "${provider satisfies never}"`);
  }
}
