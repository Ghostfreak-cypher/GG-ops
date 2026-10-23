/**
 * One-time script to capture a Google OAuth2 refresh token for Drive uploads.
 * Run from my-app/:
 *   npx tsx --env-file=.env.local scripts/google-oauth-token.ts
 *
 * Prereq: in Google Cloud Console → Credentials → your OAuth client, add
 *   http://localhost:5555/oauth2callback
 * as an Authorized redirect URI.
 *
 * It opens a consent URL; after you approve, it prints the refresh token.
 * Paste that into .env.local as GOOGLE_OAUTH_REFRESH_TOKEN and set
 * UPLOAD_PROVIDER=google-oauth.
 */
import http from "node:http";
import { exec } from "node:child_process";
import { google } from "googleapis";

/** Open a URL in the default browser, cross-platform. */
function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log("(Could not auto-open a browser — copy the URL above manually.)");
  });
}

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const PORT = 5555;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;

if (!clientId || !clientSecret) {
  console.error(
    "Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in environment.\n" +
      "Run with:  npx tsx --env-file=.env.local scripts/google-oauth-token.ts",
  );
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline", // request a refresh token
  prompt: "consent", // force re-consent so a refresh token is always returned
  scope: ["https://www.googleapis.com/auth/drive"],
});

const server = http.createServer(async (req, res) => {
  console.log(`→ incoming request: ${req.url}`);

  if (!req.url?.startsWith("/oauth2callback")) {
    // Ignore noise like /favicon.ico without killing the wait
    res.writeHead(404).end();
    return;
  }

  const params = new URL(req.url, REDIRECT).searchParams;
  const code = params.get("code");
  const oauthError = params.get("error");

  if (oauthError) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h2>Authorization failed: ${oauthError}</h2>`);
    console.error(`\n✗ Google returned an error: "${oauthError}"`);
    if (oauthError === "access_denied") {
      console.error(
        "  Most likely your OAuth consent screen is in 'Testing' mode and this\n" +
          "  Google account isn't a test user. Fix: Google Cloud Console →\n" +
          "  APIs & Services → OAuth consent screen → Audience → add your email\n" +
          "  under 'Test users', then run this script again.\n",
      );
    }
    server.close();
    return;
  }

  if (!code) {
    res.writeHead(400).end("Missing authorization code.");
    console.error(
      `\n✗ Callback had no ?code= and no ?error=. Full query: "${params.toString() || "(empty)"}"`,
    );
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h2>Success — you can close this tab and return to the terminal.</h2>");

    if (!tokens.refresh_token) {
      console.error(
        "\n✗ No refresh token returned. Revoke prior access at " +
          "https://myaccount.google.com/permissions and run this again.\n",
      );
    } else {
      console.log("\n✓ Refresh token captured. Add this to .env.local:\n");
      console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log("\nThen set:  UPLOAD_PROVIDER=google-oauth\n");
    }
  } catch (err) {
    res.writeHead(500).end("Token exchange failed.");
    console.error("✗ Token exchange failed:", err instanceof Error ? err.message : err);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log("\nOpening your browser to authorize…");
  console.log("If it doesn't open, paste this URL manually:\n");
  console.log(authUrl);
  console.log(`\nListening for the redirect on ${REDIRECT} …`);
  console.log("(Complete the Google consent screen — do NOT visit localhost:5555 yourself.)\n");
  openBrowser(authUrl);
});
