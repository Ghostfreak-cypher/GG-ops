import Link from "next/link";
import { verifyEmailAction } from "@/modules/auth/server/actions/verify-email";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await verifyEmailAction(token) : { ok: false as const, error: "Missing verification token." };

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Email verification</h1>
        <p className="text-sm text-muted-foreground">
          {result.ok ? "Your email is verified." : result.error}
        </p>
      </div>
      <Link className="text-sm underline" href="/sign-in">
        Go to sign in
      </Link>
    </div>
  );
}
