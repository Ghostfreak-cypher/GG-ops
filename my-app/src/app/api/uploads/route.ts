import { handle } from "@/lib/api/handler";
import { ok, err } from "@/lib/api/response";
import { rateLimit } from "@/lib/rate-limit";
import { uploadFile, isAllowedContentType } from "@/lib/upload";
import { getCurrentUser } from "@/modules/auth/server/session";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export const POST = handle(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) return err("Unauthorized", 401);

  const limited = await rateLimit(`upload:${user.id}`, 60, 3600);
  if (!limited.allowed) return err("Too Many Requests", 429);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return err("Expected multipart/form-data", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return err("Missing file field", 400);

  if (!isAllowedContentType(file.type)) {
    return err("File type not allowed. Accepted: images, PDF, or URI list.", 415);
  }
  if (file.size > MAX_BYTES) {
    return err("File exceeds the 25 MB limit.", 413);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await uploadFile({
    buffer,
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
  });

  return ok(
    {
      fileUrl: result.fileUrl,
      storageKey: result.storageKey,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    },
    201,
  );
});
