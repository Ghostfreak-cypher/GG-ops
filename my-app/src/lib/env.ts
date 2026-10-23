import { z } from "zod";

export const envSchema = z.object({
  MONGODB_URI: z.string().min(1).startsWith("mongodb"),
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().optional(),
  CRON_SECRET: z.string().min(1).optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  PUSHER_APP_ID: z.string().min(1).optional(),
  PUSHER_KEY: z.string().min(1).optional(),
  PUSHER_SECRET: z.string().min(1).optional(),
  PUSHER_CLUSTER: z.string().min(1).optional(),
  NEXT_PUBLIC_PUSHER_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().min(1).optional(),
  UPLOADTHING_TOKEN: z.string().min(1).optional(),
  UPLOAD_PROVIDER: z.enum(["google-drive", "google-oauth", "cloudinary", "s3"]).optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1).optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().min(1).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  SENTRY_DSN: z.url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
  // Slug of the single private workspace allowed to see the AWS spend report feature.
  FINANCE_WORKSPACE_SLUG: z.string().min(1).optional(),
  // GG-Docs base URL. Shows the "Open in GG-Docs" sidebar link; unset hides it.
  GGDOCS_URL: z.url().optional(),

  // ── Inbound email → task (V5) ──────────────────────────────────────────────
  // Off unless explicitly enabled. This feature ingests attacker-controllable content
  // (anyone can send email) into an LLM that then creates tasks, so it must never come up
  // by accident just because Gmail credentials happen to be present in the environment.
  INBOUND_EMAIL_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .describe("Set to \"true\" to turn on the inbound-email cron. Default off."),
  // Separate Gmail OAuth client from the Drive upload one — different scopes, and we don't
  // want a Drive token silently granting mailbox access (or vice versa).
  GMAIL_CLIENT_ID: z.string().min(1).optional(),
  GMAIL_CLIENT_SECRET: z.string().min(1).optional(),
  GMAIL_REFRESH_TOKEN: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

const productionRequiredVars = [
  "APP_URL",
  "CRON_SECRET",
  "PUSHER_APP_ID",
  "PUSHER_KEY",
  "PUSHER_SECRET",
  "PUSHER_CLUSTER",
  "NEXT_PUBLIC_PUSHER_KEY",
  "NEXT_PUBLIC_PUSHER_CLUSTER",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const satisfies readonly (keyof Env)[];

function validateProductionEnv(data: Env): void {
  if (data.NODE_ENV !== "production") return;

  const missing = productionRequiredVars.filter((key) => !data[key]);
  if (missing.length > 0) {
    throw new Error(
      `Invalid environment variables:\n  Production launch requires: ${missing.join(", ")}`,
    );
  }

  const uploadProvider = data.UPLOAD_PROVIDER ?? "google-drive";
  const uploadRequirements: Record<string, readonly (keyof Env)[]> = {
    s3: ["S3_BUCKET", "S3_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
    cloudinary: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    "google-drive": [
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
      "GOOGLE_DRIVE_FOLDER_ID",
    ],
    "google-oauth": [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REFRESH_TOKEN",
    ],
  };
  const missingUpload = (uploadRequirements[uploadProvider] ?? []).filter((key) => !data[key]);
  if (missingUpload.length > 0) {
    throw new Error(
      `Invalid environment variables:\n  UPLOAD_PROVIDER=${uploadProvider} requires: ${missingUpload.join(", ")}`,
    );
  }

  const hasResend = !!data.RESEND_API_KEY;
  const hasSmtp = !!(data.SMTP_HOST && data.SMTP_USER && data.SMTP_PASS);
  if (!data.EMAIL_FROM || (!hasResend && !hasSmtp)) {
    throw new Error(
      "Invalid environment variables:\n  Production email requires EMAIL_FROM and either RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS",
    );
  }
  if (data.RESEND_API_KEY && !data.EMAIL_FROM) {
    throw new Error("Invalid environment variables:\n  RESEND_API_KEY/EMAIL_FROM: set both or neither");
  }
  if (
    (data.UPSTASH_REDIS_REST_URL && !data.UPSTASH_REDIS_REST_TOKEN) ||
    (!data.UPSTASH_REDIS_REST_URL && data.UPSTASH_REDIS_REST_TOKEN)
  ) {
    throw new Error(
      "Invalid environment variables:\n  UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN: set both or neither",
    );
  }
  if (
    (data.PUSHER_APP_ID || data.PUSHER_KEY || data.PUSHER_SECRET || data.PUSHER_CLUSTER) &&
    !(data.PUSHER_APP_ID && data.PUSHER_KEY && data.PUSHER_SECRET && data.PUSHER_CLUSTER)
  ) {
    throw new Error(
      "Invalid environment variables:\n  PUSHER_*: set APP_ID, KEY, SECRET, and CLUSTER together",
    );
  }
  if (
    (data.NEXT_PUBLIC_PUSHER_KEY && !data.NEXT_PUBLIC_PUSHER_CLUSTER) ||
    (!data.NEXT_PUBLIC_PUSHER_KEY && data.NEXT_PUBLIC_PUSHER_CLUSTER)
  ) {
    throw new Error(
      "Invalid environment variables:\n  NEXT_PUBLIC_PUSHER_*: set KEY and CLUSTER together",
    );
  }
  if (
    (data.SENTRY_DSN && !data.NEXT_PUBLIC_SENTRY_DSN) ||
    (!data.SENTRY_DSN && data.NEXT_PUBLIC_SENTRY_DSN)
  ) {
    throw new Error(
      "Invalid environment variables:\n  SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN: set both together",
    );
  }
}

/** Pure validation - throws a readable error listing every invalid/missing var. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  const data = result.data;
  const smtpFields = [data.SMTP_HOST, data.SMTP_USER, data.SMTP_PASS];
  if (smtpFields.some(Boolean) && !smtpFields.every(Boolean)) {
    throw new Error(
      "Invalid environment variables:\n  SMTP_HOST/SMTP_USER/SMTP_PASS: set all or none",
    );
  }
  validateProductionEnv(data);
  return data;
}

let cached: Env | undefined;

/** Lazily validate `process.env` once, on first access (keeps build/test side-effect free). */
export function getEnv(): Env {
  if (cached) return cached;
  // Treat empty-string vars (e.g. a blank `FOO=` placeholder line in .env) as
  // absent, so `.optional()` applies instead of failing `.min(1)`.
  const source: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    source[key] = value === "" ? undefined : value;
  }
  return (cached = parseEnv(source));
}

/** Ergonomic accessor: `env.MONGODB_URI`. Validation is deferred to first property read. */
export const env = new Proxy({} as Env, {
  get: (_target, prop: string) => getEnv()[prop as keyof Env],
});
