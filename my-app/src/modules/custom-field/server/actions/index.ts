"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { requireUser } from "@/modules/auth/server/session";
import { getProjectForUser } from "@/modules/project/server/access";
import { CustomField } from "@/models/CustomField";
import { TaskFieldValue } from "@/models/TaskFieldValue";
import { connectDB } from "@/lib/db";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import { canArchiveProject } from "@/modules/workspace/server/permissions";
import { ActionResult } from "@/lib/action-result";
import type { CustomFieldType } from "@/models/CustomField";

const OptionSchema = z.object({
  label: z.string().min(1).max(80).trim(),
  color: z.string().nullable().default(null),
});

const CreateFieldInput = z.object({
  name: z.string().min(1).max(80).trim(),
  type: z.enum(["TEXT", "NUMBER", "SELECT", "DATE"]),
  options: z.array(OptionSchema).default([]),
});

export async function createCustomFieldAction(
  workspaceSlug: string,
  projectId: string,
  input: z.infer<typeof CreateFieldInput>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const access = await getProjectForUser(projectId, user.id);
  if (!access || !canArchiveProject(access.role)) {
    return { ok: false, error: "Not authorized" };
  }

  const parsed = CreateFieldInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await connectDB();
  const wsId = parseObjectIdOrThrow(access.project.workspaceId);
  const pid = parseObjectIdOrThrow(projectId);

  const count = await CustomField.countDocuments({ workspaceId: wsId, projectId: pid });
  const field = await CustomField.create({
    workspaceId: wsId,
    projectId: pid,
    name: parsed.data.name,
    type: parsed.data.type as CustomFieldType,
    options: parsed.data.options.map((o) => ({ ...o, id: randomUUID() })),
    position: count,
    createdBy: parseObjectIdOrThrow(user.id),
  });

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true, data: { id: String(field._id) } };
}

export async function deleteCustomFieldAction(
  workspaceSlug: string,
  projectId: string,
  fieldId: string,
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const access = await getProjectForUser(projectId, user.id);
  if (!access || !canArchiveProject(access.role)) {
    return { ok: false, error: "Not authorized" };
  }

  await connectDB();
  const wsId = parseObjectIdOrThrow(access.project.workspaceId);
  const fid = parseObjectIdOrThrow(fieldId);
  const pid = parseObjectIdOrThrow(projectId);

  const field = await CustomField.findOne({ _id: fid, workspaceId: wsId, projectId: pid });
  if (!field) return { ok: false, error: "Not found" };

  await Promise.all([
    CustomField.deleteOne({ _id: fid }),
    TaskFieldValue.deleteMany({ workspaceId: wsId, fieldId: fid }),
  ]);

  revalidatePath(`/w/${workspaceSlug}/projects/${projectId}`);
  return { ok: true, data: null };
}

const SetValueInput = z.object({
  fieldId: z.string(),
  value: z.union([z.string(), z.number(), z.null()]),
});

export async function setFieldValueAction(
  workspaceSlug: string,
  taskId: string,
  input: z.infer<typeof SetValueInput>,
): Promise<ActionResult<null>> {
  const user = await requireUser();

  await connectDB();
  const parsed = SetValueInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const fid = parseObjectIdOrThrow(parsed.data.fieldId);
  const tid = parseObjectIdOrThrow(taskId);

  // Verify field exists and get workspaceId
  const field = await CustomField.findById(fid).select("workspaceId projectId").lean();
  if (!field) return { ok: false, error: "Field not found" };

  // Verify user has access to the project
  const access = await getProjectForUser(String(field.projectId), user.id);
  if (!access) return { ok: false, error: "Not authorized" };

  const wsId = field.workspaceId;

  if (parsed.data.value === null || parsed.data.value === "") {
    await TaskFieldValue.deleteOne({ workspaceId: wsId, taskId: tid, fieldId: fid });
  } else {
    await TaskFieldValue.findOneAndUpdate(
      { workspaceId: wsId, taskId: tid, fieldId: fid },
      { $set: { value: parsed.data.value } },
      { upsert: true },
    );
  }

  revalidatePath(`/w/${workspaceSlug}`);
  return { ok: true, data: null };
}
