import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/server/session";
import { listApiKeys } from "@/modules/api-key/server/queries";
import { CreateKeyForm } from "./create-key-form";
import { RevokeKeyButton } from "./revoke-key-button";

export default async function ApiKeysPage() {
  const user = await requireUser();
  const keys = await listApiKeys(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="text-sm text-muted-foreground">
          Let AI tools (Claude, Gemini, or your own scripts) act as you — creating and updating
          tasks with the same permissions you have. Anyone with a key can do anything you can do,
          so treat it like a password.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create a key</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateKeyForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {key.prefix}… · {key.scopes.join(", ")}
                    {key.lastUsedAt ? ` · last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : " · never used"}
                    {key.expiresAt ? ` · expires ${new Date(key.expiresAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <RevokeKeyButton keyId={key.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
