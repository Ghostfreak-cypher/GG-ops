import { z } from "zod";
import { TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES } from "@/modules/task/constants";
import { getUserWorkspaces, listMembers } from "@/modules/workspace/server/queries";
import { getProjectBoard, getTaskDetail, searchTasks } from "@/modules/task/server/queries";
import { getMyTasks } from "@/modules/dashboard/server/queries";
import { listComments } from "@/modules/comment/server/queries";
import { createTaskAction } from "@/modules/task/server/actions/create-task";
import { createProjectFor } from "@/modules/project/server/create-project-core";
import { absoluteUrl } from "@/lib/urls";
import { updateTaskAction } from "@/modules/task/server/actions/update-task";
import { createCommentAction } from "@/modules/comment/server/actions/create-comment";
import { upsertDsrFor, todayKey } from "@/modules/dsr/server/upsert";
import { getMyDsrForDate } from "@/modules/dsr/server/queries";
import { DRAFT_STATUSES } from "@/modules/task-draft/constants";
import { createDraftFor } from "@/modules/task-draft/server/create";
import { listDrafts } from "@/modules/task-draft/server/queries";
import {
  resolveWorkspace,
  resolveProject,
  resolveMembers,
  resolveLabels,
} from "@/modules/mcp/resolve";
import { defineTool, type McpTool } from "@/modules/mcp/tools/types";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/api/handler";

/**
 * The MCP tool registry.
 *
 * Two rules hold across every tool here:
 *
 * 1. **No tool accepts a `workspaceId`.** Agents pass names; `resolveWorkspace` turns them
 *    into ids, and because it only ever resolves workspaces the caller is an ACTIVE member
 *    of, resolution *is* the authorization boundary for the caller-must-check queries
 *    (`listProjects`, `listMembers`, `searchTasks`, `getMyTasks`, `listLabels`).
 *    `schema.test.ts` fails the build if a `workspaceId` property appears.
 *
 * 2. **Dates are ISO strings, never `z.coerce.date()`.** A coerced Date cannot be rendered
 *    into JSON Schema and would take down `tools/list` for the entire server. The strings
 *    are handed to the underlying Zod validators, which do the coercion server-side.
 */

/** Model-facing cap on list results — an unbounded board floods the context window. */
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const limitArg = z
  .number()
  .int()
  .min(1)
  .max(MAX_LIMIT)
  .optional()
  .describe(`Maximum results to return (default ${DEFAULT_LIMIT}).`);

const workspaceArg = z
  .string()
  .min(1)
  .describe("Workspace name or slug, e.g. \"Acme Corp\" or \"acme-corp\". Call list_workspaces if unsure.");

const isoDateArg = z
  .string()
  .describe("Date as an ISO 8601 string, e.g. \"2026-03-01\" or \"2026-03-01T17:00:00Z\".");

/** Trim a list and tell the model plainly that it was trimmed. */
function truncate<T>(items: T[], limit = DEFAULT_LIMIT) {
  const effective = Math.min(limit, MAX_LIMIT);
  if (items.length <= effective) return { items, note: undefined };
  return {
    items: items.slice(0, effective),
    note: `Showing ${effective} of ${items.length} results. Narrow your query or raise \`limit\` to see more.`,
  };
}

function listResult<T>(items: T[], limit: number | undefined, key: string) {
  const { items: shown, note } = truncate(items, limit ?? DEFAULT_LIMIT);
  return note ? { [key]: shown, note } : { [key]: shown };
}

/**
 * Turn an `ActionResult` into either its payload or an `AppError`.
 * `protocol.ts` renders a thrown AppError as an `isError` tool result, which is where the
 * model can actually read and react to it.
 */
function unwrap<T>(result: ActionResult<T>, fallback: string): T | null {
  if (!result.ok) throw new AppError(result.error, 400);
  return result.data ?? (fallback as unknown as T | null);
}

// ── Read tools ──────────────────────────────────────────────────────────────────

