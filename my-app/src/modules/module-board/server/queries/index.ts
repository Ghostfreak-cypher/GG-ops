import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { ModuleBoard } from "@/models/ModuleBoard";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import {
  countSundayWarnings,
  createSeedModuleBoard,
  getModuleBoardWarnings,
  isPatentModuleKey,
} from "@/modules/module-board/logic";
import { listMembers } from "@/modules/workspace/server/queries";
import type {
  ModuleBoardCardDTO,
  ModuleBoardDTO,
  ModuleBoardModuleDTO,
  ModuleBoardStructuredRowDTO,
  ModuleBoardTaskRef,
  ModuleBoardUserRef,
} from "@/modules/module-board/server/dto";

type PersistedCard = {
  id: string;
  title: string;
  note: string;
  status: ModuleBoardDTO["modules"][number]["status"];
  updatedBy: unknown | null;
  updatedAt: Date | null;
};

type PersistedStructuredRow = {
  id: string;
  title: string;
  ownerUserId: unknown | null;
  status: ModuleBoardDTO["modules"][number]["status"];
  note: string;
  taskIds?: unknown[];
  externalUrls: Array<{ label: string; url: string }>;
  updatedBy: unknown | null;
  updatedAt: Date | null;
};

type PersistedProofBundle = {
  id: string;
  status: ModuleBoardDTO["modules"][number]["status"];
  whatVerified: string;
  proof: string;
  taskIds?: unknown[];
  externalUrls: Array<{ label: string; url: string }>;
  evidenceLinks: Array<{ label: string; url: string }>;
  updatedBy: unknown | null;
  updatedAt: Date | null;
};

type PersistedModuleRow = {
  id: string;
  moduleKey: string;
  title: string;
  ownerUserId: unknown | null;
  validatorUserId: unknown | null;
  status: ModuleBoardDTO["modules"][number]["status"];
  summary: string;
  whatClosesIt: string;
  verificationSummary: string;
  validatingReason: string;
  blockerReason: string;
  taskIds?: unknown[];
  prUrls: Array<{ label: string; url: string }>;
  proofBundles: PersistedProofBundle[];
  updatedBy: unknown | null;
  updatedAt: Date | null;
};

type ModuleBoardPersisted = {
  _id: unknown;
  workspaceId: unknown;
  finishLines: PersistedCard[];
  masterGate: PersistedCard[];
  modules: PersistedModuleRow[];
  pilotRoadmap: PersistedStructuredRow[];
  openItems: PersistedStructuredRow[];
  outreachPipeline: PersistedStructuredRow[];
  spendDiscipline: PersistedStructuredRow[];
  loadFlags: PersistedStructuredRow[];
  scopeHolds: PersistedCard[];
  lastUpdatedBy: unknown | null;
  updatedAt?: Date;
};

