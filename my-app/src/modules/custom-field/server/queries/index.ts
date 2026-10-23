import { connectDB } from "@/lib/db";
import { CustomField } from "@/models/CustomField";
import { TaskFieldValue } from "@/models/TaskFieldValue";
import { parseObjectIdOrThrow } from "@/lib/mongo/ids";
import type { CustomFieldType, ICustomFieldOption } from "@/models/CustomField";

export type CustomFieldDTO = {
  id: string;
  projectId: string;
  name: string;
  type: CustomFieldType;
  options: ICustomFieldOption[];
  position: number;
};

export type FieldValueDTO = {
  fieldId: string;
  value: string | number | null;
};

export async function listCustomFields(
  workspaceId: string,
  projectId: string,
): Promise<CustomFieldDTO[]> {
  await connectDB();
  const wsId = parseObjectIdOrThrow(workspaceId);
  const pid = parseObjectIdOrThrow(projectId);

  const fields = await CustomField.find({ workspaceId: wsId, projectId: pid })
    .sort({ position: 1 })
    .lean();

  return fields.map((f) => ({
    id: String(f._id),
    projectId: String(f.projectId),
    name: f.name,
    type: f.type,
    options: f.options,
    position: f.position,
  }));
}

export async function getTaskFieldValues(
  workspaceId: string,
  taskId: string,
): Promise<FieldValueDTO[]> {
  await connectDB();
  const wsId = parseObjectIdOrThrow(workspaceId);
  const tid = parseObjectIdOrThrow(taskId);

  const values = await TaskFieldValue.find({ workspaceId: wsId, taskId: tid }).lean();

  return values.map((v) => ({
    fieldId: String(v.fieldId),
    value: v.value as string | number | null,
  }));
}