const listWorkspaces = defineTool({
  name: "list_workspaces",
  title: "List workspaces",
  description:
    "List every GGOps workspace you belong to, with its name, slug, and your role. " +
    "Call this first when you don't yet know which workspace to work in — most other " +
    "tools take a `workspace` argument, and the name or slug returned here is what they expect.",
  inputSchema: z.object({}),
  scope: "read",
  handler: async (_args, { user }) => {
    const workspaces = await getUserWorkspaces(user.id);
    if (workspaces.length === 0) return "You are not a member of any workspace yet.";
    return workspaces;
  },
});

const listProjectsTool = defineTool({
  name: "list_projects",
  title: "List projects",
  description:
    "List the active (non-archived) projects in a workspace. Use this to discover the " +
    "exact project name to pass to get_project_board, create_task, or search_tasks.",
  inputSchema: z.object({ workspace: workspaceArg, limit: limitArg }),
  scope: "read",
  handler: async ({ workspace, limit }, { user }) => {
    const ws = await resolveWorkspace(user.id, workspace);
    const { listProjects } = await import("@/modules/project/server/queries");
    const projects = await listProjects(ws.id);
    if (projects.length === 0) return `${ws.name} has no projects yet.`;
    return listResult(projects, limit, "projects");
  },
});

const listMembersTool = defineTool({
  name: "list_members",
  title: "List workspace members",
  description:
    "List the people in a workspace with their email and role. Use this to find the exact " +
    "name or email to pass as an assignee. Only ACTIVE members can be assigned work.",
  inputSchema: z.object({ workspace: workspaceArg, limit: limitArg }),
  scope: "read",
  handler: async ({ workspace, limit }, { user }) => {
    const ws = await resolveWorkspace(user.id, workspace);
    const members = (await listMembers(ws.id)).map((m) => ({
      name: m.name,
      email: m.email || null,
      role: m.role,
      status: m.status,
    }));
    return listResult(members, limit, "members");
  },
});

const searchTasksTool = defineTool({
  name: "search_tasks",
  title: "Search tasks",
  description:
    "Full-text search across a workspace's task titles and descriptions. Requires at least " +
    "2 characters. Use this to find a task before reading or updating it — the `id` in each " +
    "result is what get_task, update_task, complete_task, and comment_on_task expect.",
  inputSchema: z.object({
    workspace: workspaceArg,
    query: z.string().min(2).describe("Search text. At least 2 characters."),
    project: z.string().optional().describe("Optional project name to narrow the search."),
    limit: limitArg,
  }),
  scope: "read",
  handler: async ({ workspace, query, project, limit }, { user }) => {
    const ws = await resolveWorkspace(user.id, workspace);
    const projectId = project ? (await resolveProject(ws, project)).id : undefined;
    const results = await searchTasks(ws.id, query, projectId);
    if (results.length === 0) return `No tasks in ${ws.name} match "${query}".`;
    return listResult(results, limit, "tasks");
  },
});

const listMyTasks = defineTool({
  name: "list_my_tasks",
  title: "List my tasks",
  description:
    "List the tasks assigned to you in a workspace, soonest due date first. Use this to " +
    "answer questions about your own workload or what is overdue.",
  inputSchema: z.object({ workspace: workspaceArg, limit: limitArg }),
  scope: "read",
  handler: async ({ workspace, limit }, { user }) => {
    const ws = await resolveWorkspace(user.id, workspace);
    const tasks = await getMyTasks(ws.id, user.id);
    if (tasks.length === 0) return `You have no tasks assigned in ${ws.name}.`;
    return listResult(tasks, limit, "tasks");
  },
});

const getProjectBoardTool = defineTool({
  name: "get_project_board",
  title: "Get project board",
  description:
    "Get a project's full board: every section with its tasks, plus unsectioned tasks. " +
    "Use this for an overview of a project's state. For one specific task, prefer get_task.",
  inputSchema: z.object({ workspace: workspaceArg, project: z.string().min(1).describe("Project name.") }),
  scope: "read",
  handler: async ({ workspace, project }, { user }) => {
    const ws = await resolveWorkspace(user.id, workspace);
    const resolved = await resolveProject(ws, project);
    const board = await getProjectBoard(resolved.id, user.id);
    if (!board) throw new AppError(`Could not open the "${resolved.name}" board.`, 404);
    return board;
  },
});

