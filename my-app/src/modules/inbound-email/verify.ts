import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { isValidObjectId } from "@/lib/mongo/ids";
import { resolveWorkspace, resolveProject, ResolutionError } from "@/modules/mcp/resolve";
import { getUserWorkspaces } from "@/modules/workspace/server/queries";
import type { NormalizedEmail } from "@/modules/inbound-email/normalize";
import type { TaskActor } from "@/modules/task/server/create-task-core";

/**
 * The gates every inbound email must pass BEFORE we spend a single LLM token.
 *
 * The threat model: anyone on the internet can send email to the ingestion address, and the
 * body reaches a model that then creates tasks. The defence is not to make the model
 * clever about that — it's to establish, up front, that the message genuinely came from a
 * person who could have created the task by hand anyway. After these checks the residual
 * risk is "a workspace member sent a malicious email", i.e. an insider who already had
 * write access.
 */

/**
 * Gate 1 — sender authenticity. **The single most important control in V5.**
 *
 * `From:` is trivially forgeable; without cryptographic verification the entire
 * authorization model below is decoration, because anyone could claim to be a member.
 * We require DMARC pass, or SPF *and* DKIM both passing (DMARC is built on them, and some
 * providers report the components without an explicit dmarc verdict).
 *
 * The header is written by our own receiving mail server, not the sender — a forged
 * `Authentication-Results` in the original message is overwritten on delivery.
 */
export function verifyAuthResults(authResults: string): { ok: true } | { ok: false; reason: string } {
  if (!authResults.trim()) {
    return { ok: false, reason: "No Authentication-Results header — cannot verify the sender." };
  }
  const header = authResults.toLowerCase();

  if (/\bdmarc=pass\b/.test(header)) return { ok: true };
  if (/\bdmarc=(fail|none|temperror|permerror)\b/.test(header)) {
    return { ok: false, reason: "DMARC did not pass — the sender address may be forged." };
  }
  if (/\bspf=pass\b/.test(header) && /\bdkim=pass\b/.test(header)) return { ok: true };

  return { ok: false, reason: "Neither DMARC nor SPF+DKIM passed — the sender is unverified." };
}

export type SenderResolution =
  | { ok: true; actor: TaskActor }
  | { ok: false; reason: string };

/**
 * Gate 2 — the sender must be a known, active GGOps user.
 *
 * Never auto-creates a user: account creation from an unauthenticated email would let
 * anyone mint an identity, and identities are what the next gate authorizes against.
 */
export async function resolveSender(email: NormalizedEmail): Promise<SenderResolution> {
  await connectDB();

  const user = await User.findOne({ email: email.fromEmail, isActive: true })
    .select("name email")
    .lean();

  if (!user) {
    return { ok: false, reason: `Sender ${email.fromEmail} is not an active GGOps user.` };
  }
  return { ok: true, actor: { id: String(user._id), name: user.name ?? "Someone" } };
}

export type TargetResolution =
  | { ok: true; projectId: string; projectName: string; workspaceName: string }
  | { ok: false; reason: string };

/**
 * Gate 3 — which project, and is the sender allowed to write to it?
 *
 * Two addressing schemes, most explicit first:
 *   1. plus-addressing — `inbound+<projectId>@…`, unambiguous, ideal for automation
 *   2. a `[Project Name]` subject tag, resolved through V4a's resolver
 *
 * Resolution runs **as the sender**, so `resolveWorkspace`/`resolveProject` only ever see
 * workspaces they are an ACTIVE member of. A stranger naming a real project gets the same
 * "not found" as one naming a fake project.
 */
export async function resolveTarget(
  email: NormalizedEmail,
  actor: TaskActor,
): Promise<TargetResolution> {
  const plusTag = email.to
    .map((address) => address.match(/\+([^@]+)@/)?.[1])
    .find((tag): tag is string => Boolean(tag));

  const subjectTag = email.subject.match(/^\s*\[([^\]]+)\]/)?.[1]?.trim();
  const ref = plusTag ?? subjectTag;

  if (!ref) {
    return {
      ok: false,
      reason:
        "No target project. Address the mail to inbound+<projectId>@… or start the subject with [Project Name].",
    };
  }

  try {
    // A plus-tag that is a bare ObjectId identifies the project directly; we still have to
    // find which of the sender's workspaces owns it, so the membership check applies.
    if (plusTag && isValidObjectId(plusTag)) {
      for (const summary of await getUserWorkspaces(actor.id)) {
        try {
          const project = await resolveProject(summary, plusTag);
          return { ok: true, projectId: project.id, projectName: project.name, workspaceName: summary.name };
        } catch {
          // Not in this workspace — keep looking.
        }
      }
      return { ok: false, reason: `Project ${plusTag} is not in any workspace you belong to.` };
    }

    // Otherwise treat the tag as "Workspace/Project" or just a project name searched across
    // the sender's workspaces.
    const [first, second] = ref.split("/").map((s) => s.trim());
    if (second) {
      const ws = await resolveWorkspace(actor.id, first!);
      const project = await resolveProject(ws, second);
      return { ok: true, projectId: project.id, projectName: project.name, workspaceName: ws.name };
    }

    const matches: { projectId: string; projectName: string; workspaceName: string }[] = [];
    for (const summary of await getUserWorkspaces(actor.id)) {
      try {
        const project = await resolveProject(summary, first!);
        matches.push({ projectId: project.id, projectName: project.name, workspaceName: summary.name });
      } catch {
        // No match in this workspace.
      }
    }
    if (matches.length === 1) return { ok: true, ...matches[0]! };
    if (matches.length > 1) {
      return {
        ok: false,
        reason: `"${first}" matches projects in ${matches.length} workspaces. Use [Workspace/Project].`,
      };
    }
    return { ok: false, reason: `No project matching "${first}" in any workspace you belong to.` };
  } catch (error) {
    if (error instanceof ResolutionError) return { ok: false, reason: error.message };
    throw error;
  }
}