async function ensureBoard(workspaceId: string, userId: string) {
  await connectDB();
  const workspaceObjectId = parseObjectIdOrThrow(workspaceId);

  let board = await ModuleBoard.findOne({ workspaceId: workspaceObjectId });
  if (board) return board;

  try {
    const members = await listMembers(workspaceId);
    board = await ModuleBoard.create({
      workspaceId: workspaceObjectId,
      ...createSeedModuleBoard(userId, new Date(), members),
    });
  } catch {
    board = await ModuleBoard.findOne({ workspaceId: workspaceObjectId });
  }

  if (!board) throw new Error("Failed to initialize module board.");
  return board;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toUserRef(
  userId: unknown | null | undefined,
  userById: Map<string, { _id: unknown; name?: string; email?: string; image?: string | null }>,
): ModuleBoardUserRef | null {
  if (!userId) return null;
  const key = String(userId);
  const user = userById.get(key);
  if (!user) return { userId: key, name: "Unknown", image: null };
  return {
    userId: key,
    name: user.name ?? user.email ?? "Unknown",
    image: user.image ?? null,
  };
}

function resolveTaskLinks(
  ids: unknown[] | undefined,
  taskById: Map<string, { _id: unknown; title: string; projectId: unknown }>,
  projectById: Map<string, { _id: unknown; name: string }>,
  workspaceSlug: string,
): ModuleBoardTaskRef[] {
  if (!ids?.length) return [];
  return ids
    .map((taskId) => {
      const task = taskById.get(String(taskId));
      if (!task) return null;
      const projectId = String(task.projectId);
      const project = projectById.get(projectId);
      return {
        id: String(task._id),
        title: task.title,
        projectId,
        projectName: project?.name ?? "Unknown project",
        href: `/w/${workspaceSlug}/projects/${projectId}/tasks/${String(task._id)}`,
      };
    })
    .filter((task): task is ModuleBoardTaskRef => task !== null);
}

function mapCard(
  card: PersistedCard,
  userById: Map<string, { _id: unknown; name?: string; email?: string; image?: string | null }>,
): ModuleBoardCardDTO {
  return {
    id: card.id,
    title: card.title,
    note: card.note,
    status: card.status,
    updatedBy: toUserRef(card.updatedBy, userById),
    updatedAt: toIso(card.updatedAt),
  };
}

function mapStructuredRow(
  row: PersistedStructuredRow,
  userById: Map<string, { _id: unknown; name?: string; email?: string; image?: string | null }>,
  taskById: Map<string, { _id: unknown; title: string; projectId: unknown }>,
  projectById: Map<string, { _id: unknown; name: string }>,
  workspaceSlug: string,
): ModuleBoardStructuredRowDTO {
  return {
    id: row.id,
    title: row.title,
    owner: toUserRef(row.ownerUserId, userById),
    status: row.status,
    note: row.note,
    linkedTasks: resolveTaskLinks(row.taskIds, taskById, projectById, workspaceSlug),
    externalUrls: row.externalUrls.map((link) => ({ ...link })),
    updatedBy: toUserRef(row.updatedBy, userById),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapModuleRow(
  row: PersistedModuleRow,
  userById: Map<string, { _id: unknown; name?: string; email?: string; image?: string | null }>,
  taskById: Map<string, { _id: unknown; title: string; projectId: unknown }>,
  projectById: Map<string, { _id: unknown; name: string }>,
  workspaceSlug: string,
): ModuleBoardModuleDTO {
  return {
    id: row.id,
    moduleKey: row.moduleKey,
    title: row.title,
    owner: toUserRef(row.ownerUserId, userById),
    validator: toUserRef(row.validatorUserId, userById),
    status: row.status,
    summary: row.summary,
    whatClosesIt: row.whatClosesIt,
    verificationSummary: row.verificationSummary,
    validatingReason: row.validatingReason,
    blockerReason: row.blockerReason,
    linkedTasks: resolveTaskLinks(row.taskIds, taskById, projectById, workspaceSlug),
    prUrls: row.prUrls.map((link) => ({ ...link })),
    proofBundles: row.proofBundles.map((bundle) => ({
      id: bundle.id,
      status: bundle.status,
      whatVerified: bundle.whatVerified,
      proof: bundle.proof,
      taskLinks: resolveTaskLinks(bundle.taskIds, taskById, projectById, workspaceSlug),
      externalUrls: bundle.externalUrls.map((link) => ({ ...link })),
      evidenceLinks: bundle.evidenceLinks.map((link) => ({ ...link })),
      updatedBy: toUserRef(bundle.updatedBy, userById),
      updatedAt: toIso(bundle.updatedAt),
    })),
    updatedBy: toUserRef(row.updatedBy, userById),
    updatedAt: toIso(row.updatedAt),
    warnings: getModuleBoardWarnings({
      status: row.status,
      ownerUserId: row.ownerUserId ? String(row.ownerUserId) : null,
      validatorUserId: row.validatorUserId ? String(row.validatorUserId) : null,
      verificationSummary: row.verificationSummary,
      validatingReason: row.validatingReason,
      blockerReason: row.blockerReason,
      proofBundles: row.proofBundles.map((bundle) => ({
        status: bundle.status,
        whatVerified: bundle.whatVerified,
        proof: bundle.proof,
        taskIds: bundle.taskIds?.map(String) ?? [],
        externalUrls: bundle.externalUrls,
        evidenceLinks: bundle.evidenceLinks,
      })),
    }),
  };
}

export async function getModuleBoard(
  workspaceId: string,
  workspaceSlug: string,
  seedUserId: string,
): Promise<ModuleBoardDTO> {
  const boardDoc = await ensureBoard(workspaceId, seedUserId);
  const board = boardDoc.toObject() as unknown as ModuleBoardPersisted;

  const userIds = new Set<string>();
  const taskIds = new Set<string>();

  const collectTaskIds = (ids?: unknown[]) => {
    for (const id of ids ?? []) taskIds.add(String(id));
  };

  const collectUpdatedBy = (updatedBy: unknown | null | undefined) => {
    if (updatedBy) userIds.add(String(updatedBy));
  };

  collectUpdatedBy(board.lastUpdatedBy);

  for (const card of [...board.finishLines, ...board.masterGate, ...board.scopeHolds]) {
    collectUpdatedBy(card.updatedBy);
  }

  for (const row of [
    ...board.pilotRoadmap,
    ...board.openItems,
    ...board.outreachPipeline,
    ...board.spendDiscipline,
    ...board.loadFlags,
  ]) {
    if (row.ownerUserId) userIds.add(String(row.ownerUserId));
    collectUpdatedBy(row.updatedBy);
    collectTaskIds(row.taskIds);
  }

  for (const row of board.modules) {
    if (row.ownerUserId) userIds.add(String(row.ownerUserId));
    if (row.validatorUserId) userIds.add(String(row.validatorUserId));
    collectUpdatedBy(row.updatedBy);
    collectTaskIds(row.taskIds);
    for (const bundle of row.proofBundles) {
      collectUpdatedBy(bundle.updatedBy);
      collectTaskIds(bundle.taskIds);
    }
  }

  const workspaceObjectId = parseObjectIdOrThrow(workspaceId);
  const taskObjectIds = [...taskIds].map((taskId) => parseObjectIdOrThrow(taskId));

  const [users, tasks] = await Promise.all([
    userIds.size
      ? User.find({ _id: { $in: [...userIds].map((userId) => parseObjectIdOrThrow(userId)) } })
          .select("name email image")
          .lean()
      : [],
    taskObjectIds.length
      ? Task.find({
          _id: { $in: taskObjectIds },
          workspaceId: workspaceObjectId,
          isArchived: false,
        })
          .select("title projectId")
          .lean()
      : [],
  ]);

  const projectIds = [...new Set(tasks.map((task) => String(task.projectId)))];
  const projects = projectIds.length
    ? await Project.find({
        _id: { $in: projectIds.map((projectId) => parseObjectIdOrThrow(projectId)) },
        workspaceId: workspaceObjectId,
        archivedAt: null,
      })
        .select("name")
        .lean()
    : [];

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const taskById = new Map(tasks.map((task) => [String(task._id), task]));
  const projectById = new Map(projects.map((project) => [String(project._id), project]));

  return {
    id: String(board._id),
    workspaceId: String(board.workspaceId),
    finishLines: board.finishLines.map((card) => mapCard(card, userById)),
    masterGate: board.masterGate.map((card) => mapCard(card, userById)),
    modules: board.modules.map((row) =>
      mapModuleRow(row, userById, taskById, projectById, workspaceSlug),
    ),
    pilotRoadmap: board.pilotRoadmap.map((row) =>
      mapStructuredRow(row, userById, taskById, projectById, workspaceSlug),
    ),
    openItems: board.openItems.map((row) =>
      mapStructuredRow(row, userById, taskById, projectById, workspaceSlug),
    ),
    outreachPipeline: board.outreachPipeline.map((row) =>
      mapStructuredRow(row, userById, taskById, projectById, workspaceSlug),
    ),
    spendDiscipline: board.spendDiscipline.map((row) =>
      mapStructuredRow(row, userById, taskById, projectById, workspaceSlug),
    ),
    loadFlags: board.loadFlags.map((row) =>
      mapStructuredRow(row, userById, taskById, projectById, workspaceSlug),
    ),
    scopeHolds: board.scopeHolds.map((card) => mapCard(card, userById)),
    lastUpdatedBy: toUserRef(board.lastUpdatedBy, userById),
    lastUpdatedAt: toIso(board.updatedAt),
    sundayWarningCount: countSundayWarnings(
      board.modules
        .filter((row) => isPatentModuleKey(row.moduleKey))
        .map((row) => ({
          status: row.status,
          ownerUserId: row.ownerUserId ? String(row.ownerUserId) : null,
          validatorUserId: row.validatorUserId ? String(row.validatorUserId) : null,
          verificationSummary: row.verificationSummary,
          validatingReason: row.validatingReason,
          blockerReason: row.blockerReason,
          proofBundles: row.proofBundles.map((bundle) => ({
            status: bundle.status,
            whatVerified: bundle.whatVerified,
            proof: bundle.proof,
            taskIds: bundle.taskIds?.map(String) ?? [],
            externalUrls: bundle.externalUrls,
            evidenceLinks: bundle.evidenceLinks,
          })),
        })),
    ),
  };
}
