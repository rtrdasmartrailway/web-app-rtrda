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

export const REQUEST_STATUS_ORDER = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "CLOSED",
  "REJECTED",
  "WITHDRAWN",
  "CANCELLED",
] as const;

/** Legacy ideas allow free-text priorities. Known values have a semantic rank;
 * other text remains sortable after ranked values, with empty values last. */
export function compareIdeaPriorities(
  a: string | null,
  b: string | null,
  descending: boolean,
) {
  const known = (value: string | null) => {
    const text = value?.trim().toUpperCase();
    if (!text) return { category: 2, rank: 0, text: "" };
    const ranks: Record<string, number> = {
      LOW: 0,
      ต่ำ: 0,
      NORMAL: 1,
      MEDIUM: 1,
      ปกติ: 1,
      ปานกลาง: 1,
      HIGH: 2,
      สูง: 2,
      URGENT: 3,
      CRITICAL: 3,
      เร่งด่วน: 3,
      ด่วน: 3,
      ด่วนที่สุด: 3,
    };
    return { category: text in ranks ? 0 : 1, rank: ranks[text] ?? 0, text };
  };
  const left = known(a),
    right = known(b);
  const sign = descending ? -1 : 1;
  return (
    left.category - right.category ||
    sign *
      (left.rank - right.rank ||
        left.text.localeCompare(right.text, "th", { numeric: true })) ||
    (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1)
  );
}

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
