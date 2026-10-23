import { handleAuthed } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

/** GET /api/v1/me — who this credential acts as. Lets an OAuth client learn which account connected. */
export const GET = handleAuthed(async (_req, user) => {
  return ok({ id: user.id, name: user.name, email: user.email });
});
