import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/modules/auth/server/session";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const authUser = await requireUser();
  await connectDB();

  const user = await User.findById(authUser.id)
    .select("name email image jobTitle department bio pronounceUrl outOfOfficeEnabled outOfOfficeFrom outOfOfficeUntil outOfOfficeMessage")
    .lean();
  if (!user) notFound();

  const ux = user as unknown as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          This is how teammates see you across all workspaces.
        </p>
      </div>

      {/* Avatar preview */}
      <div className="flex items-center gap-4 border border-border p-4">
        <Avatar name={user.name} image={user.image ?? null} size="lg" className="!size-16 text-lg" />
        <div className="min-w-0">
          <p className="font-semibold wrap-anywhere">{user.name}</p>
          <p className="text-sm break-all text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Avatar is synced from your Google account or sign-up photo.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              name: user.name,
              jobTitle: (user.jobTitle as string) ?? null,
              department: ux.department as string | null ?? null,
              bio: ux.bio as string | null ?? null,
              pronounceUrl: ux.pronounceUrl as string | null ?? null,
              outOfOfficeEnabled: Boolean(ux.outOfOfficeEnabled),
              outOfOfficeFrom: ux.outOfOfficeFrom ? String(ux.outOfOfficeFrom) : null,
              outOfOfficeUntil: ux.outOfOfficeUntil ? String(ux.outOfOfficeUntil) : null,
              outOfOfficeMessage: ux.outOfOfficeMessage as string | null ?? null,
            }}
          />
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        <Link href="/account/security" className="underline hover:text-foreground">
          Security settings →
        </Link>
      </div>
    </div>
  );
}
