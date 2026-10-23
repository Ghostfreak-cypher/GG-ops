import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/server/session";
import { getUserWorkspaces } from "@/modules/workspace/server/queries";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const workspaces = await getUserWorkspaces(user.id);
  redirect(workspaces.length > 0 ? `/w/${workspaces[0].slug}` : "/onboarding");
}
