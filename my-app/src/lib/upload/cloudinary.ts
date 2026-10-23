import crypto from "node:crypto";
import { env } from "@/lib/env";

export async function uploadToCloudinary(input: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}): Promise<{ fileUrl: string; storageKey: string }> {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "asana-clone";
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");

  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.buffer)], { type: input.contentType });
  form.append("file", blob, input.fileName);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: "POST", body: form },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    secure_url?: string;
    public_id?: string;
    error?: { message: string };
  };

  if (data.error) throw new Error(`Cloudinary error: ${data.error.message}`);
  if (!data.secure_url || !data.public_id) {
    throw new Error("Cloudinary returned an incomplete response.");
  }

  return { fileUrl: data.secure_url, storageKey: data.public_id };
}
