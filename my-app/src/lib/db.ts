import mongoose from "mongoose";
import { env } from "@/lib/env";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Cache the connection on the global object so it survives HMR / Turbopack
// module reloads in dev (and is reused across serverless invocations in prod).
const globalForMongoose = globalThis as unknown as { _mongoose?: MongooseCache };

const cache: MongooseCache =
  globalForMongoose._mongoose ??
  (globalForMongoose._mongoose = { conn: null, promise: null });

/** The only way to talk to MongoDB. Returns a singleton, reused across calls. */
export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      // Mongoose's default (true) validates every one of the ~90 declared indexes against
      // the server on every fresh connection. The indexes themselves are unchanged — this
      // only stops re-verifying them on every cold start in production. Off in dev/test so
      // a new index on a fresh local/CI database still gets created automatically; deploys
      // run `npm run db:sync-indexes` once instead.
      autoIndex: process.env.NODE_ENV !== "production",
    });
  }
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
