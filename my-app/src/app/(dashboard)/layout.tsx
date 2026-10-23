import { requireUser } from "@/modules/auth/server/session";
import { VerificationBanner } from "@/components/auth/verification-banner";

// Authed gate for the whole app area. Workspace chrome lives in w/[workspaceSlug]/layout.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <>
      {!user.emailVerified ? <VerificationBanner userId={user.id} /> : null}
      {children}
    </>
  );
}