const getTask = defineTool({
  name: "get_task",
  title: "Get task detail",
  description:
    "Get one task in full — description, status, priority, assignees, labels, subtasks, and " +
    "its comment thread. Pass the task id from search_tasks, list_my_tasks, or a board.",
  inputSchema: z.object({
    task_id: z.string().describe("Task id, as returned by search_tasks or a board."),
  }),
  scope: "read",
  handler: async ({ task_id }, { user }) => {
    // Detail first: it self-checks access and tells us whether the task is even visible.
    const task = await getTaskDetail(task_id, user.id);
    if (!task) throw new AppError("Task not found, or you don't have access to it.", 404);
    const comments = await listComments(task_id, user.id);
    return { ...task, comments };
  },
});

// ── Write tools ─────────────────────────────────────────────────────────────────

const createProject = defineTool({
  name: "create_project",
  title: "Create a project",
  description:
    "Create a new project in a workspace, e.g. before splitting a piece of work into tasks. " +
    "Returns the project's exact name, which is what create_task's `project` expects. " +
    "Check list_projects first so you don't create a duplicate.",
  inputSchema: z.object({
    workspace: workspaceArg,
    name: z.string().min(1).max(80).describe("Project name, unique enough to pass to create_task."),
    description: z.string().max(500).optional().describe("One or two sentences on what the project is."),
  }),
  scope: "write",
  handler: async ({ workspace, name, description }, { user }) => {
    const ws = await resolveWorkspace(user.id, workspace);
    const created = unwrap(await createProjectFor(ws, user.id, { name, description }), "created");
    const id = (created as { id: string }).id;
    return {
      created: true,
      projectId: id,
      project: (created as { name: string }).name,
      workspace: ws.name,
      url: absoluteUrl(`/w/${ws.slug}/projects/${id}`),
    };
  },
});

const createTask = defineTool({
  name: "create_task",
  title: "Create a task",
  description:
    "Create a task in a project. Only `workspace`, `project`, and `title` are required. " +
    "Assignees are given as names or email addresses and labels as label names — never ids; " +
    "if one is ambiguous the error will list the candidates so you can retry.",
  inputSchema: z.object({
    workspace: workspaceArg,
    project: z.string().min(1).describe("Project name to create the task in."),
    title: z.string().min(1).max(300).describe("Short imperative summary of the work."),
    description: z.string().optional().describe("Longer detail. Plain text or simple HTML."),
    status: z.enum(TASK_STATUSES).optional().describe("Defaults to TODO."),
    priority: z.enum(TASK_PRIORITIES).optional().describe("Defaults to MEDIUM."),
    type: z.enum(TASK_TYPES).optional().describe("Defaults to TASK."),
    due_date: isoDateArg.optional(),
    assignees: z
      .array(z.string())
      .optional()
      .describe("People to assign, by name or email. Must be ACTIVE workspace members."),
    labels: z.array(z.string()).optional().describe("Existing label names. Labels are not created."),
  }),
  scope: "write",
  handler: async (args, { user }) => {
    const ws = await resolveWorkspace(user.id, args.workspace);
    const project = await resolveProject(ws, args.project);
    const assigneeIds = await resolveMembers(ws, args.assignees ?? []);
    const labelIds = await resolveLabels(ws, args.labels ?? []);

    const result = await createTaskAction(project.id, {
      title: args.title,
      description: args.description,
      status: args.status,
      priority: args.priority,
      type: args.type,
      dueDate: args.due_date,
      assigneeIds,
      labelIds,
    });

    const created = unwrap(result, "created");
    return {
      created: true,
      taskId: (created as { id?: string })?.id ?? null,
      project: project.name,
      workspace: ws.name,
      title: args.title,
    };
  },
});

