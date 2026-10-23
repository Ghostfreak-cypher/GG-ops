/**
 * Non-interactive health check for the google-oauth upload provider.
 * Run from my-app/:
 *   npx tsx --env-file=.env.local scripts/verify-google-oauth.ts
 *
 * It does NOT open a browser and does NOT create any Drive files. It only:
 *   1. exchanges GOOGLE_OAUTH_REFRESH_TOKEN for a short-lived access token
 *      (this is the step that fails with `invalid_grant` when the token is
 *      expired/revoked),
 *   2. reads the account the token belongs to (drive.about.get),
 *   3. confirms GOOGLE_DRIVE_FOLDER_ID is reachable.
 *
 * Secrets are never printed — only presence, a short non-reversible fingerprint,
 * and the resulting account email/folder name.
 */
import { createHash } from "node:crypto";
import { google } from "googleapis";

/** Short, non-reversible fingerprint so you can confirm local vs. prod match without exposing the value. */
function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

async function main(): Promise<void> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const provider = process.env.UPLOAD_PROVIDER ?? "(unset)";

  console.log("\nGoogle OAuth upload — health check");
  console.log("──────────────────────────────────");
  console.log(`UPLOAD_PROVIDER               : ${provider}`);
  console.log(`GOOGLE_OAUTH_CLIENT_ID        : ${clientId ? "present" : "MISSING"}`);
  console.log(`GOOGLE_OAUTH_CLIENT_SECRET    : ${clientSecret ? "present" : "MISSING"}`);
  console.log(
    `GOOGLE_OAUTH_REFRESH_TOKEN    : ${
      refreshToken ? `present (fp ${fingerprint(refreshToken)})` : "MISSING"
    }`,
  );
  console.log(`GOOGLE_DRIVE_FOLDER_ID        : ${folderId ? "present" : "MISSING"}`);

  if (!clientId || !clientSecret || !refreshToken) {
    console.error(
      "\n✗ Missing one of GOOGLE_OAUTH_CLIENT_ID / _SECRET / _REFRESH_TOKEN. " +
        "Make sure you ran with `--env-file=.env.local`.\n",
    );
    process.exit(1);
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  // 1) The critical step — mint an access token from the refresh token.
  try {
    const { token } = await auth.getAccessToken();
    if (!token) throw new Error("Google returned no access token.");
    console.log("\n✓ Refresh token is VALID — access token minted successfully.");
  } catch (err: unknown) {
    const detail = extractGoogleError(err);
    console.error(`\n✗ Refresh token is INVALID — ${detail}`);
    if (detail.includes("invalid_grant")) {
      console.error(
        "  The refresh token is expired or revoked. Re-run:\n" +
          "    npx tsx --env-file=.env.local scripts/google-oauth-token.ts\n" +
          "  then update GOOGLE_OAUTH_REFRESH_TOKEN in BOTH .env.local and Vercel.\n",
      );
    }
    process.exit(1);
  }

  const drive = google.drive({ version: "v3", auth });

  // 2) Which account does this token belong to?
  try {
    const about = await drive.about.get({ fields: "user(emailAddress,displayName)" });
    const user = about.data.user;
    console.log(`✓ Drive reachable — authorized as ${user?.emailAddress ?? "(unknown)"}`);
  } catch (err: unknown) {
    console.error(`✗ Could not read Drive account info — ${extractGoogleError(err)}`);
    process.exit(1);
  }

  // 3) Is the destination folder reachable?
  if (folderId) {
    try {
      const folder = await drive.files.get({
        fileId: folderId,
        fields: "id,name",
        supportsAllDrives: true,
      });
      console.log(`✓ Target folder reachable — "${folder.data.name}"`);
    } catch (err: unknown) {
      console.error(
        `✗ GOOGLE_DRIVE_FOLDER_ID is set but not reachable by this account — ${extractGoogleError(err)}`,
      );
      process.exit(1);
    }
  } else {
    console.log("• GOOGLE_DRIVE_FOLDER_ID not set — uploads would land in the account's Drive root.");
  }

  console.log("\n✓ All checks passed — the google-oauth upload provider is healthy.\n");
}

/** Pull the useful message out of a googleapis / Gaxios error without dumping the whole object. */
function extractGoogleError(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as {
      response?: { data?: { error?: string; error_description?: string } };
      message?: string;
    };
    const data = anyErr.response?.data;
    if (data?.error) {
      return data.error_description ? `${data.error}: ${data.error_description}` : data.error;
    }
    if (anyErr.message) return anyErr.message;
  }
  return String(err);
}

main().catch((err) => {
  console.error("Unexpected failure:", err instanceof Error ? err.message : err);
  process.exit(1);
});
