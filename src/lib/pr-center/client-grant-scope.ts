export function grantCoversDepartment(
  grants: readonly { role: string; departmentId: string | null }[] | undefined,
  eligibleRoles: readonly string[],
  departmentId: string | null | undefined,
): boolean {
  return (grants ?? []).some(
    (grant) =>
      eligibleRoles.includes(grant.role) &&
      (grant.departmentId === null ||
        (typeof departmentId === "string" && grant.departmentId === departmentId)),
  );
}
