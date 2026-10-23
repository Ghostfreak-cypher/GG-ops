import { google } from "googleapis";
import { Readable } from "node:stream";
import { env } from "@/lib/env";

/**
 * Google Drive upload using OAuth2 user credentials (a refresh token).
 * Unlike the service-account adapter, files land in a real account's Drive,
 * so they use that account's normal storage quota. Reuses GOOGLE_DRIVE_FOLDER_ID.
 */
export async function uploadToGoogleOAuth(input: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}): Promise<{ fileUrl: string; storageKey: string }> {
  if (
    !env.GOOGLE_OAUTH_CLIENT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    !env.GOOGLE_DRIVE_FOLDER_ID
  ) {
    throw new Error(
      "Google OAuth Drive not configured — set GOOGLE_OAUTH_CLIENT_ID, " +
        "GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN, and GOOGLE_DRIVE_FOLDER_ID.",
    );
  }

  const auth = new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
  // The library auto-mints short-lived access tokens from this refresh token.
  auth.setCredentials({ refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN });

  const drive = google.drive({ version: "v3", auth });

  const uploaded = await drive.files.create({
    requestBody: {
      name: input.fileName,
      parents: [env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType: input.contentType,
      body: Readable.from(input.buffer),
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const fileId = uploaded.data.id;
  if (!fileId) throw new Error("Google Drive upload returned no file ID.");

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  });

  return {
    fileUrl: `https://drive.google.com/uc?id=${fileId}&export=view`,
    storageKey: fileId,
  };
}