const updateTask = defineTool({
  name: "update_task",
  title: "Update a task",
  description:
    "Change fields on an existing task. Only the fields you pass are modified; everything " +
    "else is left alone. Pass `assignees` to replace the assignee list, or `labels` to " +
    "replace the labels. To mark a task done, prefer complete_task.",
  inputSchema: z.object({
    task_id: z.string().describe("Task id, as returned by search_tasks or a board."),
    workspace: workspaceArg
      .optional()
      .describe("Only needed when passing `assignees` or `labels`, so names can be resolved."),
    title: z.string().min(1).max(300).optional(),
    description: z.string().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    type: z.enum(TASK_TYPES).optional(),
    due_date: isoDateArg.nullable().optional().describe("Pass null to clear the due date."),
    assignees: z.array(z.string()).optional().describe("Replaces the assignees. Names or emails."),
    labels: z.array(z.string()).optional().describe("Replaces the labels. Label names."),
  }),
  scope: "write",
  handler: async (args, { user }) => {
    const needsWorkspace = args.assignees !== undefined || args.labels !== undefined;
    if (needsWorkspace && !args.workspace) {
      throw new AppError(
        "Pass `workspace` when setting assignees or labels, so their names can be resolved.",
        400,
      );
    }

    const ws = args.workspace ? await resolveWorkspace(user.id, args.workspace) : null;
    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch.title = args.title;
    if (args.description !== undefined) patch.description = args.description;
    if (args.status !== undefined) patch.status = args.status;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.type !== undefined) patch.type = args.type;
    if (args.due_date !== undefined) patch.dueDate = args.due_date;
    if (args.assignees !== undefined) patch.assigneeIds = await resolveMembers(ws!, args.assignees);
    if (args.labels !== undefined) patch.labelIds = await resolveLabels(ws!, args.labels);

    if (Object.keys(patch).length === 0) {
      throw new AppError("Nothing to update — pass at least one field to change.", 400);
    }

    unwrap(await updateTaskAction(args.task_id, patch), "updated");
    return { updated: true, taskId: args.task_id, changed: Object.keys(patch) };
  },
});

const completeTask = defineTool({
  name: "complete_task",
  title: "Complete a task",
  description: "Mark a task as DONE. A convenience wrapper around update_task.",
  inputSchema: z.object({ task_id: z.string().describe("Task id to mark done.") }),
  scope: "write",
  handler: async ({ task_id }) => {
    unwrap(await updateTaskAction(task_id, { status: "DONE" }), "completed");
    return { completed: true, taskId: task_id };
  },
});

const commentOnTask = defineTool({
  name: "comment_on_task",
  title: "Comment on a task",
  description:
    "Add a comment to a task's thread, optionally as a reply to an existing comment. " +
    "The comment is posted as you.",
  inputSchema: z.object({
    task_id: z.string().describe("Task id to comment on."),
    body: z.string().min(1).max(5000).describe("Comment text. Plain text or simple HTML."),
    reply_to_comment_id: z
      .string()
      .optional()
      .describe("Id of the comment being replied to. Threads are one level deep."),
  }),
  scope: "write",
  handler: async ({ task_id, body, reply_to_comment_id }) => {
    unwrap(
      await createCommentAction(task_id, {
        body,
        ...(reply_to_comment_id ? { parentCommentId: reply_to_comment_id } : {}),
      }),
      "posted",
    );
    // createCommentAction deliberately returns no payload; re-read via get_task for the id.
    return { posted: true, taskId: task_id };
  },
});

// ── Daily Status Report ─────────────────────────────────────────────────────────

/**
 * Both DSR tools read and write **only the caller's own** reports. Neither takes a user
 * argument — the author is always the authenticated caller, so a connector can never reach
 * someone else's report. Reading the whole team stays a web-only view, for admins and the
 * maintainer.
 */
