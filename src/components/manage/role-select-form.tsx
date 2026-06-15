"use client";

import { useActionState } from "react";
import { ROLES, ROLE_LABELS, type UserRole } from "@/lib/permissions";
import { setUserRoleAction, type ActionState } from "@/app/rtrdaintranet/manage/actions";

export function RoleSelectForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: UserRole;
}) {
  const [state, formAction, pending] = useActionState(setUserRoleAction, {} as ActionState);

  return (
    <form action={formAction} className="manage-role-form">
      <input type="hidden" name="userId" value={userId} />
      <select name="role" defaultValue={currentRole} className="manage-input manage-role-select">
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <button type="submit" className="manage-btn manage-btn-primary" disabled={pending}>
        {pending ? "…" : "บันทึก"}
      </button>
      {state.error && <span className="manage-error">{state.error}</span>}
      {state.success && <span className="manage-ok">✓ บันทึกแล้ว</span>}
    </form>
  );
}
