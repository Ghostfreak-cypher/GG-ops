import type { z } from "zod";
import { issuerUrl } from "@/lib/urls";
import { toComponentSchema } from "@/modules/api-docs/json-schema";
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from "@/modules/task/schemas";
import { createCommentSchema } from "@/modules/comment/schemas";
import {
  currentUserSchema,
  boardSummarySchema,
  workspaceSummarySchema,
  memberDtoSchema,
  projectSummarySchema,
  taskSearchResultSchema,
  myTaskDtoSchema,
  taskDetailDtoSchema,
  boardDataSchema,
  commentDtoSchema,
} from "@/modules/api-docs/wire-schemas";

/**
 * OpenAPI 3.1 document for `/api/v1`, generated from the same Zod schemas the routes
 * validate with. Built once at module load — the shapes are static, so there is no reason
 * to pay for this per request.
 *
 * Source of truth is Docs/API-V1-CONTRACT.md. Request bodies are derived from the real
 * validators; response shapes are mirrored in `wire-schemas.ts` (see the note there).
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

/** `{ ok: true, data: <schema> }` — the success half of the app-wide envelope. */
function okEnvelope(dataSchema: object) {
  return {
    type: "object",
    required: ["ok", "data"],
    properties: { ok: { const: true }, data: dataSchema },
  };
}

function jsonContent(schema: object) {
  return { "application/json": { schema } };
}

function okResponse(description: string, dataSchema: object) {
  return { description, content: jsonContent(okEnvelope(dataSchema)) };
}

const errorResponse = (description: string) => ({
  description,
  content: jsonContent(ref("ApiError")),
});

/** Every authenticated route shares these. 401 additionally carries WWW-Authenticate. */
const commonErrors = {
  "401": {
    description:
      "Missing or invalid credentials. Carries `WWW-Authenticate: Bearer realm=\"ggops\", resource_metadata=\"...\"`, which points an OAuth-capable client at the protected-resource discovery document.",
    content: jsonContent(ref("ApiError")),
    headers: {
      "WWW-Authenticate": { schema: { type: "string" }, description: "RFC 9728 challenge" },
    },
  },
  "403": errorResponse("The API key lacks the `write` scope (any non-GET request)."),
  "429": errorResponse("Rate limit exceeded (600 requests/hour per API key)."),
  "500": errorResponse("Unhandled server error."),
};

const writeErrors = {
  "400": errorResponse("Validation failed, or the action rejected the request."),
  ...commonErrors,
};

const slugParam = {
  name: "slug",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Workspace slug. Never a raw workspaceId — the server resolves the slug and verifies membership.",
};

const taskIdParam = {
  name: "taskId",
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
};

const projectIdParam = {
  name: "projectId",
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
};

function body(schema: z.ZodType, description?: string) {
  return {
    required: true,
    description,
    content: jsonContent(toComponentSchema(schema)),
  };
}