const dsrDateArg = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .describe("The day this report covers, as YYYY-MM-DD. Omit for today. Cannot be in the future.");

const submitDsr = defineTool({
  name: "submit_dsr",
  title: "File my daily status report",
  description:
    "File or amend your own Daily Status Report for one day: what you worked on, how long " +
    "each item took, and what you plan to do tomorrow. An entry can optionally reference the " +
    "task it was work on. Re-filing a date replaces that day's report entirely, so when " +
    "amending, call get_dsr first and resend the existing entries alongside the new ones.",
  inputSchema: z.object({
    workspace: workspaceArg,
    date: dsrDateArg,
    entries: z
      .array(
        z.object({
          task: z.string().min(1).max(500).describe("One thing you did, in a short sentence."),
          minutes: z
            .number()
            .int()
            .min(1)
            .max(1440)
            .describe("Whole minutes spent on it, e.g. 90 for an hour and a half."),
          task_id: z
            .string()
            .optional()
            .describe(
              "Optional. The GGOps task this work was on — an `id` from search_tasks, " +
                "list_my_tasks, or a board, and it must be a task in this same workspace. " +
                "This only links the entry to the task for reading later; it does NOT change " +
                "the task's status. To close the task as well, call complete_task separately.",
            ),
        }),
      )
      .min(1)
      .max(20)
      .describe("One row per thing done. The total is derived server-side — never send it."),
    tomorrow_plan: z.string().min(1).max(4000).describe("What you'll work on tomorrow."),
  }),
  scope: "write",
  handler: async (args, { user }) => {
    const ws = await resolveWorkspace(user.id, args.workspace);
    // ponytail: server-local date, the same one the web form uses. For a UTC host and an IST
    // user that means between 00:00 and 05:30 IST "today" is still yesterday's key. Fixing it
    // properly means storing a per-user timezone, which would change the existing UI too —
    // until then, an explicit `date` overrides it.
    const result = await upsertDsrFor(
      { workspaceId: ws.id, userId: user.id, userName: user.name, role: ws.role },
      {
        date: args.date ?? todayKey(),
        // snake_case in, camelCase on: the tool surface matches the other task tools'
        // `task_id`, the stored entry matches the rest of the codebase.
        entries: args.entries.map((entry) => ({
          task: entry.task,
          minutes: entry.minutes,
          taskId: entry.task_id ?? null,
        })),
        tomorrowPlan: args.tomorrow_plan,
      },
    );
    return unwrap(result, "filed");
  },
});

const getDsr = defineTool({
  name: "get_dsr",
  title: "Read my daily status report",
  description:
    "Read back your own Daily Status Report for one day, or null if you haven't filed one. " +
    "Call this before amending a report so the existing content can be resent with the changes — " +
    "each entry's `taskId` is what to send back as `task_id` to keep a link intact.",
  inputSchema: z.object({ workspace: workspaceArg, date: dsrDateArg }),
  scope: "read",
  handler: async (args, { user }) => {
    const ws = await resolveWorkspace(user.id, args.workspace);
    const date = args.date ?? todayKey();
    const report = await getMyDsrForDate(ws.id, user.id, date);
    return report ?? `No report filed for ${date}.`;
  },
});

// ── Task drafts ─────────────────────────────────────────────────────────────────

/**
 * The approval gate is structural, not a policy an agent could talk its way around: there
 * is deliberately no `approve_task_draft` tool anywhere in this registry. A fully successful
 * prompt injection in a meeting note buys an attacker-chosen draft, in a workspace the
 * caller already belongs to, that a human must still read and approve — not a real task.
 */
