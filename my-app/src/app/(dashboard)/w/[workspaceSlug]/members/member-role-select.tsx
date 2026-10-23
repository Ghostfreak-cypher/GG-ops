"use client";

import { useState } from "react";
import { updateMemberRoleAction } from "@/modules/workspace/server/actions/update-member-role";
import type { WorkspaceRole } from "@/modules/workspace/roles";
import { Select } from "@/components/ui/select";

export function MemberRoleSelect({
  slug,
  memberId,
  role,
}: {
  slug: string;
  memberId: string;
  role: WorkspaceRole;
}) {
  const [value, setValue] = useState<string>(role);
  const [pending, setPending] = useState(false);

  return (
    <Select
      wrapperClassName="w-auto"
      value={value}
      disabled={pending}
      aria-label="Member role"
      onChange={async (e) => {
        const next = e.target.value;
        setValue(next);
        setPending(true);
        const res = await updateMemberRoleAction(slug, { memberId, role: next });
        setPending(false);
        if (!res.ok) {
          setValue(role);
          alert(res.error);
        }
      }}
    >
      <option value="ADMIN">Admin</option>
      <option value="MEMBER">Member</option>
      <option value="GUEST">Guest</option>
    </Select>
  );
}
