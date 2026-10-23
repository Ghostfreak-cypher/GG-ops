import { CreateWorkspaceForm } from "./create-workspace-form";

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold">Create a workspace</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Workspaces hold your team&apos;s projects and tasks.
      </p>
      <CreateWorkspaceForm />
    </div>
  );
}
