export const listSortFields = {
  requests: [
    ["createdAt", "วันที่สร้าง", "Created"],
    ["requestedFor", "วันที่ต้องการเผยแพร่", "Requested date"],
    ["title", "ชื่อโครงการ", "Project"],
    ["department", "ฝ่าย", "Department"],
    ["requester", "ผู้ส่งคำขอ", "Requester"],
    ["status", "สถานะคำขอ", "Request status"],
  ],
  ideas: [
    ["createdAt", "วันที่เสนอ", "Proposed date"],
    ["title", "ชื่อไอเดีย", "Idea title"],
    ["priority", "ระดับความสำคัญ", "Priority"],
    ["status", "สถานะ", "Status"],
  ],
  audit: [
    ["createdAt", "วันเวลา", "Time"],
    ["actor", "ผู้ดำเนินการ", "Actor"],
    ["action", "การดำเนินการ", "Action"],
    ["entityId", "รายการ", "Entity"],
  ],
} as const;
export type ListSortKind = keyof typeof listSortFields;
export const DEFAULT_LIST_SORT = "createdAt:desc";

/** The id tie-breaker keeps equal values stable across pagination. */
export function listOrderBy(kind: ListSortKind, sort = DEFAULT_LIST_SORT) {
  const [field, direction, extra] = sort.split(":");
  if (
    extra !== undefined ||
    !listSortFields[kind].some(([key]) => key === field) ||
    (direction !== "asc" && direction !== "desc")
  )
    throw new Error("Invalid list sort");
  const value = { sort: direction, nulls: "last" };
  const primary =
    field === "department"
      ? { department: { name: direction } }
      : field === "requester"
        ? { requester: { displayName: direction } }
        : field === "actor"
          ? { actor: { displayName: direction } }
          : { [field]: ["requestedFor", "priority"].includes(field) ? value : direction };
  return [primary, { id: direction }];
}
