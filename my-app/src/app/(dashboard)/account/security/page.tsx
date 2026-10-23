import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/server/session";
import { listRecentLogins } from "@/lib/auth-security";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountSecurityPage() {
  const user = await requireUser();
  const recentLogins = await listRecentLogins(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account security</h1>
        <p className="text-sm text-muted-foreground">Password and recent login activity.</p>
      </div>

      {user.hasPassword ? (
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Password sign-in</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">This account currently signs in with Google only.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent logins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentLogins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent logins recorded yet.</p>
          ) : (
            recentLogins.map((event) => (
              <div key={event.id} className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
                <div className="text-sm font-medium">{event.provider}</div>
                <div className="text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{event.ipMasked ?? "Unknown IP"}</div>
                <div className="text-xs text-muted-foreground">{event.userAgent ?? "Unknown device"}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
