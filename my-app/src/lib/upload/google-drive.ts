import { google } from "googleapis";
import { Readable } from "node:stream";
import { env } from "@/lib/env";

export async function uploadToGoogleDrive(input: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}): Promise<{ fileUrl: string; storageKey: string }> {
  if (
    !env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    !env.GOOGLE_DRIVE_FOLDER_ID
  ) {
    throw new Error(
      "Google Drive not configured — set GOOGLE_SERVICE_ACCOUNT_EMAIL, " +
        "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID.",
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // .env stores the key with literal \n sequences; restore real newlines
      private_key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

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

  // Make publicly viewable so <img> tags and PDF links work in the UI
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  });

  return {
    // export=view renders images inline and opens PDFs in Drive's viewer
    fileUrl: `https://drive.google.com/uc?id=${fileId}&export=view`,
    storageKey: fileId,
  };
}
