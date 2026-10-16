export type DirectoryActor = {
  role: string;
  roleGrants?: readonly { role: string; departmentId: string | null }[];
};
export type DirectoryUser = { active: boolean; department: { id: string } | null };

export function directoryUserAuthority(actor: DirectoryActor, user: DirectoryUser) {
  // Only complete grant tuples confer scope. A display role alone is not enough.
  const grants = actor.roleGrants ?? [];
  const covers = (role: string) =>
    grants.some(
      (grant) =>
        grant.role === role &&
        (grant.departmentId === null ||
          (!!user.department && grant.departmentId === user.department.id)),
    );
  const administer = covers("RTRDA_ADMIN");
  const grantBoard = user.active && user.department !== null && covers("RTRDA_PR");
  return { administer, grantBoard, canGrant: administer || grantBoard };
}
