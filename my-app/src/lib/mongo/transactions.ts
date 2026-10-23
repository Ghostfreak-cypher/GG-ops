import type { ClientSession } from "mongoose";
import { connectDB } from "@/lib/db";

/**
 * Run `fn` inside a MongoDB transaction (requires a replica set — Atlas provides one).
 * Use for multi-document writes that must stay consistent (create-workspace + maintainer
 * member, invite acceptance, task move/reorder).
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const conn = await connectDB();
  const session = await conn.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}
