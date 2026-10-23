import { redirect } from "next/navigation";

// Phase 0 placeholder route — the real home is now the workspace, routed from "/".
export default function LegacyDashboard() {
  redirect("/");
}
