# GeneGenius OpsHub

Internal operations and project coordination app for GeneGenius demos.

## Runtime

Use Node.js 22.x for local development and CI. The project declares
`"engines": { "node": "22.x" }`.

## Local Demo

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

Fill `.env.local` with MongoDB, Auth.js Google OAuth, and either Resend or SMTP if you want real email delivery. Without a complete email provider, email jobs use Ethereal test delivery in non-production and log a preview URL.

For a personal Google Drive upload demo, use:

```bash
UPLOAD_PROVIDER=google-oauth
npx tsx --env-file=.env.local scripts/google-oauth-token.ts
```

Keep Drive credentials and refresh tokens in `.env.local`; do not commit them.

## Local Cron

Hosted Vercel cron is not the demo path because `/api/cron/jobs` is configured for every 5 minutes, which is above Vercel Hobby cron frequency. Run cron locally instead:

```bash
npm run cron:local
```

That drains queued jobs, generates due reminders, cleans expired invites, then drains again so newly queued due emails are processed immediately.

Manual endpoint checks still work when the dev server is running:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/jobs
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/due-reminders
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/cleanup-invites
```

## Email MVP

Implemented email job types:

- `invite-email`
- `mention-email`
- `task-assigned-email`
- `task-due-email`

Provider selection order is Resend first, SMTP second, and Ethereal test delivery outside production. Production env validation requires `EMAIL_FROM` plus either `RESEND_API_KEY` or complete SMTP credentials.

## Amplify Later

`../amplify.yml` is configured for the `my-app` subdirectory with `npm ci`, `npm run build`, `.next` artifacts, and Node 22.

Before committing to Amplify production deployment, run a compatibility spike: this app currently uses Next `16.2.9`, while Amplify Hosting SSR support may lag behind current Next major versions. If Amplify does not support Next 16, use a separate deployment branch pinned to a supported Next 15.x version instead of downgrading main immediately.

Replace Vercel Cron with AWS EventBridge scheduled API destinations or a small scheduled Lambda that calls the protected `/api/cron/*` endpoints over HTTPS.

## Verification

```bash
npm test
npm run build
```

Local smoke checklist:

- Invite a member and confirm an invite job is queued.
- Run `npm run cron:local` and confirm the email is sent or logged.
- Mention a user in a comment and confirm the mention email path.
- Assign a task and confirm a task assignment email job is queued.
- Upload an attachment and confirm the Google Drive URL is stored and viewable.
- Trigger due reminders and confirm notifications/email jobs are idempotent.