const createTaskDraft = defineTool({
  name: "create_task_draft",
  title: "Create a task draft",
  description:
    "Suggest a task for a human to review — this never creates a real task. Use it instead " +
    "of create_task whenever the task comes from inferring intent (meeting notes, email, " +
    "any unreviewed source) rather than a direct instruction. A person edits and approves " +
    "drafts before they become real tasks, so include the excerpt that justifies the " +
    "suggestion — that's what the reviewer judges it by.",
  inputSchema: z.object({
    workspace: workspaceArg,
    project: z
      .string()
      .optional()
      .describe("Project name, only if you're confident which one. Omit if unsure — the reviewer picks one."),
    title: z.string().min(1).max(300).describe("Short imperative summary of the work."),
    description: z.string().optional().describe("Longer detail on what the task involves."),
    priority: z.enum(TASK_PRIORITIES).optional().describe("Defaults to MEDIUM."),
    due_date: isoDateArg.optional(),
    assignees: z
      .array(z.string())
      .optional()
      .describe("Suggested assignees, by name or email. Must be ACTIVE workspace members."),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Your confidence this is a real actionable item, 0 to 1."),
    meeting_id: z
      .string()
      .optional()
      .describe("An id identifying the source meeting. Pass this so list_task_drafts can dedupe across runs."),
    meeting_title: z.string().optional().describe("The meeting's title, shown to the reviewer."),
    meeting_date: isoDateArg.optional().describe("The meeting's date."),
    source_excerpt: z
      .string()
      .optional()
      .describe("The quote from the meeting that justifies this task — required context for the reviewer."),
  }),
  scope: "write",
  handler: async (args, { user }) => {
    const ws = await resolveWorkspace(user.id, args.workspace);
    const project = args.project ? await resolveProject(ws, args.project) : null;
    const assigneeIds = await resolveMembers(ws, args.assignees ?? []);

    const result = await createDraftFor(
      { workspaceId: ws.id, userId: user.id, userName: user.name, role: ws.role },
      {
        projectId: project?.id,
        title: args.title,
        description: args.description,
        priority: args.priority,
        dueDate: args.due_date,
        assigneeIds,
        confidence: args.confidence,
        sourceMeetingId: args.meeting_id,
        sourceMeetingTitle: args.meeting_title,
        sourceMeetingDate: args.meeting_date,
        sourceExcerpt: args.source_excerpt,
      },
    );

    const created = unwrap(result, "drafted");
    return {
      drafted: true,
      draftId: (created as { id?: string })?.id ?? null,
      workspace: ws.name,
      project: project?.name ?? null,
      title: args.title,
      note: "Awaiting human review — no task was created.",
    };
  },
});

const listTaskDrafts = defineTool({
  name: "list_task_drafts",
  title: "List task drafts",
  description:
    "List task drafts in a workspace, most recent first. Call with meeting_id before " +
    "create_task_draft to avoid drafting the same meeting twice — any match, regardless of " +
    "status, means that meeting has already been processed.",
  inputSchema: z.object({
    workspace: workspaceArg,
    status: z.enum(DRAFT_STATUSES).optional().describe("Defaults to PENDING. Omit the status filter entirely by also passing meeting_id."),
    meeting_id: z.string().optional().describe("Filter to drafts from one source meeting."),
    limit: limitArg,
  }),
  scope: "read",
  handler: async ({ workspace, status, meeting_id, limit }, { user }) => {
    const ws = await resolveWorkspace(user.id, workspace);
    const drafts = await listDrafts(ws.id, {
      status: status ?? (meeting_id ? undefined : "PENDING"),
      sourceMeetingId: meeting_id,
      limit,
    });
    if (drafts.length === 0) return `No drafts found in ${ws.name}.`;
    return listResult(drafts, limit, "drafts");
  },
});

export const MCP_TOOLS: readonly McpTool[] = [
  listWorkspaces,
  listProjectsTool,
  listMembersTool,
  searchTasksTool,
  listMyTasks,
  getProjectBoardTool,
  getTask,
  createProject,
  createTask,
  updateTask,
  completeTask,
  commentOnTask,
  submitDsr,
  getDsr,
  createTaskDraft,
  listTaskDrafts,
];

export const TOOLS_BY_NAME: ReadonlyMap<string, McpTool> = new Map(
  MCP_TOOLS.map((tool) => [tool.name, tool]),
);