export function buildOpenApiSpec(): Record<string, unknown> {
  const issuer = issuerUrl();

  return {
    openapi: "3.1.0",
    info: {
      title: "GGOps API",
      version: "1.0.0",
      description: [
        "REST surface for AI agents and integrations.",
        "",
        "**Envelope** — every response is `{ ok: true, data }` or `{ ok: false, error: string }`. There are no bare arrays or objects at the top level, and errors are plain strings with no code enum.",
        "",
        "**Auth** — send a GGOps API key as `Authorization: Bearer ggops_sk_...`. Mint one at `/account/api-keys`. GET requires the `read` scope; POST/PATCH/DELETE require `write`. OAuth 2.1 (including dynamic client registration) is also supported — see the `.well-known` discovery documents.",
        "",
        "**Dates** — always ISO 8601 strings or `null`, in both directions.",
        "",
        "**Pagination** — none. Every list route is bounded by construction (search caps at 25; member/project counts are small at this scale).",
      ].join("\n"),
      // SPDX custom-reference form — OpenAPI 3.1 wants `identifier` to be an SPDX
      // expression, and there is no standard id for "not open source".
      license: { name: "Proprietary", identifier: "LicenseRef-Proprietary" },
    },
    servers: [{ url: issuer, description: "This deployment" }],
    tags: [
      { name: "Account", description: "The account behind the credential" },
      { name: "Workspaces", description: "Workspaces, their projects, members, and search" },
      { name: "Tasks", description: "Task boards, detail, mutation, and reordering" },
      { name: "Comments", description: "Task comment threads" },
    ],
    // Either credential works on every route: an OAuth access token IS an ApiKey row
    // (kind: "OAUTH"), so the same bearer-lookup path serves both. Listing both here as
    // alternatives is the accurate description, not just decoration.
    security: [{ bearerAuth: [] }, { oauth2: ["read", "write"] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "A GGOps API key (`ggops_sk_...`) or an OAuth 2.1 access token. Keys are shown once at creation and stored only as a SHA-256 hash.",
        },
        oauth2: {
          type: "oauth2",
          description:
            "OAuth 2.1 with PKCE and dynamic client registration (RFC 7591). Discovery: /.well-known/oauth-authorization-server",
          flows: {
            authorizationCode: {
              authorizationUrl: `${issuer}/oauth/authorize`,
              tokenUrl: `${issuer}/oauth/token`,
              refreshUrl: `${issuer}/oauth/token`,
              scopes: { read: "Read workspaces, projects, tasks, and comments", write: "Create and modify tasks and comments" },
            },
          },
        },
      },
      schemas: {
        ApiError: {
          type: "object",
          required: ["ok", "error"],
          properties: { ok: { const: false }, error: { type: "string" } },
          description: "The failure half of the response envelope.",
        },
        CurrentUser: toComponentSchema(currentUserSchema),
        WorkspaceSummary: toComponentSchema(workspaceSummarySchema),
        MemberDTO: toComponentSchema(memberDtoSchema),
        ProjectSummary: toComponentSchema(projectSummarySchema),
        TaskSearchResult: toComponentSchema(taskSearchResultSchema),
        MyTaskDTO: toComponentSchema(myTaskDtoSchema),
        // No standalone `TaskDTO` component: Zod's JSON Schema emitter inlines nested
        // schemas, so the task shape is already spelled out in full inside BoardData
        // (sections[].tasks, unsectioned[]) and TaskDetailDTO (subtasks[]). Registering it
        // separately would add a named schema nothing $refs — dead weight that codegen
        // would emit as an unused type.
        TaskDetailDTO: toComponentSchema(taskDetailDtoSchema),
        BoardData: toComponentSchema(boardDataSchema),
        BoardSummary: toComponentSchema(boardSummarySchema),
        CommentDTO: toComponentSchema(commentDtoSchema),
      },
    },
    paths: {
      "/api/v1/me": {
        get: {
          tags: ["Account"],
          operationId: "getCurrentUser",
          summary: "Get the caller's account",
          description: "The user this API key or OAuth token acts as.",
          responses: {
            "200": okResponse("The caller.", ref("CurrentUser")),
            ...commonErrors,
          },
        },
      },
      "/api/v1/workspaces": {
        get: {
          tags: ["Workspaces"],
          operationId: "listWorkspaces",
          summary: "List the caller's workspaces",
          description: "Scoped to the caller by construction — only workspaces where they are an ACTIVE member.",
          responses: {
            "200": okResponse("The caller's workspaces.", { type: "array", items: ref("WorkspaceSummary") }),
            ...commonErrors,
          },
        },
      },
      "/api/v1/workspaces/{slug}/projects": {
        get: {
          tags: ["Workspaces"],
          operationId: "listProjects",
          summary: "List a workspace's projects",
          parameters: [slugParam],
          responses: {
            "200": okResponse("Non-archived projects, sorted by name.", { type: "array", items: ref("ProjectSummary") }),
            "404": errorResponse("No such workspace, or the caller is not a member. The two are deliberately indistinguishable."),
            ...commonErrors,
          },
        },
      },
      "/api/v1/workspaces/{slug}/members": {
        get: {
          tags: ["Workspaces"],
          operationId: "listMembers",
          summary: "List a workspace's members",
          description: "Includes INVITED members; excludes REMOVED.",
          parameters: [slugParam],
          responses: {
            "200": okResponse("Workspace members.", { type: "array", items: ref("MemberDTO") }),
            "404": errorResponse("No such workspace, or the caller is not a member."),
            ...commonErrors,
          },
        },
      },
      "/api/v1/workspaces/{slug}/tasks": {
        get: {
          tags: ["Workspaces"],
          operationId: "searchTasks",
          summary: "Full-text search tasks in a workspace",
          description: "Returns `[]` for queries shorter than 2 characters. Capped at 25 results.",
          parameters: [
            slugParam,
            { name: "q", in: "query", required: true, schema: { type: "string", minLength: 2 }, description: "Search query. Under 2 characters returns []." },
            { name: "projectId", in: "query", required: false, schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$" }, description: "Optional filter. Ignored unless a valid ObjectId." },
          ],
          responses: {
            "200": okResponse("Matching tasks.", { type: "array", items: ref("TaskSearchResult") }),
            "404": errorResponse("No such workspace, or the caller is not a member."),
            ...commonErrors,
          },
        },
      },
      "/api/v1/workspaces/{slug}/my-tasks": {
        get: {
          tags: ["Workspaces"],
          operationId: "listMyTasks",
          summary: "List the caller's assigned tasks in a workspace",
          parameters: [slugParam],
          responses: {
            "200": okResponse("Tasks assigned to the caller, sorted by due date.", { type: "array", items: ref("MyTaskDTO") }),
            "404": errorResponse("No such workspace, or the caller is not a member."),
            ...commonErrors,
          },
        },
      },
      "/api/v1/projects/{projectId}/tasks": {
        get: {
          tags: ["Tasks"],
          operationId: "getProjectBoard",
          summary: "Get a project's full board",
          parameters: [projectIdParam],
          responses: {
            "200": okResponse("Sections with their tasks, plus unsectioned tasks.", ref("BoardData")),
            "404": errorResponse("No such project, or the caller has no access."),
            ...commonErrors,
          },
        },
        post: {
          tags: ["Tasks"],
          operationId: "createTask",
          summary: "Create a task in a project",
          description: "`title` is the only required field. The workspace is derived from the project — never sent by the client.",
          parameters: [projectIdParam],
          requestBody: body(createTaskSchema),
          responses: {
            "201": okResponse("Created.", { type: "object", required: ["id"], properties: { id: { type: "string" } } }),
            ...writeErrors,
          },
        },
      },
      "/api/v1/projects/{projectId}/summary": {
        get: {
          tags: ["Tasks"],
          operationId: "getProjectSummary",
          summary: "Get a project's status and task counts",
          description: "Counts only — no task titles, descriptions, or assignees. Same access rule as the board.",
          parameters: [projectIdParam],
          responses: {
            "200": okResponse("Project status plus task counts.", ref("BoardSummary")),
            "404": errorResponse("No such project, or the caller has no access."),
            ...commonErrors,
          },
        },
      },
      "/api/v1/tasks/{taskId}": {
        get: {
          tags: ["Tasks"],
          operationId: "getTask",
          summary: "Get task detail",
          parameters: [taskIdParam],
          responses: {
            "200": okResponse("The task, with resolved labels and subtasks.", ref("TaskDetailDTO")),
            "400": errorResponse("Malformed ObjectId."),
            "404": errorResponse("No such task, or the caller has no access."),
            ...commonErrors,
          },
        },
        patch: {
          tags: ["Tasks"],
          operationId: "updateTask",
          summary: "Update a task",
          description: "Partial update — omitted fields are left untouched. Returns `data: null`.",
          parameters: [taskIdParam],
          requestBody: body(updateTaskSchema),
          responses: { "200": okResponse("Updated.", { type: "null" }), ...writeErrors },
        },
        delete: {
          tags: ["Tasks"],
          operationId: "archiveTask",
          summary: "Archive a task",
          description: "Soft delete — sets `isArchived`. Returns `data: null`.",
          parameters: [taskIdParam],
          responses: { "200": okResponse("Archived.", { type: "null" }), ...writeErrors },
        },
      },
      "/api/v1/tasks/{taskId}/move": {
        post: {
          tags: ["Tasks"],
          operationId: "moveTask",
          summary: "Move or reorder a task",
          description:
            "`orderedIds` must list the destination section's task ids in their final order, including the moved task. `destSectionId: null` moves it to the unsectioned column.",
          parameters: [taskIdParam],
          requestBody: body(moveTaskSchema),
          responses: { "200": okResponse("Moved.", { type: "null" }), ...writeErrors },
        },
      },
      "/api/v1/tasks/{taskId}/comments": {
        get: {
          tags: ["Comments"],
          operationId: "listComments",
          summary: "List a task's comments",
          description: "Root comments oldest-first, each with its direct replies nested one level.",
          parameters: [taskIdParam],
          responses: {
            "200": okResponse("Comments. Empty if the caller has no access to the task.", { type: "array", items: ref("CommentDTO") }),
            "400": errorResponse("Malformed ObjectId."),
            ...commonErrors,
          },
        },
        post: {
          tags: ["Comments"],
          operationId: "createComment",
          summary: "Comment on a task",
          description:
            "Returns `data: null` — the created comment is not echoed back. Re-fetch via GET if you need its id.",
          parameters: [taskIdParam],
          requestBody: body(createCommentSchema),
          responses: { "201": okResponse("Created.", { type: "null" }), ...writeErrors },
        },
      },
    },
  };
}