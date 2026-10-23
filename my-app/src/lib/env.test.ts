import { describe, it, expect } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  MONGODB_URI: "mongodb+srv://user:pass@cluster.mongodb.net/asana",
  AUTH_SECRET: "a-sufficiently-long-secret-value-123456",
  AUTH_GOOGLE_ID: "client-id.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: "google-client-secret",
};

const productionProviders = {
  APP_URL: "https://app.example.com",
  CRON_SECRET: "cron-secret",
  RESEND_API_KEY: "re_123",
  EMAIL_FROM: "GGOps <noreply@example.com>",
  PUSHER_APP_ID: "app",
  PUSHER_KEY: "key",
  PUSHER_SECRET: "secret",
  PUSHER_CLUSTER: "us2",
  NEXT_PUBLIC_PUSHER_KEY: "key",
  NEXT_PUBLIC_PUSHER_CLUSTER: "us2",
  UPLOAD_PROVIDER: "s3",
  S3_BUCKET: "asana-clone",
  S3_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "AKIA_EXAMPLE",
  AWS_SECRET_ACCESS_KEY: "aws-secret",
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "token",
  SENTRY_DSN: "https://public@example.com/1",
  NEXT_PUBLIC_SENTRY_DSN: "https://public@example.com/1",
};

describe("parseEnv", () => {
  it("returns typed env for valid input and defaults NODE_ENV to development", () => {
    const env = parseEnv(valid);
    expect(env.MONGODB_URI).toBe(valid.MONGODB_URI);
    expect(env.AUTH_GOOGLE_ID).toBe(valid.AUTH_GOOGLE_ID);
    expect(env.NODE_ENV).toBe("development");
  });

  it("throws when MONGODB_URI is missing", () => {
    const { MONGODB_URI: _omit, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/MONGODB_URI/);
  });

  it("throws when MONGODB_URI is not a mongodb connection string", () => {
    expect(() => parseEnv({ ...valid, MONGODB_URI: "http://example.com" })).toThrow();
  });

  it("throws when AUTH_SECRET is empty", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "" })).toThrow();
  });

  it("accepts a complete production launch env with Resend", () => {
    const env = parseEnv({
      ...valid,
      NODE_ENV: "production",
      ...productionProviders,
    });
    expect(env.APP_URL).toBe("https://app.example.com");
    expect(env.RESEND_API_KEY).toBe("re_123");
    expect(env.NEXT_PUBLIC_PUSHER_CLUSTER).toBe("us2");
  });

  it("accepts a complete production launch env with SMTP only", () => {
    const { RESEND_API_KEY: _resend, ...providers } = productionProviders;
    const env = parseEnv({
      ...valid,
      NODE_ENV: "production",
      ...providers,
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: "587",
      SMTP_USER: "you@gmail.com",
      SMTP_PASS: "app-password",
    });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.SMTP_HOST).toBe("smtp.gmail.com");
    expect(env.SMTP_PORT).toBe(587);
  });

  it("accepts a production launch env without Sentry (optional)", () => {
    const { SENTRY_DSN: _dsn, NEXT_PUBLIC_SENTRY_DSN: _publicDsn, ...providers } =
      productionProviders;
    const env = parseEnv({ ...valid, NODE_ENV: "production", ...providers });
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
  });

  it("requires production launch provider variables", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production" })).toThrow(
      /Production launch requires/,
    );
  });

  it("requires production email sender and one complete provider", () => {
    const { EMAIL_FROM: _omitEmail, RESEND_API_KEY: _omitResend, ...restProviders } = productionProviders;
    expect(() =>
      parseEnv({ ...valid, NODE_ENV: "production", ...restProviders }),
    ).toThrow(/Production email requires EMAIL_FROM/);
  });

  it("requires the configured upload provider's variables in production", () => {
    const { S3_BUCKET: _omitBucket, ...restProviders } = productionProviders;
    expect(() =>
      parseEnv({ ...valid, NODE_ENV: "production", ...restProviders }),
    ).toThrow(/UPLOAD_PROVIDER=s3 requires/);
  });

  it("requires all SMTP variables together", () => {
    expect(() =>
      parseEnv({
        ...valid,
        SMTP_HOST: "smtp.gmail.com",
      }),
    ).toThrow(/SMTP_HOST\/SMTP_USER\/SMTP_PASS/);
  });
});
