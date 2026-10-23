"use server";

import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db";
import type { ActionResult } from "@/lib/action-result";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { ModuleBoard, type ModuleBoardHydratedDocument } from "@/models/ModuleBoard";
import { Task } from "@/models/Task";
import { canEditModuleBoard, requireModuleBoardWorkspace } from "@/modules/module-board/access";
import { createSeedModuleBoard, normalizeLinkRecords, normalizeProofBundles } from "@/modules/module-board/logic";
import { listMembers } from "@/modules/workspace/server/queries";
import {
  moduleBoardCardInputSchema,
  moduleBoardModuleInputSchema,
  moduleBoardStructuredRowInputSchema,
} from "@/modules/module-board/schemas";

async function getEditableBoard(workspaceSlug: string) {
  const access = await requireModuleBoardWorkspace(workspaceSlug);
  if (!canEditModuleBoard(access.role)) {
    return { ok: false as const, error: "You don't have permission to edit this board." };
  }

  await connectDB();
  const workspaceObjectId = parseObjectIdOrThrow(access.workspace.id);
  let board = await ModuleBoard.findOne({ workspaceId: workspaceObjectId });

  if (!board) {
    try {
      const members = await listMembers(access.workspace.id);
      board = await ModuleBoard.create({
        workspaceId: workspaceObjectId,
        ...createSeedModuleBoard(access.userId, new Date(), members),
      });
    } catch {
      board = await ModuleBoard.findOne({ workspaceId: workspaceObjectId });
    }
  }

  if (!board) return { ok: false as const, error: "Failed to initialize module board." };
  return { ok: true as const, board, access };
}

async function assertWorkspaceTaskIds(workspaceId: string, taskIds: string[]) {
  if (taskIds.length === 0) return { ok: true as const };

  const count = await Task.countDocuments({
    _id: { $in: taskIds.map((taskId) => parseObjectIdOrThrow(taskId)) },
    workspaceId: parseObjectIdOrThrow(workspaceId),
    isArchived: false,
  });
  if (count !== taskIds.length) {
    return {
      ok: false as const,
      error: "Some linked tasks are outside this workspace or no longer available.",
    };
  }
  return { ok: true as const };
}

function boardPath(slug: string) {
  return `/w/${slug}/strategy/module-board`;
}

function setBoardAudit(board: ModuleBoardHydratedDocument, userId: string) {
  board.lastUpdatedBy = parseObjectIdOrThrow(userId);
}

export async function updateModuleBoardModuleAction(
  workspaceSlug: string,
  rowId: string,
  input: unknown,
): Promise<ActionResult> {
  const loaded = await getEditableBoard(workspaceSlug);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const parsed = moduleBoardModuleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const taskIds = [
    ...parsed.data.taskIds,
    ...parsed.data.proofBundles.flatMap((bundle) => bundle.taskIds),
  ];
  const taskCheck = await assertWorkspaceTaskIds(
    loaded.access.workspace.id,
    [...new Set(taskIds)],
  );
  if (!taskCheck.ok) return { ok: false, error: taskCheck.error };

  const row = loaded.board.modules.find((entry) => entry.id === rowId);
  if (!row) return { ok: false, error: "Module row not found." };

  const now = new Date();
  row.ownerUserId = parsed.data.ownerUserId
    ? parseObjectIdOrThrow(parsed.data.ownerUserId)
    : null;
  row.validatorUserId = parsed.data.validatorUserId
    ? parseObjectIdOrThrow(parsed.data.validatorUserId)
    : null;
  row.status = parsed.data.status;
  row.summary = parsed.data.summary;
  row.whatClosesIt = parsed.data.whatClosesIt;
  row.verificationSummary = parsed.data.verificationSummary;
  row.validatingReason = parsed.data.validatingReason;
  row.blockerReason = parsed.data.blockerReason;
  row.taskIds = parsed.data.taskIds.map((taskId) => parseObjectIdOrThrow(taskId));
  row.prUrls = normalizeLinkRecords(parsed.data.prUrls) as never;
  row.proofBundles = normalizeProofBundles(parsed.data.proofBundles, loaded.access.userId, now).map(
    (bundle) => ({
      ...bundle,
      taskIds: bundle.taskIds?.map((taskId) => parseObjectIdOrThrow(taskId)) ?? [],
      updatedBy: bundle.updatedBy ? parseObjectIdOrThrow(bundle.updatedBy) : null,
      updatedAt: bundle.updatedAt ?? now,
    }),
  ) as never;
  row.updatedBy = parseObjectIdOrThrow(loaded.access.userId);
  row.updatedAt = now;
  setBoardAudit(loaded.board, loaded.access.userId);

  await loaded.board.save();
  revalidatePath(boardPath(workspaceSlug));
  return { ok: true };
}

export async function updateModuleBoardStructuredRowAction(
  workspaceSlug: string,
  section: "pilotRoadmap" | "openItems" | "outreachPipeline" | "spendDiscipline" | "loadFlags",
  rowId: string,
  input: unknown,
): Promise<ActionResult> {
  const loaded = await getEditableBoard(workspaceSlug);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const parsed = moduleBoardStructuredRowInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const taskCheck = await assertWorkspaceTaskIds(
    loaded.access.workspace.id,
    [...new Set(parsed.data.taskIds)],
  );
  if (!taskCheck.ok) return { ok: false, error: taskCheck.error };

  const rows = loaded.board[section];
  const row = rows.find((entry) => entry.id === rowId);
  if (!row) return { ok: false, error: "Board row not found." };

  const now = new Date();
  row.title = parsed.data.title;
  row.ownerUserId = parsed.data.ownerUserId
    ? parseObjectIdOrThrow(parsed.data.ownerUserId)
    : null;
  row.status = parsed.data.status;
  row.note = parsed.data.note;
  row.taskIds = parsed.data.taskIds.map((taskId) => parseObjectIdOrThrow(taskId));
  row.externalUrls = normalizeLinkRecords(parsed.data.externalUrls) as never;
  row.updatedBy = parseObjectIdOrThrow(loaded.access.userId);
  row.updatedAt = now;
  setBoardAudit(loaded.board, loaded.access.userId);

  await loaded.board.save();
  revalidatePath(boardPath(workspaceSlug));
  return { ok: true };
}

export async function updateModuleBoardCardAction(
  workspaceSlug: string,
  section: "finishLines" | "masterGate" | "scopeHolds",
  cardId: string,
  input: unknown,
): Promise<ActionResult> {
  const loaded = await getEditableBoard(workspaceSlug);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const parsed = moduleBoardCardInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const cards = loaded.board[section];
  const card = cards.find((entry) => entry.id === cardId);
  if (!card) return { ok: false, error: "Board card not found." };

  const now = new Date();
  card.title = parsed.data.title;
  card.note = parsed.data.note;
  card.status = parsed.data.status;
  card.updatedBy = parseObjectIdOrThrow(loaded.access.userId);
  card.updatedAt = now;
  setBoardAudit(loaded.board, loaded.access.userId);

  await loaded.board.save();
  revalidatePath(boardPath(workspaceSlug));
  return { ok: true };
}


