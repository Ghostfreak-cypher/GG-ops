import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/modules/auth/server/session";
import { getClientByClientId } from "@/modules/oauth/server/queries";
import { authorizeParamsSchema } from "@/modules/oauth/schemas";
import { approveAuthorizationAction, denyAuthorizationAction } from "@/modules/oauth/server/actions/authorize";

type SearchParams = { [key: string]: string | string[] | undefined };

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6 text-center">
      <h1 className="text-2xl font-semibold">Can&apos;t connect this app</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const clientId = firstValue(raw.client_id);
  const redirectUri = firstValue(raw.redirect_uri);

  // client_id and redirect_uri are verified BEFORE anything else — until redirect_uri
  // is confirmed to exactly match a registered URI, it is not safe to use it as an
  // error-redirect target (that would be an open redirect).
  const client = clientId ? await getClientByClientId(clientId) : null;
  if (!client) return <ErrorScreen message="This app isn't registered with GGOps." />;
  if (!client.redirectUris.includes(redirectUri)) {
    return <ErrorScreen message="This app's redirect address doesn't match what's on file." />;
  }

  const parsed = authorizeParamsSchema.safeParse({
    response_type: firstValue(raw.response_type),
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: firstValue(raw.code_challenge),
    code_challenge_method: firstValue(raw.code_challenge_method),
    scope: raw.scope ? firstValue(raw.scope) : undefined,
    state: raw.state ? firstValue(raw.state) : undefined,
  });

  const state = raw.state ? firstValue(raw.state) : undefined;
  if (!parsed.success) {
    const target = new URL(redirectUri);
    target.searchParams.set("error", "invalid_request");
    if (state) target.searchParams.set("state", state);
    redirect(target.toString());
  }

  const user = await getCurrentUser();
  if (!user) {
    const query = new URLSearchParams(
      Object.entries(raw).flatMap(([k, v]) => (v === undefined ? [] : [[k, firstValue(v)]])),
    ).toString();
    redirect(`/sign-in?next=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  const scopeValue = parsed.data.scope.join(" ");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="wrap-anywhere">{client.clientName} wants to access your GGOps account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium break-all text-foreground">{user.email}</span>
          </p>
          <div className="space-y-1 text-sm">
            <p className="font-medium">This will allow {client.clientName} to:</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>Read your tasks, projects, and workspaces</li>
              {parsed.data.scope.includes("write") && <li>Create and edit tasks and comments as you</li>}
            </ul>
          </div>
          {/* The real security signal — an attacker can fake a client name via open DCR, not this origin. */}
          <p className="rounded border border-border bg-muted p-2 text-xs text-muted-foreground">
            After approval, you&apos;ll be sent to{" "}
            <span className="font-mono break-all">{new URL(redirectUri).origin}</span>
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <form action={approveAuthorizationAction} className="flex-1">
              <input type="hidden" name="response_type" value="code" />
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="redirect_uri" value={redirectUri} />
              <input type="hidden" name="code_challenge" value={parsed.data.code_challenge} />
              <input type="hidden" name="code_challenge_method" value="S256" />
              <input type="hidden" name="scope" value={scopeValue} />
              {state && <input type="hidden" name="state" value={state} />}
              <Button type="submit" className="w-full">
                Authorize
              </Button>
            </form>
            <form action={denyAuthorizationAction} className="flex-1">
              <input type="hidden" name="response_type" value="code" />
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="redirect_uri" value={redirectUri} />
              <input type="hidden" name="code_challenge" value={parsed.data.code_challenge} />
              <input type="hidden" name="code_challenge_method" value="S256" />
              <input type="hidden" name="scope" value={scopeValue} />
              {state && <input type="hidden" name="state" value={state} />}
              <Button type="submit" variant="outline" className="w-full">
                Deny
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
