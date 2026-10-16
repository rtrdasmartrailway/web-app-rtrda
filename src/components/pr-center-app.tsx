"use client";

import {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import {
  DEFAULT_LIST_SORT,
  listSortFields,
  type ListSortKind,
} from "@/lib/pr-center/list-sorting";
import type { CreateContentIdeaInput } from "@/lib/pr-center/idea-input";
import { submitIdeaForm } from "@/lib/pr-center/idea-form";
import {
  createContentIdeasCsv,
  createContentIdeasWordHtml,
} from "@/lib/pr-center/idea-export";
import { parseIdeaListPage, type IdeaListRecord } from "@/lib/pr-center/idea-view";
import {
  bangkokCalendarAnchor,
  bangkokDateKey,
  parseCalendarEntries,
  parseCalendarRequestDecisions,
  type CalendarEntry,
  type CalendarRequestDecision,
} from "@/lib/pr-center/calendar-view";
import { canEditOwnRequest } from "@/lib/pr-center/request-edit";
import { collectCursorPages } from "@/lib/pr-center/collect-cursor-pages";
import { bangkokLocalDateTimeToISOString } from "@/lib/pr-center/schedule-time";
import {
  requestIntakeStatusLabel,
  requestTableStatusLabel,
  summarizeRequestTableTasks,
} from "@/lib/pr-center/request-table";
import { isRootPrCenterAdministrator } from "@/lib/pr-center/access-authority";
import { unavailableMetricDisplay } from "@/lib/pr-center/metric-display";
import {
  RELEASE_EVIDENCE_GATES,
  type ReleaseEvidenceGate,
} from "@/lib/pr-center/release-evidence";
import {
  parseCurrentMessageHouse,
  parseMessageHouseHistory,
  type CurrentMessageHouse,
} from "@/lib/pr-center/message-house-view";
import styles from "./pr-center-app.module.css";

type Page =
  | "home"
  | "executive"
  | "new-request"
  | "my-requests"
  | "requests"
  | "operations"
  | "calendar"
  | "approvals"
  | "library"
  | "ideas"
  | "message-house"
  | "notifications"
  | "history"
  | "directory"
  | "settings"
  | "system-data"
  | "help";

type Language = "th" | "en";

type Role =
  | "admin"
  | "pr"
  | "executive"
  | "project_owner"
  | "approver"
  | "writer"
  | "designer"
  | "video"
  | "requester";
type PrCenterRoleCode = "RTRDA_ALL_USER" | "RTRDA_PR" | "RTRDA_BORD" | "RTRDA_ADMIN";
type StatusId =
  | "draft"
  | "waiting_for_information"
  | "communication_planning"
  | "in_production"
  | "source_fact_check"
  | "technical_review"
  | "pr_editorial_review"
  | "management_approval"
  | "revision_required"
  | "approved"
  | "scheduled"
  | "published"
  | "closed"
  | "rejected"
  | "cancelled";
type RequestType = "pr" | "offsite";

type User = {
  id: string;
  name: string;
  role: Role;
  department: string;
  active: boolean;
};
type Request = {
  id: string;
  title: string;
  type: RequestType;
  requesterId: string;
  department: string;
  requestedDate: string;
  createdAt?: string;
  requesterName?: string;
  taskIds: string[];
  source?: string;
  sources?: string[];
  status?:
    | "DRAFT"
    | "SUBMITTED"
    | "APPROVED"
    | "REJECTED"
    | "WITHDRAWN"
    | "CANCELLED"
    | "CLOSED";
  version?: number;
  rejectionReason?: string;
  decisionHistory?: Array<{
    status: "APPROVED" | "REJECTED";
    reason: string | null;
    createdAt: string;
  }>;
  revisionNumber?: number;
  objective?: string;
  audience?: string;
  startTime?: string;
  endTime?: string;
  travel?: string;
  projectOwner?: string;
  assigner?: string;
  whyNow?: string;
  contentTypes?: string[];
  priority?: string;
  priorityReason?: string;
  projectDetails?: string;
  confirmed?: boolean;
  attachments?: Array<{
    id: string;
    kind: string;
    version: number;
    file: {
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      scanStatus: string;
      deletedAt: string | null;
    };
  }>;
};
type RequestDraft = {
  type: RequestType;
  title: string;
  department: string;
  owner: string;
  requestedDate: string;
  source: string;
  objective: string;
  audience: string;
  startTime: string;
  endTime: string;
  travel: string;
  assigner: string;
  whyNow: string;
  contentTypes: string[];
  priority: string;
  priorityReason: string;
  projectDetails: string;
  confirmed: boolean;
  samples: File[];
};
type EditorialReviewChecklist = {
  message: boolean;
  language: boolean;
  format: boolean;
  appropriateness: boolean;
};

const EMPTY_EDITORIAL_REVIEW_CHECKLIST: EditorialReviewChecklist = {
  message: false,
  language: false,
  format: false,
  appropriateness: false,
};

const EDITORIAL_REVIEW_ITEMS: Array<{
  key: keyof EditorialReviewChecklist;
  label: { th: string; en: string };
}> = [
  {
    key: "message",
    label: {
      th: "สารและเนื้อหาถูกต้องครบถ้วน",
      en: "Message and content are accurate and complete",
    },
  },
  { key: "language", label: { th: "ภาษาเหมาะสม", en: "Language is appropriate" } },
  { key: "format", label: { th: "รูปแบบถูกต้อง", en: "Format is correct" } },
  {
    key: "appropriateness",
    label: {
      th: "เหมาะสมกับผู้รับสารและบริบท",
      en: "Suitable for the audience and context",
    },
  },
];

type Task = {
  id: string;
  requestId: string;
  requesterId?: string;
  type: string;
  title: string;
  status: StatusId;
  ownerId: string;
  ownerName?: string;
  dueDate: string;
  version?: number;
  revisionNumber?: number;
  keyMessage?: string;
  planningKeyMessage?: string;
  technicalReviewRequired?: boolean;
  managementApprovalRequired?: boolean;
  factChecks?: Array<{
    id: string;
    taskRevision: number;
    checkedAt: string;
    summary: string | null;
    checkedBy: { displayName: string };
    items: Array<{
      claim: string;
      evidenceUrl: string;
      note: string | null;
      result: "VERIFIED" | "NEEDS_CORRECTION" | "NEEDS_EVIDENCE";
    }>;
  }>;
  contentBody?: string;
  finalAssetId?: string | null;
  requestStatus?: Request["status"];
  sourceUrls?: string[];
};
type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  target: string;
  createdAt: string;
  read: boolean;
};
type IdeaStatus =
  | "proposed"
  | "under_review"
  | "pending_approval"
  | "revision_required"
  | "accepted"
  | "rejected"
  | "converted"
  | "archived";
const IDEA_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  proposed: ["under_review", "rejected", "archived"],
  under_review: ["pending_approval", "rejected", "archived"],
  pending_approval: ["accepted", "revision_required", "rejected"],
  revision_required: ["under_review", "archived"],
  accepted: ["archived"],
  rejected: ["archived"],
  converted: ["archived"],
  archived: [],
};
type Idea = {
  id: string;
  title: string;
  summary: string;
  authorId: string;
  status: IdeaStatus;
  createdAt: string;
  audience?: string;
  pillar?: string;
  channel?: string;
  priority?: string;
  campaign?: string;
  evidenceUrls?: string[];
  decisionReason?: string | null;
  requestId?: string;
  version?: number;
};
const IDEAS_PAGE_SIZE = 50;
function mapIdeaRecord(idea: IdeaListRecord): Idea {
  return {
    id: idea.id,
    title: idea.title,
    summary: idea.rationale,
    authorId: idea.proposerId,
    status: idea.status.toLowerCase() as IdeaStatus,
    createdAt: idea.createdAt,
    audience: idea.audience || undefined,
    pillar: idea.pillar || undefined,
    channel: idea.channel || undefined,
    priority: idea.priority || undefined,
    campaign: idea.campaign || undefined,
    evidenceUrls: idea.evidenceUrls,
    decisionReason: idea.decisionReason,
    requestId: idea.convertedRequestId || undefined,
    version: idea.version,
  };
}
function ListSorting({
  kind,
  value,
  onChange,
  language,
}: {
  kind: ListSortKind;
  value: string;
  onChange: (value: string) => void;
  language: Language;
}) {
  const [field, direction] = value.split(":");
  const thai = language === "th";
  return (
    <div className={styles.filterBar}>
      <label>
        {thai ? "เรียงตาม " : "Sort by "}
        <select
          value={field}
          onChange={(event) => onChange(`${event.target.value}:${direction}`)}
        >
          {listSortFields[kind].map(([key, th, en]) => (
            <option key={key} value={key}>
              {thai ? th : en}
            </option>
          ))}
        </select>
      </label>
      <label>
        {thai ? "ลำดับ " : "Order "}
        <select
          value={direction}
          onChange={(event) => onChange(`${field}:${event.target.value}`)}
        >
          <option value="desc">
            {field === "createdAt" || field === "requestedFor"
              ? thai
                ? "ใหม่ไปเก่า"
                : "Newest first"
              : thai
                ? "มากไปน้อย / ฮ–ก"
                : "Descending / Z–A"}
          </option>
          <option value="asc">
            {field === "createdAt" || field === "requestedFor"
              ? thai
                ? "เก่าไปใหม่"
                : "Oldest first"
              : thai
                ? "น้อยไปมาก / ก–ฮ"
                : "Ascending / A–Z"}
          </option>
        </select>
      </label>
    </div>
  );
}

async function fetchIdeaPage(
  offset: number,
  search = "",
  status = "",
  signal?: AbortSignal,
  sort = DEFAULT_LIST_SORT,
) {
  const query = new URLSearchParams({
    take: String(IDEAS_PAGE_SIZE),
    offset: String(offset),
    sort,
  });
  if (search.trim()) query.set("search", search.trim());
  if (status) query.set("status", status);
  const response = await fetch(`/api/pr-center/ideas?${query.toString()}`, {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) throw new Error("Idea list unavailable");
  return parseIdeaListPage(await response.json());
}
type MessageHouseData = {
  vision: string;
  positioning: string;
  pillars: string[];
  foundation: string;
  pillarByTask: Record<string, string>;
  versionNumber?: number;
  effectiveAt?: string;
};
function emptyMessageHouse(): MessageHouseData {
  return {
    vision: "",
    positioning: "",
    pillars: [],
    foundation: "",
    pillarByTask: {},
  };
}
type MasterData = {
  contentTypes: string[];
  channels: string[];
  contentPillars: string[];
  departments: string[];
  approvalStages: string[];
};
type Snapshot = {
  id: string;
  name: string;
  createdAt: string;
  state: PrCenterState;
};
type AuditEntry = {
  actorName?: string;
  id: string;
  actorId: string;
  entity: "request" | "task" | "notification" | "system";
  entityId: string;
  action: string;
  before: string;
  after: string;
  createdAt: string;
};
type ApiRequestRecord = {
  assignedTaskOnly?: boolean;
  id: string;
  title: string;
  type: "PR" | "OFFSITE";
  requestedFor: string | null;
  priority: string;
  priorityReason: string | null;
  createdAt: string;
  department: { name: string };
  requester: { displayName: string };
  requesterId: string;
  status: Request["status"];
  version: number;
  revisions: Array<{
    revisionNumber: number;
    objective: string | null;
    audience: string | null;
    offsiteDetails: unknown;
  }>;
  sources: { url: string }[];
  attachments: Array<{
    id: string;
    kind: string;
    version: number;
    file: {
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      scanStatus: string;
      deletedAt: string | null;
    };
  }>;
  statusHistory: { toState: string; reason: string | null; createdAt: string }[];
  tasks: Array<{
    id: string;
    title: string;
    contentType: string;
    status: string;
    ownerId: string | null;
    owner: { displayName: string } | null;
    dueAt: string | null;
    planningKeyMessage: string | null;
    technicalReviewRequired: boolean;
    managementApprovalRequired: boolean;
    factChecks: Task["factChecks"];
    version: number;
    revisions: Array<{
      revisionNumber: number;
      body: string | null;
      keyMessage: string | null;
      finalAssetId: string | null;
    }>;
  }>;
};
type ContentLibraryRecord = {
  id: string;
  requestNumber: string;
  title: string;
  type: "PR" | "OFFSITE";
  status: string;
  requestedFor: string | null;
  createdAt: string;
  updatedAt: string;
  department: { name: string };
  revisions: Array<{
    revisionNumber: number;
    title: string;
    objective: string | null;
    audience: string | null;
    offsiteDetails: unknown;
    changeSummary: string | null;
    createdAt: string;
  }>;
  sources: Array<{ id: string; label: string | null; url: string; createdAt: string }>;
  attachments: Array<{
    id: string;
    kind: string;
    version: number;
    createdAt: string;
    file: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      scanStatus: string;
      deletedAt: string | null;
    };
  }>;
};
type RequestApprovalItem = {
  id: string;
  requestNumber: string;
  title: string;
  type: "PR" | "OFFSITE";
  status: "SUBMITTED";
  version: number;
  department: { name: string };
  requester: { displayName: string };
  requestedFor: string | null;
  priority: string;
  priorityReason: string | null;
  revisions: Array<{
    revisionNumber: number;
    title: string;
    objective: string | null;
    audience: string | null;
    offsiteDetails: unknown;
    changeSummary: string | null;
    createdAt: string;
  }>;
  sources: Array<{ url: string }>;
  statusHistory: Array<{
    toState: "APPROVED" | "REJECTED";
    reason: string | null;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    kind: string;
    version: number;
    file: {
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      scanStatus: string;
      deletedAt: string | null;
    };
  }>;
  intakeDecisionBlockedReason: "SELF_SUBMISSION" | "TASK_WORK_ALREADY_STARTED" | null;
};
type TaskApprovalRecord = {
  id: string;
  requestId: string;
  title: string;
  contentType: string;
  status: string;
  ownerId: string | null;
  owner?: { displayName: string } | null;
  dueAt: string | null;
  planningKeyMessage: string | null;
  technicalReviewRequired: boolean;
  managementApprovalRequired: boolean;
  version: number;
  revisions?: Array<{
    revisionNumber: number;
    body: string | null;
    keyMessage: string | null;
    finalAssetId: string | null;
  }>;
  request: { status?: Request["status"]; sources: Array<{ url: string }> };
};

function mapTaskApprovalRecord(task: TaskApprovalRecord): Task {
  return {
    id: task.id,
    requestId: task.requestId,
    title: task.title,
    type: task.contentType,
    status: task.status.toLowerCase() as StatusId,
    ownerId: task.ownerId || "",
    ownerName: task.owner?.displayName,
    dueDate: task.dueAt?.slice(0, 10) || "",
    version: task.version,
    planningKeyMessage: task.planningKeyMessage || undefined,
    technicalReviewRequired: task.technicalReviewRequired,
    managementApprovalRequired: task.managementApprovalRequired,
    revisionNumber: task.revisions?.[0]?.revisionNumber,
    contentBody: task.revisions?.[0]?.body || undefined,
    keyMessage: task.revisions?.[0]?.keyMessage || undefined,
    finalAssetId: task.revisions?.[0]?.finalAssetId,
    requestStatus: task.request.status,
    sourceUrls: task.request.sources.map((source) => source.url),
  };
}

function mapRequestRecord(request: ApiRequestRecord): Request {
  const offsiteDetails = request.revisions[0]?.offsiteDetails;
  const detailRecord =
    offsiteDetails && typeof offsiteDetails === "object" && !Array.isArray(offsiteDetails)
      ? (offsiteDetails as Record<string, unknown>)
      : null;
  return {
    id: request.id,
    title: request.title,
    type: request.type.toLowerCase() as RequestType,
    requesterId: request.requesterId,
    department: request.department.name,
    requestedDate: request.requestedFor?.slice(0, 10) || "",
    createdAt: request.createdAt,
    requesterName: request.requester.displayName,
    taskIds: request.tasks.map((task) => task.id),
    status: request.status,
    version: request.version,
    rejectionReason:
      request.statusHistory.find((entry) => entry.toState === "REJECTED")?.reason ||
      undefined,
    decisionHistory: request.statusHistory.flatMap((entry) =>
      entry.toState === "APPROVED" || entry.toState === "REJECTED"
        ? [
            {
              status: entry.toState,
              reason: entry.reason,
              createdAt: entry.createdAt,
            },
          ]
        : [],
    ),
    revisionNumber: request.revisions[0]?.revisionNumber,
    objective: request.revisions[0]?.objective || undefined,
    audience: request.revisions[0]?.audience || undefined,
    startTime:
      typeof detailRecord?.startTime === "string" ? detailRecord.startTime : undefined,
    endTime: typeof detailRecord?.endTime === "string" ? detailRecord.endTime : undefined,
    travel: typeof detailRecord?.travel === "string" ? detailRecord.travel : undefined,
    projectOwner:
      typeof detailRecord?.projectOwner === "string"
        ? detailRecord.projectOwner
        : undefined,
    assigner:
      typeof detailRecord?.assigner === "string" ? detailRecord.assigner : undefined,
    whyNow: typeof detailRecord?.whyNow === "string" ? detailRecord.whyNow : undefined,
    contentTypes: Array.isArray(detailRecord?.contentTypes)
      ? detailRecord.contentTypes.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined,
    priority: request.priority,
    priorityReason: request.priorityReason || undefined,
    projectDetails:
      typeof detailRecord?.projectDetails === "string"
        ? detailRecord.projectDetails
        : undefined,
    confirmed: detailRecord?.confirmed === true,
    source: request.sources[0]?.url,
    sources: request.sources.map((source) => source.url),
    attachments: request.attachments,
  };
}

function mapRequestTasks(records: ApiRequestRecord[]): Task[] {
  return records.flatMap((request) =>
    request.tasks.map((task) => ({
      id: task.id,
      requestId: request.id,
      requesterId: request.requesterId,
      requestStatus: request.status,
      type: task.contentType,
      title: task.title,
      status: task.status.toLowerCase() as StatusId,
      ownerId: task.ownerId || "",
      ownerName: task.owner?.displayName,
      dueDate: task.dueAt?.slice(0, 10) || "",
      planningKeyMessage: task.planningKeyMessage || undefined,
      technicalReviewRequired: task.technicalReviewRequired,
      managementApprovalRequired: task.managementApprovalRequired,
      factChecks: task.factChecks,
      version: task.version,
      revisionNumber: task.revisions[0]?.revisionNumber,
      contentBody: task.revisions[0]?.body || undefined,
      keyMessage: task.revisions[0]?.keyMessage || undefined,
      finalAssetId: task.revisions[0]?.finalAssetId,
      sourceUrls: request.sources.map((source) => source.url),
    })),
  );
}

// Operations and dashboard counts depend on every scoped task, not only the
// first page used by the request tables. Continue until the API's extra-row
// sentinel disappears; keep the request-list filters/pagination separate.
async function fetchScopedRequestRecords(
  signal?: AbortSignal,
): Promise<ApiRequestRecord[]> {
  return collectCursorPages(async (cursor) => {
    const query = new URLSearchParams({ take: "100" });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(`/api/pr-center/requests?${query}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("Request list unavailable");
    return (await response.json()) as ApiRequestRecord[];
  });
}

type PrCenterState = {
  version: 1;
  language: Language;
  currentUserId: string;
  requests: Request[];
  tasks: Task[];
  notifications: Notification[];
  audit: AuditEntry[];
  ideas: Idea[];
  messageHouse: MessageHouseData;
  masterData: MasterData;
  snapshots: Snapshot[];
};

const pages: { id: Page; th: string; en: string; icon: string }[] = [
  { id: "home", th: "หน้าหลัก", en: "Home", icon: "🏠" },
  { id: "executive", th: "ภาพรวมผู้บริหาร", en: "Executive Dashboard", icon: "📊" },
  { id: "new-request", th: "ส่งคำขอ", en: "Submit Request", icon: "➕" },
  { id: "my-requests", th: "คำขอของฉัน", en: "My Requests", icon: "📥" },
  { id: "requests", th: "คำขอทั้งหมด", en: "All Requests", icon: "📋" },
  { id: "operations", th: "Content Operations", en: "Content Operations", icon: "🧩" },
  { id: "calendar", th: "ปฏิทิน", en: "Calendar", icon: "🗓️" },
  { id: "approvals", th: "คิวอนุมัติ", en: "Approval Queue", icon: "✅" },
  { id: "library", th: "คลัง Content", en: "Content Library", icon: "🗂️" },
  { id: "ideas", th: "เสนอ Content Ideas", en: "Content Ideas", icon: "💡" },
  { id: "message-house", th: "Message House", en: "Message House", icon: "🏛️" },
  { id: "notifications", th: "การแจ้งเตือน", en: "Notifications", icon: "🔔" },
  { id: "help", th: "วิธีใช้งาน", en: "How to Use", icon: "❓" },
  { id: "history", th: "ประวัติ", en: "History", icon: "🕘" },
  { id: "directory", th: "User Directory", en: "User Directory", icon: "👥" },
  { id: "settings", th: "บันทึกการเข้าถึง", en: "Access Audit", icon: "⚙️" },
  { id: "system-data", th: "System Data", en: "System Data", icon: "🗄️" },
];
const PHASE_1_PAGES = new Set<Page>([
  "home",
  "new-request",
  "my-requests",
  "requests",
  "operations",
  "calendar",
  "approvals",
  "notifications",
  "history",
  "directory",
  "settings",
]);
const PHASE_2_PAGE_IDS = new Set<Page>(["library", "ideas", "message-house"]);
const PHASE_2_PAGES = new Set<Page>(
  (process.env.NEXT_PUBLIC_PR_CENTER_PHASE2_PAGES || "")
    .split(",")
    .map((page) => page.trim())
    .filter((page): page is Page => PHASE_2_PAGE_IDS.has(page as Page)),
);
function isPageEnabled(page: Page) {
  return PHASE_1_PAGES.has(page) || PHASE_2_PAGES.has(page);
}

const copy = {
  th: {
    greeting: "สวัสดี, ทีมสื่อสารองค์กร",
    subheading: "ภาพรวมงานประชาสัมพันธ์และการสื่อสารของ สทร.",
    newRequest: "ส่งคำขอใหม่",
    search: "ค้นหางาน คำขอ หรือเนื้อหา",
    prototype: "Phase 1 Test · ข้อมูลคำขอและงานมาจากระบบ PR Center",
    published: "เผยแพร่แล้ว",
    reach: "จำนวนการเข้าถึง",
    engagement: "การมีส่วนร่วม",
    pending: "รออนุมัติ",
    upcoming: "กำหนดเผยแพร่เร็ว ๆ นี้",
    workflow: "สถานะงาน",
    recentRequests: "คำขอล่าสุด",
    viewAll: "ดูทั้งหมด",
    role: "บทบาทตัวอย่าง",
    refresh: "รีเฟรชสถานะ",
    rejectionReason: "เหตุผล/ความคิดเห็นที่ปฏิเสธ",
  },
  en: {
    greeting: "Welcome, Communications Team",
    subheading: "RTRDA public relations and communications overview.",
    newRequest: "New request",
    search: "Search work, requests, or content",
    prototype: "Phase 1 Test · requests and tasks are served by PR Center",
    published: "Published",
    reach: "Total reach",
    engagement: "Engagement",
    pending: "Awaiting approval",
    upcoming: "Upcoming publications",
    workflow: "Workflow health",
    recentRequests: "Recent requests",
    viewAll: "View all",
    role: "Demo role",
    refresh: "Refresh status",
    rejectionReason: "Rejection reason / comment",
  },
};

const STATUS_LABELS: Record<StatusId, string> = {
  draft: "Draft",
  waiting_for_information: "Waiting for information",
  communication_planning: "Communication planning",
  in_production: "In production",
  source_fact_check: "Source fact check",
  technical_review: "Technical review",
  pr_editorial_review: "PR editorial review",
  management_approval: "Awaiting approval",
  revision_required: "Revision required",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  closed: "Closed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
const STATUS_TRANSITIONS: Record<StatusId, StatusId[]> = {
  draft: ["waiting_for_information", "communication_planning", "cancelled"],
  waiting_for_information: ["communication_planning", "cancelled"],
  communication_planning: ["in_production", "waiting_for_information", "cancelled"],
  in_production: [
    "source_fact_check",
    "technical_review",
    "pr_editorial_review",
    "revision_required",
    "cancelled",
  ],
  source_fact_check: [
    "technical_review",
    "pr_editorial_review",
    "revision_required",
    "rejected",
  ],
  technical_review: ["pr_editorial_review", "revision_required", "rejected"],
  pr_editorial_review: [
    "management_approval",
    "approved",
    "revision_required",
    "rejected",
  ],
  management_approval: ["approved", "revision_required", "rejected"],
  revision_required: [
    "in_production",
    "source_fact_check",
    "technical_review",
    "pr_editorial_review",
    "cancelled",
  ],
  approved: ["scheduled", "revision_required", "cancelled"],
  scheduled: ["published", "revision_required", "cancelled"],
  published: ["closed"],
  closed: [],
  rejected: [],
  cancelled: [],
};

const ROLE_PAGES: Record<Role, Page[]> = {
  admin: pages.map(({ id }) => id),
  pr: pages.map(({ id }) => id),
  executive: [
    "executive",
    "home",
    "calendar",
    "approvals",
    "message-house",
    "notifications",
  ],
  project_owner: [
    "home",
    "new-request",
    "my-requests",
    "calendar",
    "ideas",
    "message-house",
    "notifications",
    "help",
  ],
  approver: ["home", "calendar", "approvals", "ideas", "message-house", "notifications"],
  writer: [
    "home",
    "new-request",
    "my-requests",
    "operations",
    "calendar",
    "ideas",
    "message-house",
    "notifications",
    "help",
  ],
  designer: [
    "home",
    "my-requests",
    "operations",
    "calendar",
    "message-house",
    "notifications",
    "help",
  ],
  video: [
    "home",
    "my-requests",
    "operations",
    "calendar",
    "message-house",
    "notifications",
    "help",
  ],
  requester: [
    "home",
    "new-request",
    "my-requests",
    "operations",
    "calendar",
    "ideas",
    "message-house",
    "notifications",
    "help",
  ],
};

const DISPLAY_ROLE_BY_PR_ROLE: Record<PrCenterRoleCode, Role> = {
  RTRDA_ALL_USER: "requester",
  RTRDA_PR: "pr",
  RTRDA_BORD: "pr",
  RTRDA_ADMIN: "admin",
};

const defaultState: PrCenterState = {
  version: 1,
  language: "th",
  currentUserId: "u-pr",
  requests: [
    {
      id: "REQ-026",
      title: "งานเปิดตัวมาตรฐานระบบราง",
      type: "pr",
      requesterId: "u-requester",
      department: "Strategy Division",
      requestedDate: "2026-09-12",
      taskIds: ["TASK-042"],
    },
    {
      id: "REQ-025",
      title: "ประชาสัมพันธ์โครงการ AI Camera",
      type: "pr",
      requesterId: "u-requester",
      department: "Digital Rail",
      requestedDate: "2026-09-10",
      taskIds: ["TASK-041"],
    },
    {
      id: "REQ-024",
      title: "ลงพื้นที่จังหวัดขอนแก่น",
      type: "offsite",
      requesterId: "u-requester",
      department: "Communications Office",
      requestedDate: "2026-09-08",
      taskIds: ["TASK-040"],
    },
    {
      id: "REQ-023",
      title: "มาตรฐานความปลอดภัยระบบราง",
      type: "pr",
      requesterId: "u-requester",
      department: "Communications Office",
      requestedDate: "2026-09-02",
      taskIds: ["TASK-039", "TASK-038"],
    },
  ],
  tasks: [
    {
      id: "TASK-042",
      requestId: "REQ-026",
      type: "Facebook Post",
      title: "ความก้าวหน้าโครงการมาตรฐาน",
      status: "in_production",
      ownerId: "u-writer",
      dueDate: "2026-09-12",
    },
    {
      id: "TASK-041",
      requestId: "REQ-025",
      type: "Short Video",
      title: "เบื้องหลังการทดสอบระบบราง",
      status: "pr_editorial_review",
      ownerId: "u-video",
      dueDate: "2026-09-10",
    },
    {
      id: "TASK-040",
      requestId: "REQ-024",
      type: "Website News",
      title: "สทร. ร่วมประชุมภาคีเครือข่าย",
      status: "scheduled",
      ownerId: "u-approver",
      dueDate: "2026-09-08",
    },
    {
      id: "TASK-039",
      requestId: "REQ-023",
      type: "Website News",
      title: "ประกาศมาตรฐานความปลอดภัยระบบราง",
      status: "published",
      ownerId: "u-writer",
      dueDate: "2026-09-02",
    },
    {
      id: "TASK-038",
      requestId: "REQ-023",
      type: "Facebook Post",
      title: "เบื้องหลังมาตรฐานความปลอดภัย",
      status: "closed",
      ownerId: "u-pr",
      dueDate: "2026-09-03",
    },
  ],
  notifications: [
    {
      id: "N-003",
      userId: "u-pr",
      title: "Approval needed",
      message: "Technical review is ready for AI Camera project",
      target: "approvals",
      createdAt: "2026-09-07T09:30:00.000Z",
      read: false,
    },
    {
      id: "N-002",
      userId: "u-pr",
      title: "New request",
      message: "REQ-026 was submitted by Strategy Division",
      target: "requests",
      createdAt: "2026-09-07T09:15:00.000Z",
      read: false,
    },
    {
      id: "N-001",
      userId: "u-pr",
      title: "Publication due",
      message: "Rail standard announcement publishes tomorrow",
      target: "operations",
      createdAt: "2026-09-07T09:00:00.000Z",
      read: false,
    },
  ],
  audit: [],
  ideas: [
    {
      id: "IDEA-003",
      title: "Behind Every Safe Journey",
      summary: "Show the people and evidence behind safer rail journeys.",
      authorId: "u-writer",
      status: "proposed",
      createdAt: "2026-09-07T08:00:00.000Z",
    },
    {
      id: "IDEA-002",
      title: "Rail Explained: What is ETCS?",
      summary: "A short explainer for the public.",
      authorId: "u-pr",
      status: "under_review",
      createdAt: "2026-09-06T08:00:00.000Z",
    },
    {
      id: "IDEA-001",
      title: "RTRDA research in action",
      summary: "Connect research outcomes to national impact.",
      authorId: "u-requester",
      status: "accepted",
      createdAt: "2026-09-05T08:00:00.000Z",
    },
  ],
  messageHouse: emptyMessageHouse(),
  masterData: {
    contentTypes: [
      "Website News",
      "Facebook Post",
      "Carousel",
      "Infographic",
      "Quote Card",
      "Short Video",
      "Reel",
      "YouTube Video",
      "Photo Album",
      "X Post",
      "LinkedIn Post",
      "Press Release",
      "Newsletter",
      "Executive Brief",
      "Other",
    ],
    channels: [
      "Website",
      "Facebook",
      "TikTok",
      "YouTube",
      "X",
      "LinkedIn",
      "Press Release",
      "Internal",
    ],
    contentPillars: [
      "P01 Rail Explained",
      "P02 Behind the Standard",
      "P03 Behind Every Safe Journey",
      "P04 Human(s) of RTRDA",
      "P05 Research to Reality",
      "P06 Ask RTRDA",
      "P07 Future Rail Thailand",
      "P08 National Impact",
    ],
    departments: ["Communications Office", "Strategy Division", "Digital Rail"],
    approvalStages: [
      "Source fact check",
      "Technical review",
      "PR editorial review",
      "Management approval",
    ],
  },
  snapshots: [],
};

const users: User[] = [
  {
    id: "u-pr",
    name: "PR Lead",
    role: "pr",
    department: "Communications Office",
    active: true,
  },
  {
    id: "u-admin",
    name: "System Administrator",
    role: "admin",
    department: "Communications Office",
    active: true,
  },
  {
    id: "u-executive",
    name: "Executive Director",
    role: "executive",
    department: "Director",
    active: true,
  },
  {
    id: "u-writer",
    name: "N. Suthida",
    role: "writer",
    department: "Communications Office",
    active: true,
  },
  {
    id: "u-video",
    name: "P. Thanawat",
    role: "video",
    department: "Communications Office",
    active: true,
  },
  {
    id: "u-approver",
    name: "K. Narin",
    role: "approver",
    department: "Communications Office",
    active: true,
  },
  {
    id: "u-project-owner",
    name: "A. Kanya",
    role: "project_owner",
    department: "Strategy Division",
    active: true,
  },
  {
    id: "u-designer",
    name: "M. Piyada",
    role: "designer",
    department: "Communications Office",
    active: true,
  },
  {
    id: "u-requester",
    name: "Strategy Division",
    role: "requester",
    department: "Strategy Division",
    active: true,
  },
];

function cloneDefaultState(): PrCenterState {
  return structuredClone(defaultState);
}
function createAuthenticatedState(): PrCenterState {
  const state = cloneDefaultState();
  state.requests = [];
  state.tasks = [];
  state.notifications = [];
  state.audit = [];
  state.ideas = [];
  state.messageHouse = emptyMessageHouse();
  state.snapshots = [];
  return state;
}
function getUser(userId: string) {
  return users.find((user) => user.id === userId);
}
function requestStatus(request: Request, allTasks: Task[]): StatusId {
  return allTasks.find((task) => request.taskIds.includes(task.id))?.status ?? "draft";
}
function emptyRequestDraft(user: Pick<User, "name" | "department">): RequestDraft {
  return {
    type: "pr",
    title: "",
    department: user.department,
    owner: user.name,
    requestedDate: "",
    source: "",
    objective: "",
    audience: "",
    startTime: "",
    endTime: "",
    travel: "RTRDA transport confirmed",
    assigner: "",
    whyNow: "",
    contentTypes: ["Website News"],
    priority: "NORMAL",
    priorityReason: "",
    projectDetails: "",
    confirmed: false,
    samples: [],
  };
}
function label(page: (typeof pages)[number], language: Language) {
  return language === "th" ? page.th : page.en;
}

function Status({ children }: { children: string }) {
  const tone =
    children.includes("อนุมัติ") || children.includes("review")
      ? "amber"
      : children.includes("เผยแพร่") || children.includes("scheduled")
        ? "green"
        : "blue";
  return <span className={`${styles.status} ${styles[tone]}`}>{children}</span>;
}

function Metric({
  value,
  label: metricLabel,
  trend,
  tone,
}: {
  value: string;
  label: string;
  trend: string;
  tone: "blue" | "green" | "purple" | "gold";
}) {
  return (
    <article
      className={`${styles.metric} ${styles[`metric${tone[0].toUpperCase()}${tone.slice(1)}`]}`}
    >
      <p>{metricLabel}</p>
      <strong>{value}</strong>
      <span>{trend}</span>
    </article>
  );
}

function DashboardScheduleInsights({
  language,
  onNavigate,
}: {
  language: Language;
  onNavigate: (page: Page) => void;
}) {
  const thai = language === "th";
  const locale = thai ? "th-TH-u-ca-buddhist" : "en-GB";
  const [dashboardAnchor] = useState(() => new Date());
  const now = dashboardAnchor;
  const today = bangkokDateKey(now);
  const rangeStart = bangkokCalendarAnchor(now);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 14);
  const rangeEnd = bangkokCalendarAnchor(now);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 31);
  const from = new Date(rangeStart.getTime() - 7 * 60 * 60 * 1000).toISOString();
  const to = new Date(rangeEnd.getTime() - 7 * 60 * 60 * 1000).toISOString();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/pr-center/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { credentials: "same-origin", signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Calendar data unavailable");
        return parseCalendarEntries(await response.json());
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setEntries(result);
          setError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEntries([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [from, to]);

  const upcoming = entries
    .filter(
      (entry) => entry.status === "SCHEDULED" && bangkokDateKey(entry.date) >= today,
    )
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 5);
  const channelCounts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status !== "SCHEDULED" && entry.status !== "PUBLISHED") continue;
    const channel = entry.channel?.trim();
    if (!channel) continue;
    channelCounts.set(channel, (channelCounts.get(channel) || 0) + 1);
  }
  const channelMix = [...channelCounts.entries()]
    .map(([channel, count]) => ({ channel, count, percent: 0 }))
    .sort(
      (left, right) =>
        right.count - left.count || left.channel.localeCompare(right.channel),
    );
  const channelTotal = channelMix.reduce((sum, item) => sum + item.count, 0);
  let cursor = 0;
  const colors = ["#1976d2", "#0b8c85", "#f4ad3d", "#8b5cf6", "#e05a73", "#56718f"];
  const gradient = channelMix.length
    ? `conic-gradient(${channelMix
        .map((item, index) => {
          const start = cursor;
          cursor += (item.count / channelTotal) * 100;
          item.percent = Math.round((item.count / channelTotal) * 100);
          return `${colors[index % colors.length]} ${start}% ${cursor}%`;
        })
        .join(", ")})`
    : "#e8edf3";
  const publishedByMonth = new Map<string, number[]>([]);
  for (const entry of entries.filter((item) => item.status === "PUBLISHED")) {
    const dateKey = bangkokDateKey(entry.date);
    const date = new Date(`${dateKey}T00:00:00Z`);
    const monthKey = date.toLocaleDateString(locale, {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    const week = Math.min(5, Math.floor((date.getUTCDate() - 1) / 7));
    const counts = publishedByMonth.get(monthKey) || [0, 0, 0, 0, 0];
    counts[week] += 1;
    publishedByMonth.set(monthKey, counts);
  }

  return (
    <section className={styles.dashboardInsightsGrid}>
      <article className={styles.card}>
        <header>
          <div>
            <p className={styles.eyebrow}>
              {thai ? "กำหนดเผยแพร่" : "UPCOMING PUBLICATIONS"}
            </p>
            <h2>{thai ? "รายการเผยแพร่เร็ว ๆ นี้" : "Upcoming publications"}</h2>
          </div>
          <button type="button" onClick={() => onNavigate("calendar")}>
            {thai ? "เปิดปฏิทิน" : "Open calendar"}
          </button>
        </header>
        {loading ? (
          <p role="status">{thai ? "กำลังโหลดกำหนดการ…" : "Loading schedules…"}</p>
        ) : error ? (
          <p role="alert">
            {thai ? "โหลดกำหนดการไม่สำเร็จ" : "Schedules could not be loaded."}
          </p>
        ) : upcoming.length === 0 ? (
          <p className={styles.dashboardNote}>
            {thai
              ? "ยังไม่มีรายการที่กำหนดเผยแพร่"
              : "No upcoming publications are scheduled."}
          </p>
        ) : (
          <ul className={styles.upcomingList}>
            {upcoming.map((entry) => (
              <li key={entry.id}>
                <span>{entry.title}</span>
                <small>
                  {entry.channel} ·{" "}
                  {new Date(entry.date).toLocaleString(locale, {
                    timeZone: "Asia/Bangkok",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </small>
              </li>
            ))}
          </ul>
        )}
      </article>
      <article className={styles.card}>
        <p className={styles.eyebrow}>{thai ? "สัดส่วนแผนเผยแพร่" : "CHANNEL MIX"}</p>
        <h2>
          {thai ? "กำหนดการและเผยแพร่ตามช่องทาง" : "Scheduled and published by channel"}
        </h2>
        {channelTotal > 0 ? (
          <div className={styles.channelMix}>
            <div
              className={styles.channelMixDonut}
              style={{ background: gradient }}
              aria-label={thai ? "กราฟสัดส่วนช่องทาง" : "Channel mix chart"}
            />
            <ul>
              {channelMix.map((item, index) => (
                <li key={item.channel}>
                  <span style={{ background: colors[index % colors.length] }} />
                  <b>{item.channel}</b>
                  <small>
                    {item.count} · {item.percent}%
                  </small>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className={styles.dashboardNote}>
            {thai
              ? "ยังไม่มีข้อมูลตารางเผยแพร่สำหรับช่วงนี้"
              : "No schedule data is available for this period."}
          </p>
        )}
      </article>
      <article className={`${styles.card} ${styles.wideCard}`}>
        <p className={styles.eyebrow}>
          {thai ? "ผลงานเผยแพร่รายสัปดาห์" : "WEEKLY PUBLISHED CONTENT"}
        </p>
        <h2>
          {thai ? "จำนวนผลงานตามสัปดาห์ของเดือน" : "Published content by week of month"}
        </h2>
        {publishedByMonth.size > 0 ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>{thai ? "เดือน" : "Month"}</th>
                  {[1, 2, 3, 4, 5].map((week) => (
                    <th key={week}>W{week}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...publishedByMonth.entries()].map(([month, counts]) => (
                  <tr key={month}>
                    <th scope="row">{month}</th>
                    {counts.map((count, index) => (
                      <td key={index}>{count}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.dashboardNote}>
            {thai
              ? "ยังไม่มีผลงานเผยแพร่ในช่วงนี้"
              : "No published content is available for this period."}
          </p>
        )}
      </article>
      <article className={styles.card}>
        <p className={styles.eyebrow}>{thai ? "ข้อมูลวิเคราะห์" : "ANALYTICS"}</p>
        <h2>
          {thai ? "Reach, Engagement และผลงานเด่น" : "Reach, engagement and top content"}
        </h2>
        <p className={styles.dashboardNote}>
          {thai
            ? "ยังไม่มีแหล่งข้อมูล analytics ที่ตรวจสอบและยืนยันได้ จึงยังไม่แสดงแนวโน้ม Reach รายเดือนหรือ Top Content"
            : "No verified analytics source is connected, so monthly reach trends and Top Content remain unavailable."}
        </p>
      </article>
    </section>
  );
}

export function PrCenterApp({
  actor,
  onSignOut,
}: {
  actor?: {
    userId: string;
    displayName: string;
    departmentName: string;
    role: PrCenterRoleCode;
    isRootAdministrator?: boolean;
    roles?: PrCenterRoleCode[];
    roleGrants?: Array<{ role: PrCenterRoleCode; departmentId: string | null }>;
  };
  onSignOut?: () => void;
}) {
  const latestActorId = useRef(actor?.userId);
  const [page, setPage] = useState<Page>("home");
  const [state, setState] = useState<PrCenterState>(() =>
    actor ? createAuthenticatedState() : cloneDefaultState(),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestEditId, setRequestEditId] = useState<string | null>(null);
  const [requestDraft, setRequestDraft] = useState<RequestDraft>(() =>
    emptyRequestDraft(users[0]),
  );
  const requestDraftDirty = useRef(false);
  const requestDraftRevision = useRef(0);
  const [requestDraftHydrated, setRequestDraftHydrated] = useState(false);
  const [requestDraftSaving, setRequestDraftSaving] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const requestSaveInFlight = useRef(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState("");
  const [requestList, setRequestList] = useState<ApiRequestRecord[]>([]);
  const [requestListCursor, setRequestListCursor] = useState<string | null>(null);
  const [requestListHasMore, setRequestListHasMore] = useState(false);
  const [requestListLoading, setRequestListLoading] = useState(false);
  const [requestListLoadingMore, setRequestListLoadingMore] = useState(false);
  const [requestListError, setRequestListError] = useState(false);
  const [requestListContext, setRequestListContext] = useState("");
  const [requestListReload, setRequestListReload] = useState(0);
  const requestListGeneration = useRef(0);
  const requestListBusy = useRef(false);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLoadingMore, setAuditLoadingMore] = useState(false);
  const [auditError, setAuditError] = useState(false);
  const [auditReload, setAuditReload] = useState(0);
  const auditGeneration = useRef(0);
  const auditBusy = useRef(false);
  const [approvalTasks, setApprovalTasks] = useState<Task[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<RequestApprovalItem[]>([]);
  const [requestApprovalQueueState, setRequestApprovalQueueState] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsUnavailable, setRequestsUnavailable] = useState(false);
  const [ideaNextOffset, setIdeaNextOffset] = useState<number | null>(null);
  const [ideasOwnerId, setIdeasOwnerId] = useState<string | null>(null);
  const [loadingMoreIdeas, setLoadingMoreIdeas] = useState(false);
  const [ideaListStatus, setIdeaListStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [ideaSearch, setIdeaSearch] = useState("");
  const [listSorts, setListSorts] = useState<Record<string, string>>({});
  const requestSort = listSorts[page] ?? DEFAULT_LIST_SORT;
  const ideaSort = listSorts.ideas ?? DEFAULT_LIST_SORT;
  const auditSort = listSorts.history ?? DEFAULT_LIST_SORT;
  const [ideaStatusFilter, setIdeaStatusFilter] = useState("");
  const latestIdeaFilters = useRef({
    search: ideaSearch,
    status: ideaStatusFilter,
    sort: ideaSort,
  });
  const changeIdeaFilters = (search: string, status: "all" | IdeaStatus) => {
    const nextStatus = status === "all" ? "" : status.toUpperCase();
    latestIdeaFilters.current = { search, status: nextStatus, sort: ideaSort };
    setIdeaListStatus("loading");
    setIdeaNextOffset(null);
    setIdeaSearch(search);
    setIdeaStatusFilter(nextStatus);
  };
  const [messageHouseStatus, setMessageHouseStatus] = useState<
    "loading" | "empty" | "loaded" | "error"
  >("loading");
  const [messageHouseHistory, setMessageHouseHistory] = useState<CurrentMessageHouse[]>(
    [],
  );
  const [messageHouseHistoryStatus, setMessageHouseHistoryStatus] = useState<
    "loading" | "loaded" | "error"
  >("loading");
  const canonicalRefreshGeneration = useRef(0);
  useEffect(() => {
    if (!actor?.userId) return;
    const generation = canonicalRefreshGeneration.current;
    const controller = new AbortController();
    fetchScopedRequestRecords(controller.signal)
      .then((records) => {
        if (
          controller.signal.aborted ||
          generation !== canonicalRefreshGeneration.current
        )
          return;
        setRequestsUnavailable(false);
        startTransition(() => {
          if (!controller.signal.aborted)
            setState((previous) => ({
              ...previous,
              requests: records
                .filter((record) => !record.assignedTaskOnly)
                .map(mapRequestRecord),
              tasks: mapRequestTasks(records),
            }));
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setRequestsUnavailable(true);
        setNotice("Unable to load server requests");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingRequests(false);
      });
    return () => controller.abort();
  }, [actor?.userId]);
  const requestMode =
    page === "my-requests" ? "mine" : page === "requests" ? "all" : null;
  const requestAuthorityKey = JSON.stringify({
    userId: actor?.userId,
    grants: actor?.roleGrants
      ?.map((grant) => `${grant.role}:${grant.departmentId ?? "org"}`)
      .sort(),
    role: actor?.role,
  });
  const requestContextKey = JSON.stringify({
    authority: requestAuthorityKey,
    mode: requestMode,
    search: requestSearch.trim(),
    status: requestStatusFilter,
    sort: requestSort,
  });
  const visibleRequestList = requestListContext === requestContextKey ? requestList : [];
  useEffect(() => {
    if (!actor?.userId || !requestMode) return;
    const generation = ++requestListGeneration.current;
    const generationRef = requestListGeneration;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({ take: "100" });
      query.set("sort", requestSort);
      if (requestMode === "mine") query.set("mine", "true");
      if (requestSearch.trim()) query.set("q", requestSearch.trim());
      if (requestStatusFilter) query.set("status", requestStatusFilter);
      setRequestListLoading(true);
      setRequestListError(false);
      void fetch(`/api/pr-center/requests?${query}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Request list unavailable");
          const records = (await response.json()) as ApiRequestRecord[];
          if (generation !== requestListGeneration.current || controller.signal.aborted)
            return;
          const pageRecords = records.slice(0, 100);
          setRequestListContext(requestContextKey);
          setRequestList(pageRecords);
          setRequestListCursor(pageRecords.at(-1)?.id ?? null);
          setRequestListHasMore(records.length > 100);
        })
        .catch(() => {
          if (generation === requestListGeneration.current && !controller.signal.aborted)
            setRequestListError(true);
        })
        .finally(() => {
          if (generation === requestListGeneration.current && !controller.signal.aborted)
            setRequestListLoading(false);
        });
    }, 250);
    return () => {
      ++generationRef.current;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    actor?.userId,
    requestMode,
    requestSearch,
    requestStatusFilter,
    requestListReload,
    requestContextKey,
    requestSort,
  ]);
  const changeRequestFilters = (search: string, status: string) => {
    ++requestListGeneration.current;
    setRequestList([]);
    setRequestListCursor(null);
    setRequestListHasMore(false);
    setRequestListLoading(true);
    setRequestSearch(search.slice(0, 120));
    setRequestStatusFilter(status);
  };
  const refreshRequestList = async () => {
    ++requestListGeneration.current;
    setRequestList([]);
    setRequestListCursor(null);
    setRequestListHasMore(false);
    setRequestListLoading(true);
    await refreshRequests();
  };
  const loadMoreRequestList = async () => {
    if (
      !requestListCursor ||
      !requestListHasMore ||
      requestListBusy.current ||
      requestListLoading
    )
      return;
    requestListBusy.current = true;
    setRequestListLoadingMore(true);
    const generation = requestListGeneration.current;
    const query = new URLSearchParams({ take: "100", cursor: requestListCursor });
    query.set("sort", requestSort);
    if (requestMode === "mine") query.set("mine", "true");
    if (requestSearch.trim()) query.set("q", requestSearch.trim());
    if (requestStatusFilter) query.set("status", requestStatusFilter);
    try {
      const response = await fetch(`/api/pr-center/requests?${query}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to load more requests");
      const records = (await response.json()) as ApiRequestRecord[];
      if (generation !== requestListGeneration.current) return;
      const pageRecords = records.slice(0, 100);
      setRequestList((previous) => [
        ...previous,
        ...pageRecords.filter(
          (item) => !previous.some((existing) => existing.id === item.id),
        ),
      ]);
      setRequestListCursor(pageRecords.at(-1)?.id ?? null);
      setRequestListHasMore(records.length > 100);
    } catch {
      if (generation === requestListGeneration.current) setRequestListError(true);
    } finally {
      requestListBusy.current = false;
      if (generation === requestListGeneration.current) setRequestListLoadingMore(false);
    }
  };
  useEffect(() => {
    const roleGrants = actor?.roles?.length ? actor.roles : actor ? [actor.role] : [];
    if (
      !roleGrants.some((role) =>
        ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"].includes(role),
      ) ||
      page !== "approvals"
    )
      return;
    fetch("/api/pr-center/approvals", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Approval queue unavailable");
        const items = (await response.json()) as TaskApprovalRecord[];
        setApprovalTasks(items.map(mapTaskApprovalRecord));
      })
      .catch(() => setNotice("Unable to load approval queue"));
  }, [actor, page]);
  useEffect(() => {
    const roleGrants = actor?.roles?.length ? actor.roles : actor ? [actor.role] : [];
    if (page !== "approvals") return;
    if (
      !roleGrants.some((role) => ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"].includes(role))
    )
      return;
    const controller = new AbortController();
    fetch("/api/pr-center/request-approvals", {
      credentials: "same-origin",
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Request approval queue unavailable");
        const requests = (await response.json()) as RequestApprovalItem[];
        setApprovalRequests(requests);
        setRequestApprovalQueueState("loaded");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setRequestApprovalQueueState("error");
        setNotice("Unable to load submitted request approvals");
      });
    return () => controller.abort();
  }, [actor, page]);
  useEffect(() => {
    latestActorId.current = actor?.userId;
  }, [actor?.userId]);
  useEffect(() => {
    if (!actor?.userId) return;
    const controller = new AbortController();
    fetchIdeaPage(0, ideaSearch, ideaStatusFilter, controller.signal, ideaSort)
      .then((page) => {
        if (controller.signal.aborted) return;
        setState((previous) => ({ ...previous, ideas: page.items.map(mapIdeaRecord) }));
        setIdeasOwnerId(actor.userId);
        setIdeaNextOffset(page.nextOffset);
        setIdeaListStatus("loaded");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setIdeaListStatus("error");
        setNotice("Unable to load Content Ideas");
      });
    return () => controller.abort();
  }, [actor?.userId, ideaSearch, ideaStatusFilter, ideaSort]);
  useEffect(() => {
    if (!actor?.userId) return;
    let disposed = false;
    let activeController: AbortController | null = null;
    const loadNotifications = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        const response = await fetch("/api/pr-center/notifications", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Notifications unavailable");
        const notifications = (await response.json()) as Array<{
          id: string;
          userId: string;
          title: string;
          body: string;
          target: string | null;
          readAt: string | null;
          createdAt: string;
        }>;
        if (disposed || controller.signal.aborted) return;
        setState((previous) => ({
          ...previous,
          notifications: notifications.map((notification) => ({
            id: notification.id,
            userId: notification.userId,
            title: notification.title,
            message: notification.body,
            target: notification.target || "home",
            createdAt: notification.createdAt,
            read: Boolean(notification.readAt),
          })),
        }));
      } catch {
        if (!disposed && !controller.signal.aborted)
          setNotice("Unable to refresh notifications");
      }
    };
    const refreshWhenVisible = () => void loadNotifications();
    void loadNotifications();
    const timer = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      disposed = true;
      activeController?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [actor?.userId]);
  useEffect(() => {
    if (!actor?.userId) return;
    let cancelled = false;
    fetch("/api/pr-center/master-data", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Master data unavailable");
        const value = (await response.json()) as Partial<MasterData>;
        if (
          !Array.isArray(value.channels) ||
          !Array.isArray(value.contentTypes) ||
          !Array.isArray(value.contentPillars) ||
          !Array.isArray(value.departments)
        )
          throw new Error("Master data response is invalid");
        if (cancelled) return;
        setState((previous) => ({
          ...previous,
          masterData: {
            channels: value.channels!,
            contentTypes: value.contentTypes!,
            contentPillars: value.contentPillars!,
            departments: value.departments!,
            approvalStages: Array.isArray(value.approvalStages)
              ? value.approvalStages
              : previous.masterData.approvalStages,
          },
        }));
      })
      .catch(() => {
        if (!cancelled) setNotice("Unable to load PR Center master data");
      });
    return () => {
      cancelled = true;
    };
  }, [actor?.userId]);
  const mapAuditRecord = (entry: {
    id: string;
    actorId: string | null;
    actor?: { displayName: string } | null;
    entityType: string;
    entityId: string;
    action: string;
    createdAt: string;
  }): AuditEntry => ({
    id: entry.id,
    actorId: entry.actorId || "system",
    actorName: entry.actor?.displayName,
    entity: ["request", "task", "notification"].includes(entry.entityType)
      ? (entry.entityType as AuditEntry["entity"])
      : "system",
    entityId: entry.entityId,
    action: entry.action,
    before: "",
    after: "",
    createdAt: entry.createdAt,
  });
  useEffect(() => {
    if (!actor?.userId || page !== "history") return;
    const generation = ++auditGeneration.current;
    const generationRef = auditGeneration;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setAuditLoading(true);
        setAuditError(false);
      }
    });
    fetch(
      `/api/pr-center/audit?${new URLSearchParams({ take: "100", sort: auditSort })}`,
      {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Audit history unavailable");
        const records = (await response.json()) as Array<
          Parameters<typeof mapAuditRecord>[0]
        >;
        if (controller.signal.aborted || generation !== auditGeneration.current) return;
        const pageRecords = records.slice(0, 100);
        setState((previous) => ({ ...previous, audit: pageRecords.map(mapAuditRecord) }));
        setAuditCursor(pageRecords.at(-1)?.id ?? null);
        setAuditHasMore(records.length > 100);
      })
      .catch(() => {
        if (!controller.signal.aborted && generation === auditGeneration.current)
          setAuditError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted && generation === auditGeneration.current)
          setAuditLoading(false);
      });
    return () => {
      ++generationRef.current;
      controller.abort();
    };
  }, [actor?.userId, page, auditReload, auditSort]);
  const loadMoreAudit = async () => {
    if (!auditCursor || !auditHasMore || auditBusy.current || auditLoading) return;
    auditBusy.current = true;
    setAuditLoadingMore(true);
    const generation = auditGeneration.current;
    try {
      const query = new URLSearchParams({ take: "100", cursor: auditCursor });
      query.set("sort", auditSort);
      const response = await fetch(`/api/pr-center/audit?${query}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Audit history unavailable");
      const records = (await response.json()) as Array<
        Parameters<typeof mapAuditRecord>[0]
      >;
      if (generation !== auditGeneration.current) return;
      const pageRecords = records.slice(0, 100);
      setState((previous) => ({
        ...previous,
        audit: [
          ...previous.audit,
          ...pageRecords
            .map(mapAuditRecord)
            .filter(
              (item) => !previous.audit.some((existing) => existing.id === item.id),
            ),
        ],
      }));
      setAuditCursor(pageRecords.at(-1)?.id ?? null);
      setAuditHasMore(records.length > 100);
      setAuditError(false);
    } catch {
      if (generation === auditGeneration.current) setAuditError(true);
    } finally {
      auditBusy.current = false;
      if (generation === auditGeneration.current) setAuditLoadingMore(false);
    }
  };

  const currentUser: User = actor
    ? {
        id: actor.userId,
        name: actor.displayName,
        role: DISPLAY_ROLE_BY_PR_ROLE[actor.role],
        department: actor.departmentName,
        active: true,
      }
    : (getUser(state.currentUserId) ?? users[0]);
  const actorUiRoles: Role[] = actor
    ? [
        ...new Set(
          (actor.roles?.length ? actor.roles : [actor.role]).map(
            (role) => DISPLAY_ROLE_BY_PR_ROLE[role],
          ),
        ),
      ]
    : [currentUser.role];
  const actorRoleCodes = actor?.roles?.length ? actor.roles : actor ? [actor.role] : [];
  const canReadOtherRequests = actorRoleCodes.some((role) =>
    ["RTRDA_PR", "RTRDA_BORD", "RTRDA_ADMIN"].includes(role),
  );
  const visibleRolePages = [
    ...new Set([
      ...actorUiRoles.flatMap((role) => ROLE_PAGES[role]),
      ...(canReadOtherRequests ? (["requests"] as Page[]) : []),
    ]),
  ];
  const hasUiRole = (...roles: Role[]) =>
    actorUiRoles.some((role) => roles.includes(role));
  const visiblePages = pages.filter(
    (item) => isPageEnabled(item.id) && visibleRolePages.includes(item.id),
  );
  useEffect(() => {
    if (!actor?.userId || !requestOpen || requestEditId) return;
    let cancelled = false;
    fetch("/api/pr-center/drafts/REQUEST", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Request draft unavailable");
        return response.json();
      })
      .then((result) => {
        if (cancelled || requestDraftDirty.current || !result?.payload) return;
        setRequestDraft({
          ...emptyRequestDraft({
            name: currentUser.name,
            department: currentUser.department,
          }),
          ...result.payload,
          samples: [],
        });
      })
      .catch(() => {
        if (!cancelled)
          setNotice(
            state.language === "th"
              ? "ไม่สามารถโหลดร่างคำขอที่บันทึกไว้ได้"
              : "Unable to load the saved request draft.",
          );
      })
      .finally(() => {
        if (!cancelled) setRequestDraftHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    actor?.userId,
    currentUser.department,
    currentUser.id,
    currentUser.name,
    requestEditId,
    requestOpen,
    state.language,
  ]);

  useEffect(() => {
    if (
      !actor?.userId ||
      !requestOpen ||
      requestEditId ||
      !requestDraftHydrated ||
      !requestDraftDirty.current
    )
      return;
    const revision = requestDraftRevision.current;
    const timer = window.setTimeout(() => {
      const payload = JSON.parse(
        JSON.stringify(requestDraft, (key, value) =>
          key === "samples" ? undefined : value,
        ),
      );
      setRequestDraftSaving(true);
      void fetch("/api/pr-center/drafts/REQUEST", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Request draft could not be saved");
          if (revision === requestDraftRevision.current)
            requestDraftDirty.current = false;
        })
        .catch(() => {
          setNotice(
            state.language === "th"
              ? "บันทึกร่างคำขอไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ"
              : "Request draft could not be saved. Check your connection.",
          );
        })
        .finally(() => setRequestDraftSaving(false));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    actor?.userId,
    requestDraft,
    requestDraftHydrated,
    requestEditId,
    requestOpen,
    state.language,
  ]);
  const refreshRequests = async () => {
    const generation = ++canonicalRefreshGeneration.current;
    ++requestListGeneration.current;
    setRequestListContext("");
    setRequestListReload((value) => value + 1);
    setLoadingRequests(true);
    try {
      const records = await fetchScopedRequestRecords();
      if (generation !== canonicalRefreshGeneration.current) return;
      setRequestsUnavailable(false);
      setState((previous) => ({
        ...previous,
        requests: records
          .filter((record) => !record.assignedTaskOnly)
          .map(mapRequestRecord),
        tasks: mapRequestTasks(records),
      }));
    } catch {
      if (generation !== canonicalRefreshGeneration.current) return;
      setRequestsUnavailable(true);
      setNotice(
        state.language === "th"
          ? "รีเฟรชสถานะคำขอไม่สำเร็จ"
          : "Unable to refresh request status",
      );
    } finally {
      if (generation === canonicalRefreshGeneration.current) setLoadingRequests(false);
    }
  };
  const t = copy[state.language];
  const userNotifications = state.notifications.filter(
    (item) => item.userId === currentUser.id,
  );
  const unreadCount = userNotifications.filter((item) => !item.read).length;
  const loadMessageHouse = async () => {
    setMessageHouseStatus("loading");
    setMessageHouseHistoryStatus("loading");
    setMessageHouseHistory([]);
    setState((previous) => ({ ...previous, messageHouse: emptyMessageHouse() }));

    try {
      const response = await fetch("/api/pr-center/message-house/current", {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Message House unavailable");
      const current = parseCurrentMessageHouse(await response.json());
      setState((previous) => ({
        ...previous,
        messageHouse: current ? { ...current, pillarByTask: {} } : emptyMessageHouse(),
      }));
      setMessageHouseStatus(current ? "loaded" : "empty");
    } catch {
      setState((previous) => ({ ...previous, messageHouse: emptyMessageHouse() }));
      setMessageHouseStatus("error");
    }

    try {
      const response = await fetch("/api/pr-center/message-house/history", {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Message House history unavailable");
      setMessageHouseHistory(parseMessageHouseHistory(await response.json()));
      setMessageHouseHistoryStatus("loaded");
    } catch {
      setMessageHouseHistory([]);
      setMessageHouseHistoryStatus("error");
    }
  };
  const go = (next: Page) => {
    if (!isPageEnabled(next) || !visibleRolePages.includes(next)) return;
    setPage(next);
    if (next === "message-house") void loadMessageHouse();
    setSidebarOpen(false);
  };
  const navigateFromNotification = (target: string) => {
    const match = /^(request|task|idea):(.+)$/.exec(target);
    if (!match) {
      const page = target as Page;
      go(isPageEnabled(page) && visibleRolePages.includes(page) ? page : "home");
      return;
    }
    const [, entity, id] = match;
    const page: Page =
      entity === "request"
        ? hasUiRole("pr", "admin")
          ? "requests"
          : "my-requests"
        : entity === "task"
          ? "operations"
          : "ideas";
    if (!visibleRolePages.includes(page)) {
      go("home");
      return;
    }
    setPage(page);
    setSidebarOpen(false);
    window.setTimeout(() => {
      document.getElementById(`${entity}-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  };

  const openRequest = () => {
    setRequestEditId(null);
    setRequestDraft(emptyRequestDraft(currentUser));
    requestDraftDirty.current = false;
    requestDraftRevision.current = 0;
    setRequestDraftHydrated(!actor);
    setRequestOpen(true);
  };
  const editRequest = (request: Request) => {
    setRequestEditId(request.id);
    setRequestDraftHydrated(true);
    requestDraftDirty.current = false;
    setRequestDraft({
      ...emptyRequestDraft(currentUser),
      type: request.type,
      title: request.title,
      requestedDate: request.requestedDate,
      source: request.sources?.join("\n") || request.source || "",
      objective: request.objective || "",
      audience: request.audience || "",
      owner: request.projectOwner || currentUser.name,
      assigner: request.assigner || "",
      whyNow: request.whyNow || "",
      contentTypes: request.contentTypes || ["Website News"],
      priority: request.priority || "NORMAL",
      priorityReason: request.priorityReason || "",
      projectDetails: request.projectDetails || "",
      confirmed: request.confirmed === true,
      startTime: request.startTime || "",
      endTime: request.endTime || "",
      travel: request.travel || "RTRDA transport confirmed",
    });
    setRequestOpen(true);
  };

  const announce = (message: string) => setNotice(message);
  const updateState = (updater: (previous: PrCenterState) => PrCenterState) =>
    setState(updater);
  const addAudit = (
    previous: PrCenterState,
    entity: AuditEntry["entity"],
    entityId: string,
    action: string,
    before: string,
    after: string,
  ): PrCenterState => ({
    ...previous,
    audit: [
      ...previous.audit,
      {
        id: `AUD-${previous.audit.length + 1}`,
        actorId: currentUser.id,
        entity,
        entityId,
        action,
        before,
        after,
        createdAt: new Date().toISOString(),
      },
    ],
  });
  const refreshNotifications = async () => {
    const response = await fetch("/api/pr-center/notifications", {
      credentials: "same-origin",
    });
    if (!response.ok) return;
    const notifications = (await response.json()) as Array<{
      id: string;
      userId: string;
      title: string;
      body: string;
      target: string | null;
      readAt: string | null;
      createdAt: string;
    }>;
    setState((previous) => ({
      ...previous,
      notifications: notifications.map((notification) => ({
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.body,
        target: notification.target || "home",
        createdAt: notification.createdAt,
        read: Boolean(notification.readAt),
      })),
    }));
  };
  const createRequest = async (
    draft: RequestDraft,
    editId = requestEditId,
    submitAfterSave = false,
  ) => {
    if (requestSaveInFlight.current) return;
    if (
      !draft.confirmed ||
      (draft.type === "pr" &&
        (!draft.whyNow.trim() ||
          draft.contentTypes.length === 0 ||
          !draft.priority ||
          !draft.objective.trim() ||
          !draft.audience.trim())) ||
      (draft.type === "offsite" &&
        (!draft.startTime || !draft.endTime || draft.endTime <= draft.startTime))
    ) {
      announce(
        state.language === "th"
          ? "กรุณากรอกข้อมูลที่จำเป็นและยืนยันความถูกต้องก่อนบันทึก"
          : "Complete the required fields and confirm the information before saving.",
      );
      return;
    }
    const priorStatus = editId
      ? state.requests.find((request) => request.id === editId)?.status
      : undefined;
    requestSaveInFlight.current = true;
    setRequestSubmitting(true);
    try {
      const response = await fetch(
        editId ? `/api/pr-center/requests/${editId}` : "/api/pr-center/requests",
        {
          method: editId ? "PATCH" : "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            ...(editId
              ? {
                  "If-Match": String(
                    state.requests.find((request) => request.id === editId)?.version ?? 0,
                  ),
                }
              : {}),
          },
          body: JSON.stringify({
            type: draft.type.toUpperCase(),
            title: draft.title,
            objective: draft.objective,
            audience: draft.audience,
            offsiteDetails:
              draft.type === "offsite"
                ? {
                    startTime: draft.startTime,
                    endTime: draft.endTime,
                    travel: draft.travel,
                  }
                : undefined,
            requestDetails: {
              projectOwner: draft.owner,
              assigner: draft.assigner,
              whyNow: draft.whyNow,
              contentTypes: draft.type === "pr" ? draft.contentTypes : [],
              priorityReason: draft.priorityReason,
              projectDetails: draft.projectDetails,
              confirmed: draft.confirmed,
            },
            priority: draft.priority,
            priorityReason: draft.priorityReason,
            requestedFor: draft.requestedDate || undefined,
            sourceUrls: draft.source
              .split(/\n+/)
              .map((url) => url.trim())
              .filter(Boolean),
          }),
        },
      );
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(result?.message || "Request could not be saved");
      }
      const updated = (await response.json()) as {
        id: string;
        title: string;
        type: "PR" | "OFFSITE";
        requesterId: string;
        status: Request["status"];
        version: number;
        requestedFor: string | null;
        priority: string;
        priorityReason: string | null;
        department?: { name: string };
        revisions: Array<{
          revisionNumber: number;
          objective: string | null;
          audience: string | null;
          offsiteDetails: unknown;
        }>;
        sources: { url: string }[];
        tasks: Array<{
          id: string;
          title: string;
          contentType: string;
          status: string;
          ownerId: string | null;
          dueAt: string | null;
          planningKeyMessage: string | null;
          version: number;
        }>;
      };
      let samplesUploaded = true;
      const failedSamples: File[] = [];
      const uploadedSamples: NonNullable<Request["attachments"]> = [];
      for (const file of draft.samples) {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = "";
          for (let offset = 0; offset < bytes.length; offset += 0x8000)
            binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
          const uploadResponse = await fetch("/api/pr-center/files", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              content: btoa(binary),
            }),
          });
          if (!uploadResponse.ok) throw new Error("File upload failed");
          const uploaded = (await uploadResponse.json()) as { id: string };
          const attachResponse = await fetch("/api/pr-center/attachments", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileId: uploaded.id,
              requestId: updated.id,
              kind: "request-sample",
            }),
          });
          if (!attachResponse.ok) throw new Error("File attachment failed");
          uploadedSamples.push(await attachResponse.json());
        } catch {
          samplesUploaded = false;
          failedSamples.push(file);
        }
      }
      let submitError: string | null = null;
      if (submitAfterSave && samplesUploaded) {
        try {
          const submitResponse = await fetch(
            `/api/pr-center/requests/${updated.id}/transitions`,
            {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "Content-Type": "application/json",
                "If-Match": String(updated.version),
              },
              body: JSON.stringify({ to: "SUBMITTED" }),
            },
          );
          if (!submitResponse.ok) {
            const result = (await submitResponse.json().catch(() => null)) as {
              message?: string;
            } | null;
            throw new Error(result?.message || "Submission rejected");
          }
          const submitted = (await submitResponse.json()) as {
            status: Request["status"];
            version: number;
          };
          updated.status = submitted.status;
          updated.version = submitted.version;
        } catch (error) {
          submitError = error instanceof Error ? error.message : "Submission rejected";
        }
      }
      const mappedRequest: Request = {
        id: updated.id,
        title: updated.title,
        type: updated.type.toLowerCase() as RequestType,
        requesterId: updated.requesterId,
        department: updated.department?.name || currentUser.department,
        requestedDate: updated.requestedFor?.slice(0, 10) || "",
        taskIds: updated.tasks.map((task) => task.id),
        source: updated.sources[0]?.url,
        sources: updated.sources.map((source) => source.url),
        attachments: uploadedSamples,
        status: updated.status,
        version: updated.version,
        priority: updated.priority,
        priorityReason: updated.priorityReason || undefined,
        revisionNumber: updated.revisions[0]?.revisionNumber,
        objective: updated.revisions[0]?.objective || undefined,
        audience: updated.revisions[0]?.audience || undefined,
        ...(() => {
          const details = updated.revisions[0]?.offsiteDetails;
          if (!details || typeof details !== "object" || Array.isArray(details))
            return {};
          const fields = details as Record<string, unknown>;
          return {
            startTime:
              typeof fields.startTime === "string" ? fields.startTime : undefined,
            endTime: typeof fields.endTime === "string" ? fields.endTime : undefined,
            travel: typeof fields.travel === "string" ? fields.travel : undefined,
            projectOwner:
              typeof fields.projectOwner === "string" ? fields.projectOwner : undefined,
            assigner: typeof fields.assigner === "string" ? fields.assigner : undefined,
            whyNow: typeof fields.whyNow === "string" ? fields.whyNow : undefined,
            contentTypes: Array.isArray(fields.contentTypes)
              ? fields.contentTypes.filter(
                  (item): item is string => typeof item === "string",
                )
              : undefined,
            projectDetails:
              typeof fields.projectDetails === "string"
                ? fields.projectDetails
                : undefined,
            confirmed: fields.confirmed === true,
          };
        })(),
      };
      setState((previous) => ({
        ...previous,
        requests: [
          mappedRequest,
          ...previous.requests.filter((request) => request.id !== updated.id),
        ],
        tasks: [
          ...updated.tasks.map((task) => ({
            id: task.id,
            requestId: updated.id,
            requestStatus: updated.status,
            type: task.contentType,
            title: task.title,
            status: task.status.toLowerCase() as StatusId,
            ownerId: task.ownerId || currentUser.id,
            ownerName: currentUser.name,
            dueDate: task.dueAt?.slice(0, 10) || "",
            planningKeyMessage: task.planningKeyMessage || undefined,
            version: task.version,
            revisionNumber: undefined,
          })),
          ...previous.tasks.filter(
            (task) => !updated.tasks.some((nextTask) => nextTask.id === task.id),
          ),
        ],
      }));
      void refreshRequests();
      if (!samplesUploaded || submitError) {
        // The request is durable, but the requested workflow did not finish.
        // Keep the form open as an edit of that draft so a retry does not
        // create another request or upload files that already attached.
        setRequestEditId(updated.id);
        setRequestDraft((previous) => ({ ...previous, samples: failedSamples }));
        announce(
          !samplesUploaded
            ? state.language === "th"
              ? "บันทึกฉบับร่างแล้ว แต่แนบไฟล์ไม่ครบ จึงยังไม่ได้ส่งคำขอ กรุณาลองแนบไฟล์ที่เหลืออีกครั้ง"
              : "Draft saved but some attachments failed. The request was not submitted; retry the remaining files."
            : `${state.language === "th" ? "บันทึกฉบับร่างแล้ว แต่ส่งไม่สำเร็จ" : "Draft saved but submission failed"}: ${submitError}`,
        );
        return;
      }
      if (!editId) {
        await fetch("/api/pr-center/drafts/REQUEST", {
          method: "DELETE",
          credentials: "same-origin",
        }).catch(() => undefined);
        requestDraftDirty.current = false;
      }
      setRequestEditId(null);
      setRequestOpen(false);
      await refreshNotifications().catch(() => undefined);
      announce(
        !samplesUploaded
          ? state.language === "th"
            ? "บันทึกฉบับร่างแล้ว แต่แนบไฟล์ไม่ครบ จึงยังไม่ได้ส่งคำขอ กรุณาตรวจไฟล์แนบและส่งจากรายละเอียดคำขอ"
            : "Draft saved, but some files could not be attached. Not submitted; check attachments and submit from request details."
          : submitError
            ? `${state.language === "th" ? "บันทึกฉบับร่างแล้ว แต่ส่งไม่สำเร็จ" : "Draft saved, but submission failed"}: ${submitError}`
            : submitAfterSave
              ? state.language === "th"
                ? "บันทึกไฟล์แนบและส่งคำขอเข้าคิวอนุมัติแล้ว"
                : "Attachments saved and request submitted for approval"
              : state.language === "th"
                ? editId
                  ? priorStatus && priorStatus !== "DRAFT"
                    ? "บันทึก revision ใหม่เป็นฉบับร่างแล้ว กรุณาตรวจรายละเอียดและส่งคำขออีกครั้ง"
                    : "บันทึกการแก้ไขคำขอแล้ว"
                  : "บันทึกคำขอเป็นฉบับร่างแล้ว"
                : editId
                  ? priorStatus && priorStatus !== "DRAFT"
                    ? "Revision saved as a draft. Review the details and submit the request again."
                    : "Request changes saved"
                  : "Request saved as draft",
      );
      setPage("my-requests");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Request could not be saved");
    } finally {
      requestSaveInFlight.current = false;
      setRequestSubmitting(false);
    }
  };

  const createTaskRevision = async (
    taskId: string,
    body: string,
    keyMessage: string,
    changeSummary: string,
  ): Promise<boolean> => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task?.version) return false;
    try {
      const response = await fetch(`/api/pr-center/tasks/${taskId}/revisions`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(task.version),
        },
        body: JSON.stringify({ body, keyMessage, changeSummary }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(result?.message || "Task revision could not be saved");
      }
      const revision = (await response.json()) as {
        revisionNumber: number;
        body: string | null;
        keyMessage: string | null;
      };
      setState((previous) => ({
        ...previous,
        tasks: previous.tasks.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status: "in_production",
                version: task.version! + 1,
                revisionNumber: revision.revisionNumber,
                contentBody: revision.body || undefined,
                keyMessage: revision.keyMessage || undefined,
                finalAssetId: null,
              }
            : item,
        ),
      }));
      announce(state.language === "th" ? "บันทึกฉบับเนื้อหาแล้ว" : "Task revision saved");
      return true;
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "Task revision could not be saved",
      );
      return false;
    }
  };
  const submitRequest = async (request: Request) => {
    if (!request.version) return announce("Refresh this request before submitting.");
    try {
      const response = await fetch(`/api/pr-center/requests/${request.id}/transitions`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(request.version),
        },
        body: JSON.stringify({ to: "SUBMITTED" }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(result?.message || "Request could not be submitted");
      }
      const updated = (await response.json()) as {
        status: Request["status"];
        version: number;
      };
      setState((previous) => ({
        ...previous,
        requests: previous.requests.map((item) =>
          item.id === request.id
            ? { ...item, status: updated.status, version: updated.version }
            : item,
        ),
      }));
      void refreshRequests();
      await refreshNotifications().catch(() => undefined);
      announce(
        state.language === "th"
          ? "ส่งคำขอเข้าคิวอนุมัติของ PR/Admin แล้ว"
          : "Request sent to the PR/Admin approval queue",
      );
    } catch (error) {
      announce(error instanceof Error ? error.message : "Request could not be submitted");
    }
  };
  const withdrawRequest = async (request: Request) => {
    if (!request.version) return announce("Refresh this request before withdrawing.");
    if (
      !window.confirm(
        state.language === "th"
          ? "ยืนยันถอนคำขอนี้หรือไม่ งานร่างที่เกี่ยวข้องจะถูกยกเลิก"
          : "Withdraw this request? Its draft tasks will be cancelled.",
      )
    )
      return;
    try {
      const response = await fetch(`/api/pr-center/requests/${request.id}/transitions`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(request.version),
        },
        body: JSON.stringify({ to: "WITHDRAWN" }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(result?.message || "Request could not be withdrawn");
      }
      await refreshRequests();
      announce(state.language === "th" ? "ถอนคำขอแล้ว" : "Request withdrawn");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Request could not be withdrawn");
    }
  };
  const transitionTask = async (taskId: string, nextStatus: StatusId) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    try {
      const response = await fetch(`/api/pr-center/tasks/${taskId}/transitions`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(task.version ?? 0),
        },
        body: JSON.stringify({ to: nextStatus.toUpperCase() }),
      });
      if (!response.ok) throw new Error("Transition rejected");
      const updated = (await response.json()) as { status: string; version: number };
      setState((previous) => ({
        ...previous,
        tasks: previous.tasks.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status: updated.status.toLowerCase() as StatusId,
                version: updated.version,
              }
            : item,
        ),
      }));
      announce(
        updated.status === "CLOSED"
          ? state.language === "th"
            ? "ปิดงานแล้ว"
            : "Task closed"
          : state.language === "th"
            ? "เปลี่ยนสถานะงานแล้ว"
            : "Task status updated",
      );
    } catch {
      announce(
        state.language === "th"
          ? "ไม่สามารถเปลี่ยนสถานะงานได้"
          : "Task transition failed",
      );
    }
  };
  const recordApproval = async (
    taskId: string,
    decision: "APPROVED" | "REVISION_REQUIRED" | "REJECTED",
    reviewChecklist?: EditorialReviewChecklist,
  ) => {
    const task = approvalTasks.find((item) => item.id === taskId);
    if (!task?.version) return;
    const comment =
      decision === "APPROVED"
        ? ""
        : window
            .prompt(
              state.language === "th"
                ? "ระบุเหตุผลสำหรับการขอแก้ไข/ปฏิเสธ"
                : "Enter a reason for requesting revision or rejecting",
            )
            ?.trim() || "";
    if (decision !== "APPROVED" && !comment) return;
    try {
      const response = await fetch(`/api/pr-center/tasks/${taskId}/approvals`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "If-Match": String(task.version) },
        body: JSON.stringify({
          decision,
          ...(comment ? { comment } : {}),
          ...(reviewChecklist ? { reviewChecklist } : {}),
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(result?.message || "Approval decision failed");
      }
      setApprovalTasks((previous) => previous.filter((item) => item.id !== taskId));
      announce(
        state.language === "th" ? "บันทึกผลอนุมัติแล้ว" : "Approval decision saved",
      );
      await refreshRequests();
      try {
        const queueResponse = await fetch("/api/pr-center/approvals", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (queueResponse.ok) {
          const nextTasks = (await queueResponse.json()) as TaskApprovalRecord[];
          setApprovalTasks(nextTasks.map(mapTaskApprovalRecord));
        }
      } catch {
        announce(
          state.language === "th"
            ? "บันทึกผลแล้ว แต่รีเฟรชคิวไม่สำเร็จ กรุณาเปิดคิวอีกครั้ง"
            : "Decision saved, but the queue could not refresh. Reopen the queue.",
        );
      }
    } catch (error) {
      announce(error instanceof Error ? error.message : "Approval decision failed");
    }
  };
  const recordRequestDecision = async (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
    comment: string,
  ): Promise<boolean> => {
    const request = approvalRequests.find((item) => item.id === requestId);
    if (!request) return false;
    const reason = comment.trim();
    if (decision === "REJECTED" && !reason) return false;
    try {
      const response = await fetch(`/api/pr-center/requests/${requestId}/decisions`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(request.version),
        },
        body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(result?.message || "Request decision could not be saved");
      }
      await response.json();
      setApprovalRequests((previous) => previous.filter((item) => item.id !== requestId));
      await refreshRequests();
      await refreshNotifications().catch(() => undefined);
      announce(
        decision === "APPROVED"
          ? state.language === "th"
            ? "อนุมัติคำขอแล้ว และส่งกลับให้ทีม PR จัดเจ้าของงาน/วางแผน"
            : "Request approved and returned to PR Operations for assignment and planning"
          : state.language === "th"
            ? "ปฏิเสธคำขอแล้ว พร้อมแจ้งเหตุผลให้ผู้ส่งคำขอ"
            : "Request rejected; the requester has been notified with the reason",
      );
      return true;
    } catch (error) {
      announce(error instanceof Error ? error.message : "Request decision failed");
      return false;
    }
  };
  const scheduleTask = async (
    taskId: string,
    channel: string,
    scheduledFor: string,
  ): Promise<boolean> => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return false;
    const scheduledForIso = bangkokLocalDateTimeToISOString(scheduledFor);
    if (!scheduledForIso) {
      announce(
        state.language === "th"
          ? "วันเวลาเผยแพร่ไม่ถูกต้อง กรุณาเลือกเวลาไทย"
          : "Invalid publication time. Select a valid Asia/Bangkok time.",
      );
      return false;
    }
    if (Date.parse(scheduledForIso) <= Date.now()) {
      announce(
        state.language === "th"
          ? "ต้องตั้งเวลาเผยแพร่ในอนาคต"
          : "Publication time must be in the future.",
      );
      return false;
    }
    try {
      const response = await fetch(`/api/pr-center/tasks/${taskId}/schedule`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(task.version ?? 0),
        },
        body: JSON.stringify({
          channel,
          scheduledFor: scheduledForIso,
          idempotencyKey: `schedule:${taskId}:${channel}:${scheduledForIso}`,
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          result?.message || "Scheduling failed. Complete the publication gate first.",
        );
      }
      const scheduled = (await response.json()) as { taskVersion: number };
      setState((previous) => ({
        ...previous,
        tasks: previous.tasks.map((item) =>
          item.id === taskId
            ? { ...item, status: "scheduled", version: scheduled.taskVersion }
            : item,
        ),
      }));
      announce(state.language === "th" ? "จัดตารางเผยแพร่แล้ว" : "Task scheduled");
      return true;
    } catch (error) {
      announce(error instanceof Error ? error.message : "Scheduling failed");
      return false;
    }
  };
  const publishTask = async (
    taskId: string,
    channel: string,
    publishedUrl: string,
    publishedReference: string,
  ): Promise<boolean> => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return false;
    try {
      const response = await fetch(`/api/pr-center/tasks/${taskId}/publishing-evidence`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(task.version ?? 0),
        },
        body: JSON.stringify({ publishedUrl, publishedReference, channel }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(result?.message || "Publishing evidence could not be saved");
      }
      const published = (await response.json()) as { taskVersion: number };
      setState((previous) => ({
        ...previous,
        tasks: previous.tasks.map((item) =>
          item.id === taskId
            ? { ...item, status: "published", version: published.taskVersion }
            : item,
        ),
      }));
      announce(
        state.language === "th"
          ? "บันทึกหลักฐานเผยแพร่แล้ว"
          : "Publishing evidence saved",
      );
      return true;
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "Publishing evidence could not be saved",
      );
      return false;
    }
  };
  const assignTask = async (
    taskId: string,
    ownerId: string,
    dueDate: string,
    planningKeyMessage?: string,
    technicalReviewRequired?: boolean,
    managementApprovalRequired?: boolean,
  ) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    try {
      const response = await fetch(`/api/pr-center/tasks/${taskId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(task.version ?? 0),
        },
        body: JSON.stringify({
          ownerId: ownerId || null,
          dueAt: dueDate || null,
          planningKeyMessage,
          ...(technicalReviewRequired !== undefined ? { technicalReviewRequired } : {}),
          ...(managementApprovalRequired !== undefined
            ? { managementApprovalRequired }
            : {}),
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(result?.message || "Task assignment failed");
      }
      const updated = (await response.json()) as {
        ownerId: string | null;
        owner: { displayName: string } | null;
        dueAt: string | null;
        planningKeyMessage: string | null;
        technicalReviewRequired: boolean;
        managementApprovalRequired: boolean;
        version: number;
      };
      setState((previous) => ({
        ...previous,
        tasks: previous.tasks.map((item) =>
          item.id === taskId
            ? {
                ...item,
                ownerId: updated.ownerId || "",
                ownerName: updated.owner?.displayName,
                dueDate: updated.dueAt?.slice(0, 10) || "",
                planningKeyMessage: updated.planningKeyMessage || undefined,
                technicalReviewRequired: updated.technicalReviewRequired,
                managementApprovalRequired: updated.managementApprovalRequired,
                version: updated.version,
              }
            : item,
        ),
      }));
    } catch (error) {
      announce(error instanceof Error ? error.message : "Task assignment failed");
    }
  };
  const createIdea = async (input: CreateContentIdeaInput): Promise<boolean> => {
    try {
      const response = await fetch("/api/pr-center/ideas", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        announce(result?.message || "Idea could not be saved");
        return false;
      }
      const idea = (await response.json()) as {
        id: string;
        title: string;
        rationale: string;
        proposerId: string;
        audience: string | null;
        pillar: string | null;
        channel: string | null;
        priority: string | null;
        campaign: string | null;
        evidenceUrls: unknown;
        status: string;
        version: number;
        createdAt: string;
      };
      setState((previous) => ({
        ...previous,
        ideas: [
          {
            id: idea.id,
            title: idea.title,
            summary: idea.rationale,
            authorId: idea.proposerId || currentUser.id,
            status: idea.status.toLowerCase() as IdeaStatus,
            createdAt: idea.createdAt,
            audience: idea.audience || undefined,
            pillar: idea.pillar || undefined,
            channel: idea.channel || undefined,
            priority: idea.priority || undefined,
            campaign: idea.campaign || undefined,
            evidenceUrls: Array.isArray(idea.evidenceUrls)
              ? idea.evidenceUrls.filter((url): url is string => typeof url === "string")
              : [],
            version: idea.version,
          },
          ...previous.ideas,
        ],
      }));
      announce(state.language === "th" ? "บันทึกแนวคิดแล้ว" : "Idea saved");
      return true;
    } catch {
      announce("Idea could not be saved. Check your connection and try again.");
      return false;
    }
  };
  const updateIdea = async (
    id: string,
    input: CreateContentIdeaInput,
  ): Promise<boolean> => {
    const idea = state.ideas.find((item) => item.id === id);
    if (!idea?.version) return false;
    try {
      const response = await fetch(`/api/pr-center/ideas/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(idea.version),
        },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Idea could not be updated");
      const updated = parseIdeaListPage({ items: [payload], nextOffset: null }).items[0];
      setState((previous) => ({
        ...previous,
        ideas: previous.ideas.map((item) =>
          item.id === id ? mapIdeaRecord(updated) : item,
        ),
      }));
      announce(
        state.language === "th"
          ? "ส่งแนวคิดที่แก้ไขแล้วให้ PR ตรวจสอบ"
          : "Revised idea returned to PR review",
      );
      return true;
    } catch (error) {
      announce(error instanceof Error ? error.message : "Idea could not be updated");
      return false;
    }
  };
  const updateIdeaStatus = async (id: string, status: IdeaStatus) => {
    const idea = state.ideas.find((item) => item.id === id);
    if (!idea?.version) return;
    const requiresReason =
      status === "accepted" || status === "rejected" || status === "revision_required";
    const reason = requiresReason
      ? window
          .prompt(
            status === "rejected"
              ? state.language === "th"
                ? "ระบุเหตุผลในการปฏิเสธแนวคิด ผู้เสนอจะเห็นเหตุผลนี้"
                : "Enter a rejection reason. The proposer will be able to see it."
              : status === "revision_required"
                ? state.language === "th"
                  ? "ระบุข้อมูลที่ต้องแก้ไข ผู้เสนอจะเห็นเหตุผลนี้"
                  : "Explain the revision required. The proposer will see this reason."
                : state.language === "th"
                  ? "ระบุเหตุผลในการยอมรับแนวคิด ผู้เสนอจะเห็นเหตุผลนี้"
                  : "Enter an acceptance rationale. The proposer will be able to see it.",
          )
          ?.trim() || ""
      : "";
    if (requiresReason && !reason) return;
    if (reason.length > 5000)
      return announce(
        state.language === "th"
          ? "เหตุผลยาวเกิน 5,000 ตัวอักษร"
          : "Decision reason must be 5,000 characters or fewer",
      );
    const response = await fetch(`/api/pr-center/ideas/${id}/transitions`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "If-Match": String(idea.version) },
      body: JSON.stringify({
        to: status.toUpperCase(),
        ...(reason ? { reason } : {}),
      }),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        message?: unknown;
      } | null;
      return announce(
        typeof result?.message === "string"
          ? result.message
          : state.language === "th"
            ? "เปลี่ยนสถานะแนวคิดไม่สำเร็จ"
            : "Idea transition failed",
      );
    }
    const updated = (await response.json()) as { status: string; version: number };
    setState((previous) => ({
      ...previous,
      ideas: previous.ideas.map((item) =>
        item.id === id
          ? {
              ...item,
              status: updated.status.toLowerCase() as IdeaStatus,
              decisionReason: requiresReason ? reason : item.decisionReason,
              version: updated.version,
            }
          : item,
      ),
    }));
  };
  const convertIdea = async (id: string) => {
    const idea = state.ideas.find((item) => item.id === id);
    if (!idea?.version) return;
    const response = await fetch(`/api/pr-center/ideas/${id}/convert`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "If-Match": String(idea.version) },
    });
    if (!response.ok) return announce("Idea conversion failed");
    const result = (await response.json()) as {
      request: { id: string };
      task: { id: string } | null;
    };
    setState((previous) => ({
      ...previous,
      ideas: previous.ideas.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "converted",
              requestId: result.request.id,
              version: (item.version || 0) + 1,
            }
          : item,
      ),
    }));
    announce(
      state.language === "th" ? "แปลงแนวคิดเป็นคำขอแล้ว" : "Idea converted to request",
    );
  };
  const refreshIdeas = async () => {
    if (!actor?.userId) return;
    setIdeaListStatus("loading");
    const requestedFilters = {
      search: ideaSearch,
      status: ideaStatusFilter,
      sort: ideaSort,
    };
    try {
      const page = await fetchIdeaPage(
        0,
        requestedFilters.search,
        requestedFilters.status,
        undefined,
        requestedFilters.sort,
      );
      if (
        latestActorId.current !== actor.userId ||
        latestIdeaFilters.current.search !== requestedFilters.search ||
        latestIdeaFilters.current.status !== requestedFilters.status ||
        latestIdeaFilters.current.sort !== requestedFilters.sort
      )
        return;
      setState((previous) => ({ ...previous, ideas: page.items.map(mapIdeaRecord) }));
      setIdeasOwnerId(actor.userId);
      setIdeaNextOffset(page.nextOffset);
      setIdeaListStatus("loaded");
    } catch {
      if (
        latestActorId.current !== actor.userId ||
        latestIdeaFilters.current.search !== requestedFilters.search ||
        latestIdeaFilters.current.status !== requestedFilters.status ||
        latestIdeaFilters.current.sort !== requestedFilters.sort
      )
        return;
      setIdeaListStatus("error");
      setNotice("Unable to refresh Content Ideas");
    }
  };
  const loadMoreIdeas = async () => {
    if (
      !actor?.userId ||
      ideasOwnerId !== actor.userId ||
      ideaNextOffset === null ||
      loadingMoreIdeas
    )
      return;
    setLoadingMoreIdeas(true);
    const requestedFilters = {
      search: ideaSearch,
      status: ideaStatusFilter,
      sort: ideaSort,
    };
    try {
      const page = await fetchIdeaPage(
        ideaNextOffset,
        requestedFilters.search,
        requestedFilters.status,
        undefined,
        requestedFilters.sort,
      );
      if (
        latestActorId.current !== actor.userId ||
        latestIdeaFilters.current.search !== requestedFilters.search ||
        latestIdeaFilters.current.status !== requestedFilters.status ||
        latestIdeaFilters.current.sort !== requestedFilters.sort
      )
        return;
      const nextIdeas = page.items.map(mapIdeaRecord);
      setState((previous) => {
        const existingIds = new Set(previous.ideas.map((idea) => idea.id));
        return {
          ...previous,
          ideas: [
            ...previous.ideas,
            ...nextIdeas.filter((idea) => !existingIds.has(idea.id)),
          ],
        };
      });
      setIdeaNextOffset(page.nextOffset);
    } catch {
      if (
        latestActorId.current === actor?.userId &&
        latestIdeaFilters.current.search === requestedFilters.search &&
        latestIdeaFilters.current.status === requestedFilters.status &&
        latestIdeaFilters.current.sort === requestedFilters.sort
      )
        setNotice("Unable to load more Content Ideas");
    } finally {
      setLoadingMoreIdeas(false);
    }
  };
  const updateMasterData = async (masterData: MasterData): Promise<boolean> => {
    const response = await fetch("/api/pr-center/admin/master-data", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channels: masterData.channels,
        contentTypes: masterData.contentTypes,
        contentPillars: masterData.contentPillars,
      }),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      announce(result?.message || "Master data could not be saved");
      return false;
    }
    const saved = (await response.json()) as Pick<
      MasterData,
      "channels" | "contentTypes" | "contentPillars"
    >;
    updateState((previous) =>
      addAudit(
        {
          ...previous,
          masterData: { ...previous.masterData, ...saved },
        },
        "system",
        "master-data",
        "master_data_updated",
        "",
        "Master data updated",
      ),
    );
    announce(state.language === "th" ? "บันทึกข้อมูลหลักแล้ว" : "Master data saved");
    return true;
  };
  const readNotifications = async (ids: string[]) => {
    if (ids.length === 0) return;
    const response = await fetch("/api/pr-center/notifications/read", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) return announce("Notification update failed");
    setState((previous) => ({
      ...previous,
      notifications: previous.notifications.map((item) =>
        ids.includes(item.id) ? { ...item, read: true } : item,
      ),
    }));
  };

  return (
    <div className={styles.app}>
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}
        aria-label="PR Center navigation"
      >
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <Image
              src="/wp-content/uploads/2023/02/cropped-Logo_RTRDA-300x300.png"
              alt="RTRDA"
              width={46}
              height={46}
              priority
            />
          </span>
          <span>
            <b>RTRDA</b>
            <small>PR CENTER</small>
          </span>
        </div>
        <div className={styles.workspace}>COMMUNICATION WORKSPACE</div>
        <nav className={styles.nav}>
          {visiblePages.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? styles.navActive : ""}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => {
                if (item.id === "new-request") {
                  openRequest();
                  setSidebarOpen(false);
                  return;
                }
                go(item.id);
              }}
            >
              <span className={styles.navIcon} aria-hidden="true">
                {item.icon}
              </span>
              <span className={styles.navLabel}>{label(item, state.language)}</span>
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <b>{actor ? "Authenticated workspace" : "Prototype workspace"}</b>
          {!actor && (
            <>
              <br />
              V25.1 UI only
            </>
          )}
        </div>
      </aside>

      <section className={styles.contentShell}>
        <header className={styles.topbar}>
          <button
            className={styles.menuButton}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            Menu
          </button>
          <div className={styles.topTitle}>
            <Image
              src="/wp-content/uploads/2023/02/cropped-Logo_RTRDA-300x300.png"
              alt=""
              width={38}
              height={38}
            />
            <div>
              <h2>
                {page === "ideas"
                  ? state.language === "th"
                    ? "เสนอ Content Ideas"
                    : "Content Ideas"
                  : "RTRDA PR Center"}
              </h2>
              {page !== "ideas" && <p>Corporate communications workspace</p>}
            </div>
          </div>
          <div
            className={`${styles.topActions} ${page === "ideas" ? styles.ideasTopActions : ""}`}
          >
            {hasUiRole("requester", "pr", "admin") && (
              <button className={styles.topRequest} onClick={openRequest}>
                + {t.newRequest}
              </button>
            )}
            <button
              className={styles.bell}
              onClick={() => go("notifications")}
              aria-label="Open notifications"
            >
              <span>{unreadCount}</span>
            </button>
            <select
              value={state.language}
              onChange={(event) =>
                updateState((previous) => ({
                  ...previous,
                  language: event.target.value as Language,
                }))
              }
              aria-label="Language"
            >
              <option value="th">ไทย</option>
              <option value="en">EN</option>
            </select>
            <button
              className={styles.profile}
              type="button"
              aria-label={
                state.language === "th" ? "ข้อมูลบัญชีของฉัน" : "My account information"
              }
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span>{currentUser.name.slice(0, 2)}</span>
              <i>{currentUser.role}</i>
            </button>
            {profileOpen && (
              <aside className={styles.card} role="status">
                <strong>{currentUser.name}</strong>
                <p>{currentUser.department}</p>
                <p>
                  {actorRoleCodes.length ? actorRoleCodes.join(", ") : currentUser.role}
                </p>
                <small>
                  {state.language === "th"
                    ? "ข้อมูลบัญชีแบบอ่านอย่างเดียว"
                    : "Read-only account information"}
                </small>
              </aside>
            )}
            {onSignOut && (
              <button className={styles.signOut} type="button" onClick={onSignOut}>
                {state.language === "th" ? "ออกจากระบบ" : "Sign out"}
              </button>
            )}
          </div>
        </header>

        <main className={styles.main}>
          {!actor && <div className={styles.prototype}>{t.prototype}</div>}
          {page === "home" && (
            <Dashboard
              t={t}
              language={state.language}
              onNavigate={go}
              onOpenRequest={openRequest}
              canCreateRequest={hasUiRole("requester", "pr", "admin")}
              currentUserName={currentUser.name}
              currentUserRole={currentUser.role}
              canManageReleaseEvidence={hasUiRole("admin")}
              requestsUnavailable={requestsUnavailable}
              requests={state.requests}
              tasks={state.tasks}
              loading={loadingRequests}
            />
          )}
          {page === "executive" && (
            <ExecutiveDashboard
              t={t}
              language={state.language}
              onNavigate={go}
              tasks={state.tasks}
              requests={state.requests}
            />
          )}
          {["my-requests", "requests", "ideas", "history"].includes(page) && (
            <ListSorting
              kind={
                page === "ideas" ? "ideas" : page === "history" ? "audit" : "requests"
              }
              value={listSorts[page] ?? DEFAULT_LIST_SORT}
              language={state.language}
              onChange={(sort) => {
                if (page === "ideas") {
                  latestIdeaFilters.current = {
                    search: ideaSearch,
                    status: ideaStatusFilter,
                    sort,
                  };
                  setIdeaListStatus("loading");
                  setIdeaNextOffset(null);
                  setState((previous) => ({ ...previous, ideas: [] }));
                } else if (page === "history") {
                  ++auditGeneration.current;
                  setAuditLoading(true);
                  setAuditHasMore(false);
                  setAuditCursor(null);
                } else {
                  ++requestListGeneration.current;
                  setRequestListLoading(true);
                  setRequestListHasMore(false);
                  setRequestListCursor(null);
                }
                setListSorts((previous) => ({ ...previous, [page]: sort }));
              }}
            />
          )}
          {page === "new-request" && hasUiRole("requester", "pr", "admin") && (
            <NewRequest t={t} onOpenRequest={openRequest} />
          )}
          {page === "my-requests" && (
            <Requests
              t={t}
              language={state.language}
              onOpenRequest={openRequest}
              onEditRequest={editRequest}
              onSubmitRequest={submitRequest}
              onWithdrawRequest={withdrawRequest}
              mode="mine"
              canCreate={hasUiRole("requester", "pr", "admin")}
              requests={visibleRequestList
                .filter((record) => !record.assignedTaskOnly)
                .map(mapRequestRecord)}
              tasks={mapRequestTasks(visibleRequestList)}
              currentUserId={currentUser.id}
              hasMore={requestListContext === requestContextKey && requestListHasMore}
              onRefresh={refreshRequestList}
              loadingMore={requestListLoadingMore}
              loading={requestListLoading}
              error={requestListError}
              onLoadMore={loadMoreRequestList}
              query={requestSearch}
              status={requestStatusFilter}
              onFiltersChange={changeRequestFilters}
            />
          )}
          {page === "requests" && (
            <Requests
              t={t}
              language={state.language}
              onOpenRequest={openRequest}
              onEditRequest={editRequest}
              onSubmitRequest={submitRequest}
              onWithdrawRequest={withdrawRequest}
              mode="all"
              canCreate={false}
              requests={visibleRequestList
                .filter((record) => !record.assignedTaskOnly)
                .map(mapRequestRecord)}
              tasks={mapRequestTasks(visibleRequestList)}
              currentUserId={currentUser.id}
              hasMore={requestListContext === requestContextKey && requestListHasMore}
              onRefresh={refreshRequestList}
              loadingMore={requestListLoadingMore}
              loading={requestListLoading}
              error={requestListError}
              onLoadMore={loadMoreRequestList}
              query={requestSearch}
              status={requestStatusFilter}
              onFiltersChange={changeRequestFilters}
            />
          )}
          {page === "operations" && (
            <Operations
              tasks={state.tasks}
              channels={state.masterData.channels}
              language={state.language}
              onTransition={transitionTask}
              onAssign={assignTask}
              onSchedule={scheduleTask}
              onPublish={publishTask}
              onCreateRevision={createTaskRevision}
              canManageTasks={hasUiRole("pr", "admin")}
              currentUserId={currentUser.id}
              canFactCheckPR={actorRoleCodes.includes("RTRDA_PR")}
              canConfigureApprovalRequirements={actorRoleCodes.includes("RTRDA_PR")}
              onFinalAssetAssigned={(taskId, fileId) =>
                setState((previous) => ({
                  ...previous,
                  tasks: previous.tasks.map((task) =>
                    task.id === taskId ? { ...task, finalAssetId: fileId } : task,
                  ),
                }))
              }
              canViewPublishing={hasUiRole("pr", "admin")}
            />
          )}
          {page === "calendar" && <Calendar language={state.language} />}
          {page === "approvals" && (
            <Approvals
              language={state.language}
              tasks={approvalTasks}
              requests={approvalRequests}
              canDecideRequests={hasUiRole("pr", "admin")}
              canDecideTasks={hasUiRole("pr", "admin")}
              requestQueueState={
                hasUiRole("pr", "admin") ? requestApprovalQueueState : "not-authorized"
              }
              onDecision={recordApproval}
              onRequestDecision={recordRequestDecision}
            />
          )}
          {page === "library" && <Library language={state.language} />}
          {page === "ideas" && (
            <Ideas
              ideas={ideasOwnerId === actor?.userId ? state.ideas : []}
              currentUser={currentUser}
              channels={state.masterData.channels}
              contentPillars={state.masterData.contentPillars}
              canReview={hasUiRole("pr", "admin")}
              canApprove={hasUiRole("pr", "admin")}
              onCreate={createIdea}
              onUpdate={updateIdea}
              onStatus={updateIdeaStatus}
              onConvert={convertIdea}
              language={state.language}
              listStatus={ideasOwnerId === actor?.userId ? ideaListStatus : "loading"}
              hasMore={ideasOwnerId === actor?.userId && ideaNextOffset !== null}
              loadingMore={loadingMoreIdeas}
              onLoadMore={loadMoreIdeas}
              onRefresh={refreshIdeas}
              onFilters={changeIdeaFilters}
            />
          )}
          {page === "message-house" && (
            <MessageHouse
              data={state.messageHouse}
              canEdit={
                !!actor?.roleGrants?.some(
                  (grant) => grant.role === "RTRDA_PR" && grant.departmentId === null,
                )
              }
              canReview={
                !!actor?.roleGrants?.some(
                  (grant) => grant.role === "RTRDA_BORD" && grant.departmentId === null,
                )
              }
              status={messageHouseStatus}
              history={messageHouseHistory}
              historyStatus={messageHouseHistoryStatus}
              onRefresh={loadMessageHouse}
              language={state.language}
            />
          )}
          {page === "notifications" && (
            <Notifications
              onNavigate={navigateFromNotification}
              notifications={userNotifications}
              onRead={readNotifications}
              language={state.language}
            />
          )}
          {page === "history" && (
            <History
              audit={auditLoading ? [] : state.audit}
              language={state.language}
              loading={auditLoading}
              loadingMore={auditLoadingMore}
              hasMore={auditHasMore}
              error={auditError}
              onRefresh={() => {
                setAuditLoading(true);
                setAuditReload((value) => value + 1);
              }}
              onLoadMore={loadMoreAudit}
            />
          )}
          {page === "directory" && actor && (
            <Directory actor={actor} language={state.language} />
          )}
          {page === "settings" && actor && <Settings language={state.language} />}
          {page === "system-data" && (
            <SystemData
              state={state}
              data={state.masterData}
              onSave={updateMasterData}
              language={state.language}
            />
          )}
          {page === "help" && (
            <Help role={currentUser.role} onNavigate={go} language={state.language} />
          )}
        </main>
      </section>

      {requestOpen && (
        <RequestModal
          language={state.language}
          requesterName={currentUser.name}
          contentTypes={state.masterData.contentTypes}
          draftLoading={!requestDraftHydrated}
          draftSaving={requestDraftSaving}
          submitting={requestSubmitting}
          isEditing={requestEditId !== null}
          draft={requestDraft}
          onChange={(draft) => {
            if (!requestDraftHydrated) return;
            setRequestDraft(draft);
            if (!requestEditId) {
              requestDraftDirty.current = true;
              requestDraftRevision.current += 1;
            }
          }}
          onClose={() => {
            setRequestOpen(false);
            setRequestEditId(null);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            const submitter = (event.nativeEvent as SubmitEvent)
              .submitter as HTMLButtonElement | null;
            void createRequest(
              requestDraft,
              requestEditId,
              submitter?.value === "submit",
            );
          }}
        />
      )}
      {notice && (
        <button className={styles.toast} onClick={() => setNotice(null)}>
          {notice}
        </button>
      )}
    </div>
  );
}

function Dashboard({
  t,
  language,
  onNavigate,
  onOpenRequest,
  canCreateRequest,
  currentUserName,
  currentUserRole,
  canManageReleaseEvidence,
  requestsUnavailable,
  loading,
  requests: requestItems,
  tasks: taskItems,
}: {
  t: (typeof copy)[Language];
  language: Language;
  onNavigate: (page: Page) => void;
  onOpenRequest: () => void;
  canCreateRequest: boolean;
  currentUserName: string;
  currentUserRole: Role;
  canManageReleaseEvidence: boolean;
  requestsUnavailable: boolean;
  loading: boolean;
  requests: Request[];
  tasks: Task[];
}) {
  const thai = language === "th";
  const published = taskItems.filter((task) =>
    ["published", "closed"].includes(task.status),
  ).length;
  const pending = taskItems.filter((task) =>
    ["pr_editorial_review", "management_approval"].includes(task.status),
  ).length;
  const active = taskItems.filter(
    (task) => !["closed", "cancelled", "rejected"].includes(task.status),
  ).length;
  const workflow = {
    planning: taskItems.filter((task) =>
      ["draft", "communication_planning"].includes(task.status),
    ).length,
    waiting: taskItems.filter((task) => task.status === "waiting_for_information").length,
    production: taskItems.filter((task) =>
      [
        "in_production",
        "source_fact_check",
        "technical_review",
        "pr_editorial_review",
      ].includes(task.status),
    ).length,
    approval: pending,
  };
  const metricsUnavailable = unavailableMetricDisplay(language);
  const currentMonth = new Intl.DateTimeFormat(
    language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
    { month: "long", year: "numeric" },
  ).format(new Date());
  const requestRows = requestItems.map((request) => [
    request.id,
    request.title,
    STATUS_LABELS[requestStatus(request, taskItems)],
    request.requestedDate,
  ]);
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p>
            {currentUserName} · {currentUserRole}
          </p>
          <h1>{t.greeting}</h1>
          <span>{t.subheading}</span>
          <div className={styles.heroChips}>
            <b>{currentMonth}</b>
            <b>{published} published items</b>
            <b>{pending} approvals pending</b>
          </div>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.heroSecondary} onClick={() => onNavigate("calendar")}>
            View calendar
          </button>
          {canCreateRequest && (
            <button className={styles.primary} onClick={onOpenRequest}>
              + {t.newRequest}
            </button>
          )}
        </div>
      </section>
      <section className={styles.metrics}>
        <Metric
          value={String(published)}
          label={t.published}
          trend={`${active} active work items`}
          tone="blue"
        />
        <Metric
          value={metricsUnavailable.value}
          label={t.reach}
          trend={metricsUnavailable.trend}
          tone="green"
        />
        <Metric
          value={metricsUnavailable.value}
          label={t.engagement}
          trend={metricsUnavailable.trend}
          tone="purple"
        />
        <Metric
          value={String(pending)}
          label={t.pending}
          trend="Review within 2 days"
          tone="gold"
        />
      </section>
      <section className={styles.workflowStrip} aria-label="Workflow health">
        {[
          ["Planning", String(workflow.planning), styles.workflowPlan],
          ["Waiting for information", String(workflow.waiting), styles.workflowWait],
          ["In production", String(workflow.production), styles.workflowDoing],
          ["Awaiting approval", String(workflow.approval), styles.workflowApproval],
        ].map(([name, count, className]) => (
          <button
            className={`${styles.workflowCell} ${className}`}
            key={name}
            onClick={() => onNavigate("operations")}
          >
            <span>{name}</span>
            <b>{count}</b>
          </button>
        ))}
      </section>
      <ProductionReadiness
        language={language}
        canManageEvidence={canManageReleaseEvidence}
      />
      <section className={styles.dashboardGrid}>
        <article className={`${styles.card} ${styles.wideCard}`}>
          <header>
            <div>
              <p className={styles.eyebrow}>{t.workflow}</p>
              <h2>Content pipeline</h2>
            </div>
            <button onClick={() => onNavigate("operations")}>{t.viewAll}</button>
          </header>
          <div className={styles.pipeline}>
            {[
              ["New request", workflow.planning],
              ["In production", workflow.production],
              ["Review", workflow.approval],
              [
                "Scheduled",
                taskItems.filter((task) => task.status === "scheduled").length,
              ],
              ["Published", published],
            ].map(([name, count]) => (
              <div key={String(name)}>
                <span>{name}</span>
                <b>{count}</b>
                <i style={{ width: `${Number(count) * 3}%` }} />
              </div>
            ))}
          </div>
        </article>
        <article className={`${styles.card} ${styles.wideCard}`}>
          <header>
            <div>
              <p className={styles.eyebrow}>{t.recentRequests}</p>
              <h2>Latest work requests</h2>
            </div>
            <button onClick={() => onNavigate("requests")}>{t.viewAll}</button>
          </header>
          {loading ? (
            <p className={styles.dashboardNote} role="status">
              {thai ? "กำลังโหลดคำขอจากระบบ…" : "Loading requests from the system…"}
            </p>
          ) : requestsUnavailable ? (
            <p className={styles.dashboardNote} role="alert">
              {thai
                ? "โหลดคำขอไม่สำเร็จ กรุณาเปิดคำขอของฉันเพื่อลองอีกครั้ง"
                : "Requests could not be loaded. Open My Requests to retry."}{" "}
              <button type="button" onClick={() => onNavigate("my-requests")}>
                {thai ? "เปิดคำขอของฉัน" : "Open My Requests"}
              </button>
            </p>
          ) : requestRows.length ? (
            <Table
              rows={requestRows}
              headers={["ID", "Project", "Status", "Target date"]}
            />
          ) : (
            <p className={styles.dashboardNote}>
              {thai
                ? "ยังไม่มีคำขอในขอบเขตที่คุณเข้าถึงได้"
                : "No requests are available in your access scope."}
            </p>
          )}
        </article>
      </section>
      <DashboardScheduleInsights language={language} onNavigate={onNavigate} />
    </>
  );
}

function ProductionReadiness({
  language,
  canManageEvidence,
}: {
  language: Language;
  canManageEvidence: boolean;
}) {
  const thai = language === "th";
  const productionGates = thai
    ? [
        [
          "UAT ด้วยบัญชีจริงและผู้รับผิดชอบลงนาม",
          "ทดสอบ role/scope ทั้งหน้าเว็บและ API ครอบคลุม submit, อนุมัติ/ปฏิเสธ, schedule, หลักฐานเผยแพร่, ไฟล์/สแกนไวรัส และประวัติ พร้อมเก็บผลทดสอบและผู้รับรอง",
        ],
        [
          "ยืนยันและตั้งค่า Approval Policy",
          "กำหนด stage, scope และเงื่อนไขอนุมัติระดับ task ให้ชัดเจน ระบบต้อง fail-closed เมื่อ policy ไม่ครบ แยกจาก policy อนุมัติ request intake ที่กำหนดไว้แล้ว",
        ],
        [
          "พิสูจน์การแจ้งเตือนภายนอก",
          "หากยังต้องการ email ตามแผน ให้ตั้งค่า SMTP/worker และทดสอบการส่งถึงผู้รับจริง สถานะ queued หรือ in-app notification ไม่ใช่หลักฐานการส่ง email",
        ],
        [
          "ทดสอบกู้คืนจาก backup จริง",
          "กู้คืนทั้งฐานข้อมูลและไฟล์ส่วนตัวในสภาพแวดล้อมทดสอบ และบันทึกผลการกู้คืน ไม่ใช่เพียงตรวจว่าไฟล์ backup อ่านได้",
        ],
        [
          "ปิด Security/Release sign-off",
          "แนบผลทดสอบสิทธิ์ที่อนุญาต/ปฏิเสธ, session และการเพิกถอนสิทธิ์ พร้อมการลงนามจากผู้มีอำนาจอนุมัติ go-live",
        ],
      ]
    : [
        [
          "Authenticated UAT and owner sign-off",
          "Test roles and scopes in the UI and API: submit, approve/reject, schedule, publication evidence, files/malware scanning, and activity history. Retain test results and named sign-off.",
        ],
        [
          "Confirm and configure Approval Policy",
          "Define task-level stages, scopes, and conditions. The system must fail closed while policy is incomplete. This is separate from the already-defined request-intake approval policy.",
        ],
        [
          "Prove external notifications",
          "If email remains in scope, configure SMTP/the worker and verify delivery to real recipients. Queued status or in-app notification does not prove email delivery.",
        ],
        [
          "Test a real backup restore",
          "Restore both the database and private files in a test environment and retain results; checking that a backup file is readable is insufficient.",
        ],
        [
          "Complete Security/Release sign-off",
          "Attach allowed/denied authorization, session, and access-revocation test results, plus go-live approval from an authorized owner.",
        ],
      ];

  return (
    <section className={styles.readiness} aria-labelledby="production-readiness-title">
      <header className={styles.readinessHeader}>
        <div>
          <p className={styles.eyebrow}>{thai ? "RELEASE GATES" : "RELEASE GATES"}</p>
          <h2 id="production-readiness-title">
            {thai ? "งานที่ยังต้องปิดก่อน Production" : "Open items before Production"}
          </h2>
          <p>
            {thai
              ? "รายการติดตามแบบอ่านอย่างเดียว ยังไม่มีการยืนยันว่าผ่านจนกว่าจะมีหลักฐานและผู้รับรอง"
              : "Read-only tracking. Items are not considered complete until evidence and owner sign-off are recorded."}
          </p>
        </div>
        <span className={styles.readinessStatus}>
          {thai ? "รอหลักฐาน / การยืนยัน" : "Evidence / confirmation pending"}
        </span>
      </header>

      <div className={styles.readinessColumns}>
        <article className={styles.readinessPanel}>
          <h3>{thai ? "ก่อน Production" : "Before Production"}</h3>
          <ol className={styles.readinessList}>
            {productionGates.map(([title, detail]) => (
              <li key={title}>
                <b>{title}</b>
                <p>{detail}</p>
              </li>
            ))}
          </ol>
        </article>

        <article className={styles.readinessPanel}>
          <h3>{thai ? "Phase 2" : "Phase 2"}</h3>
          <ul className={styles.readinessList}>
            <li>
              <b>{thai ? "สิ่งที่อยู่ใน scope ปัจจุบัน" : "In current scope"}</b>
              <p>
                {thai
                  ? "ฟังก์ชันที่เปิดใช้ต้องผ่าน authenticated role/scope UAT และมีหลักฐานรับรองก่อนใช้งานจริง"
                  : "Enabled functions require authenticated role/scope UAT and signed evidence before release."}
              </p>
            </li>
            <li>
              <b>
                {thai
                  ? "รายการขั้นสูง — blocker เมื่อรวมใน scope เท่านั้น"
                  : "Advanced items — blockers only if brought into scope"}
              </b>
              <p>
                {thai
                  ? "workflow เขียน/อนุมัติ Message House, policy แก้ไข/จัดการรายการซ้ำ/export ของ Content Ideas และคลัง final asset แบบเต็ม"
                  : "Message House authoring/approval workflow; Content Ideas edit, duplicate-management and export policy; and a full final-asset library."}
              </p>
            </li>
            <li>
              <b>
                {thai ? "พักไว้ตาม scope ที่บันทึก" : "Deferred in the recorded scope"}
              </b>
              <p>
                {thai
                  ? "How to Use, กฎวันหยุดใน Calendar และการขยาย Directory/Access/System Data ยังไม่จำเป็นต้องทำในรอบนี้"
                  : "How to Use, Calendar holiday rules, and expanded Directory/Access/System Data are not required in this scope."}
              </p>
            </li>
          </ul>
        </article>

        <article className={styles.readinessPanel}>
          <h3>{thai ? "Phase 3" : "Phase 3"}</h3>
          <ul className={styles.readinessList}>
            <li>
              <b>{thai ? "Content Operations" : "Content Operations"}</b>
              <p>
                {thai
                  ? "มุมมองอ่านอย่างเดียวต้องอยู่บนเว็บทดสอบและผ่าน UAT บนเว็บก่อนนับว่าส่งมอบ Phase 3"
                  : "The read-only view must be available on the test website and pass web UAT before Phase 3 is considered delivered."}
              </p>
            </li>
            <li>
              <b>
                {thai
                  ? "ช่องทางเผยแพร่และ analytics"
                  : "Publishing channels and analytics"}
              </b>
              <p>
                {thai
                  ? "ต้องเลือกช่องทางและเจ้าของช่องทาง อนุมัติวิธีจัดการ credentials, runbook และ UAT; analytics ต้องใช้แหล่งข้อมูลจริงที่อนุมัติ พร้อมทดสอบความถูกต้องและความสด"
                  : "Select channels and owners; approve credential handling, runbook, and UAT. Analytics requires an approved real data source plus accuracy and freshness checks."}
              </p>
            </li>
            <li>
              <b>{thai ? "Reach / Engagement" : "Reach / Engagement"}</b>
              <p>
                {thai
                  ? "หากยังไม่มีแหล่งข้อมูลจริงที่อนุมัติ ให้แสดงว่าไม่มีข้อมูลยืนยัน"
                  : "Show no verified data until an approved real analytics source is connected."}
              </p>
            </li>
          </ul>
        </article>
      </div>
      {canManageEvidence && <ReleaseEvidenceManager language={language} />}
    </section>
  );
}

type ReleaseEvidenceRecord = {
  id: string;
  gateKey: ReleaseEvidenceGate;
  result: "PASSED" | "FAILED";
  evidenceReference: string;
  notes: string | null;
  performedAt: string;
  signedAt: string;
  signer: { displayName: string; email: string } | null;
};

function ReleaseEvidenceManager({ language }: { language: Language }) {
  const thai = language === "th";
  const [records, setRecords] = useState<ReleaseEvidenceRecord[]>([]);
  const [checks, setChecks] = useState<
    Array<{ name: string; passed: boolean; detail: string }>
  >([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [gateKey, setGateKey] = useState<ReleaseEvidenceGate>("AUTHENTICATED_UAT");
  const [result, setResult] = useState<"PASSED" | "FAILED">("PASSED");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [performedAt, setPerformedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/pr-center/admin/release-evidence", {
        credentials: "same-origin",
        cache: "no-store",
      }),
      fetch("/api/pr-center/admin/release-readiness", {
        credentials: "same-origin",
        cache: "no-store",
      }),
    ])
      .then(async ([evidenceResponse, readinessResponse]) => {
        if (!evidenceResponse.ok || !readinessResponse.ok)
          throw new Error("Unable to load release checks");
        return Promise.all([evidenceResponse.json(), readinessResponse.json()]);
      })
      .then(([evidence, readiness]) => {
        if (!active) return;
        const result = readiness as { ready: boolean; checks: typeof checks };
        setRecords(evidence as ReleaseEvidenceRecord[]);
        setChecks(result.checks);
        setReady(result.ready);
      })
      .catch(() => {
        if (active)
          setError(
            thai
              ? "โหลดผลตรวจและหลักฐาน Release ไม่สำเร็จ"
              : "Unable to load release checks and evidence.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [thai]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [evidenceResponse, readinessResponse] = await Promise.all([
        fetch("/api/pr-center/admin/release-evidence", {
          credentials: "same-origin",
          cache: "no-store",
        }),
        fetch("/api/pr-center/admin/release-readiness", {
          credentials: "same-origin",
          cache: "no-store",
        }),
      ]);
      if (!evidenceResponse.ok || !readinessResponse.ok)
        throw new Error("Unable to load release checks");
      const [evidence, readiness] = (await Promise.all([
        evidenceResponse.json(),
        readinessResponse.json(),
      ])) as [ReleaseEvidenceRecord[], { ready: boolean; checks: typeof checks }];
      setRecords(evidence);
      setChecks(readiness.checks);
      setReady(readiness.ready);
    } catch {
      setError(
        thai
          ? "โหลดผลตรวจและหลักฐาน Release ไม่สำเร็จ"
          : "Unable to load release checks and evidence.",
      );
    } finally {
      setLoading(false);
    }
  }, [thai]);

  const latestByGate = new Map<ReleaseEvidenceGate, ReleaseEvidenceRecord>();
  for (const record of records)
    if (!latestByGate.has(record.gateKey)) latestByGate.set(record.gateKey, record);

  const gateLabels: Record<ReleaseEvidenceGate, string> = {
    AUTHENTICATED_UAT: thai
      ? "UAT role/scope ด้วยบัญชีจริง"
      : "Authenticated role/scope UAT",
    BACKUP_RESTORE: thai ? "ทดสอบกู้คืน backup" : "Backup restore test",
    SECURITY_UAT: thai ? "Security และ session UAT" : "Security and session UAT",
    GO_LIVE_SIGNOFF: thai ? "ผู้มีอำนาจอนุมัติ go-live" : "Authorized go-live sign-off",
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/pr-center/admin/release-evidence", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateKey,
          result,
          evidenceReference: reference,
          notes,
          performedAt: new Date(performedAt).toISOString(),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || "Could not record evidence");
      }
      setReference("");
      setNotes("");
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : thai
            ? "บันทึกหลักฐานไม่สำเร็จ"
            : "Unable to record evidence.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.releaseEvidence} aria-labelledby="release-evidence-title">
      <header>
        <div>
          <p className={styles.eyebrow}>{thai ? "ADMIN SIGN-OFF" : "ADMIN SIGN-OFF"}</p>
          <h3 id="release-evidence-title">
            {thai ? "หลักฐานและผล Release Readiness" : "Release readiness evidence"}
          </h3>
        </div>
        <b className={ready ? styles.releasePassed : styles.releaseBlocked}>
          {loading ? (thai ? "กำลังตรวจ…" : "Checking…") : ready ? "READY" : "BLOCKED"}
        </b>
        <button type="button" onClick={() => void refresh()} disabled={loading || saving}>
          {thai ? "รีเฟรชผลตรวจ" : "Refresh checks"}
        </button>
      </header>
      <p className={styles.dashboardNote}>
        {thai
          ? "การบันทึกผูกกับบัญชีผู้ดูแลและเก็บเป็น audit record แบบเพิ่มรายการใหม่ ไม่แนบไฟล์หลักฐานในระบบนี้ ให้ใส่เลขอ้างอิงเอกสาร ห้ามใส่รหัสผ่าน token หรือ signed URL"
          : "Each entry is signed with the administrator account and stored as an append-only audit record. Evidence files are not uploaded here; use a document reference, never a password, token, or signed URL."}
      </p>
      {error && (
        <p role="alert" className={styles.releaseError}>
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">{thai ? "กำลังโหลดหลักฐาน…" : "Loading evidence…"}</p>
      ) : (
        <div className={styles.releaseCheckList}>
          {checks.map((check) => (
            <article key={check.name}>
              <b>
                {check.passed ? "✓" : "•"} {check.name}
              </b>
              <p>{check.detail}</p>
            </article>
          ))}
        </div>
      )}
      <div className={styles.releaseGateList}>
        {RELEASE_EVIDENCE_GATES.map((gate) => {
          const evidence = latestByGate.get(gate);
          return (
            <p key={gate}>
              <b>{gateLabels[gate]}</b>
              <span
                className={
                  evidence?.result === "PASSED"
                    ? styles.releasePassed
                    : styles.releaseBlocked
                }
              >
                {evidence?.result === "PASSED"
                  ? thai
                    ? "ผ่าน"
                    : "Passed"
                  : evidence?.result === "FAILED"
                    ? thai
                      ? "ไม่ผ่าน"
                      : "Failed"
                    : thai
                      ? "รอหลักฐาน"
                      : "Evidence pending"}
              </span>
              {evidence && (
                <small>
                  {evidence.signer?.displayName || evidence.signer?.email || "—"} ·{" "}
                  {evidence.evidenceReference}
                </small>
              )}
            </p>
          );
        })}
      </div>
      <form className={styles.releaseEvidenceForm} onSubmit={submit}>
        <label>
          {thai ? "หัวข้อหลักฐาน" : "Evidence gate"}
          <select
            value={gateKey}
            onChange={(event) => setGateKey(event.target.value as ReleaseEvidenceGate)}
          >
            {RELEASE_EVIDENCE_GATES.map((gate) => (
              <option value={gate} key={gate}>
                {gateLabels[gate]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {thai ? "ผลทดสอบ" : "Result"}
          <select
            value={result}
            onChange={(event) => setResult(event.target.value as "PASSED" | "FAILED")}
          >
            <option value="PASSED">{thai ? "ผ่าน" : "Passed"}</option>
            <option value="FAILED">{thai ? "ไม่ผ่าน" : "Failed"}</option>
          </select>
        </label>
        <label>
          {thai ? "วันที่ทดสอบ/อนุมัติ" : "Test / approval date"}
          <input
            type="datetime-local"
            value={performedAt}
            onChange={(event) => setPerformedAt(event.target.value)}
            required
          />
        </label>
        <label className={styles.releaseEvidenceFull}>
          {thai ? "เลขอ้างอิงเอกสารหลักฐาน" : "Evidence document reference"}
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            minLength={3}
            maxLength={800}
            required
          />
        </label>
        <label className={styles.releaseEvidenceFull}>
          {thai
            ? "รายละเอียด role/action หรือผลการ restore"
            : "Role/actions tested or restore details"}
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            rows={3}
          />
        </label>
        <button className={styles.primary} type="submit" disabled={saving || loading}>
          {saving
            ? thai
              ? "กำลังบันทึก…"
              : "Saving…"
            : thai
              ? "ลงนามและบันทึกหลักฐาน"
              : "Sign and record evidence"}
        </button>
      </form>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
  help,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  help?: React.ReactNode;
}) {
  return (
    <section className={styles.pageHeading}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>
          {title}
          {help}
        </h1>
      </div>
      {action}
    </section>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) => (
                <td key={cell}>{index === 2 ? <Status>{cell}</Status> : cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ExecutiveDashboard({
  t,
  language,
  onNavigate,
  tasks,
  requests,
}: {
  t: (typeof copy)[Language];
  language: Language;
  onNavigate: (page: Page) => void;
  tasks: Task[];
  requests: Request[];
}) {
  const published = tasks.filter((task) =>
    ["published", "closed"].includes(task.status),
  ).length;
  const pending = tasks.filter((task) =>
    ["pr_editorial_review", "management_approval"].includes(task.status),
  ).length;
  const scheduled = tasks.filter((task) =>
    ["approved", "scheduled"].includes(task.status),
  ).length;
  const onTime = tasks.filter((task) => task.dueDate >= "2026-09-07").length;
  const metricsUnavailable = unavailableMetricDisplay(language);
  return (
    <>
      <SectionHeading eyebrow="EXECUTIVE OVERVIEW" title="Executive Dashboard" />
      <section className={styles.metrics}>
        <Metric
          value={String(published)}
          label={t.published}
          trend={`${requests.length} requests tracked`}
          tone="blue"
        />
        <Metric
          value={metricsUnavailable.value}
          label={t.reach}
          trend={metricsUnavailable.trend}
          tone="green"
        />
        <Metric
          value={metricsUnavailable.value}
          label={t.engagement}
          trend={metricsUnavailable.trend}
          tone="purple"
        />
        <Metric
          value={String(pending)}
          label={t.pending}
          trend={`${onTime}/${tasks.length} on schedule`}
          tone="gold"
        />
      </section>
      <article className={styles.card}>
        <h2>Content pipeline</h2>
        <Table
          headers={["Stage", "Items", "Status"]}
          rows={[
            [
              "Planning",
              String(
                tasks.filter((task) =>
                  ["draft", "communication_planning"].includes(task.status),
                ).length,
              ),
              "In production",
            ],
            ["Review", String(pending), "Awaiting approval"],
            ["Scheduled", String(scheduled), "Scheduled"],
          ]}
        />
        <button className={styles.primary} onClick={() => onNavigate("operations")}>
          View content operations
        </button>
      </article>
      <DashboardScheduleInsights language={language} onNavigate={onNavigate} />
    </>
  );
}
function NewRequest({
  t,
  onOpenRequest,
}: {
  t: (typeof copy)[Language];
  onOpenRequest: () => void;
}) {
  return (
    <>
      <SectionHeading
        eyebrow="WORK INTAKE"
        title={t.newRequest}
        action={
          <button className={styles.primary} onClick={onOpenRequest}>
            + {t.newRequest}
          </button>
        }
      />
      <article className={styles.card}>
        <h2>Start a PR work request</h2>
        <p>
          Provide the project details, objectives, source information, and requested date.
        </p>
      </article>
    </>
  );
}
function Requests({
  t,
  language,
  onOpenRequest,
  onEditRequest,
  onSubmitRequest,
  onWithdrawRequest,
  mode,
  canCreate,
  requests: requestItems,
  tasks: taskItems,
  currentUserId,
  hasMore,
  onRefresh,
  loadingMore,
  loading,
  onLoadMore,
  query,
  status,
  error,
  onFiltersChange,
}: {
  t: (typeof copy)[Language];
  language: Language;
  onOpenRequest: () => void;
  onEditRequest: (request: Request) => void;
  onSubmitRequest: (request: Request) => void;
  onWithdrawRequest: (request: Request) => void;
  mode: "all" | "mine";
  canCreate: boolean;
  requests: Request[];
  tasks: Task[];
  currentUserId: string;
  hasMore: boolean;
  onRefresh: () => Promise<void>;
  loadingMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  query: string;
  status: string;
  error: boolean;
  onFiltersChange: (query: string, status: string) => void;
}) {
  const title = mode === "mine" ? "My Requests" : "All Requests";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleRequests =
    mode === "mine"
      ? requestItems.filter((request) => request.requesterId === currentUserId)
      : requestItems;
  const selected = visibleRequests.find((request) => request.id === selectedId);
  return (
    <>
      <SectionHeading
        eyebrow="WORK INTAKE"
        title={title}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={loading || loadingMore}
              onClick={() => void onRefresh()}
            >
              {t.refresh}
            </button>
            {canCreate && (
              <button className={styles.primary} onClick={onOpenRequest}>
                + {t.newRequest}
              </button>
            )}
          </div>
        }
      />
      <section className={styles.filterBar}>
        <input
          value={query}
          maxLength={120}
          onChange={(event) => onFiltersChange(event.target.value, status)}
          placeholder={t.search}
          aria-label={
            language === "th"
              ? "ค้นหาคำขอจากชื่อหรือเลขคำขอ"
              : "Search request title or number"
          }
        />
        <select
          aria-label={language === "th" ? "สถานะคำขอ" : "Request status"}
          value={status}
          onChange={(event) => onFiltersChange(query, event.target.value)}
        >
          <option value="">
            {language === "th" ? "ทุกสถานะคำขอ" : "All request statuses"}
          </option>
          {(
            [
              "DRAFT",
              "SUBMITTED",
              "APPROVED",
              "REJECTED",
              "WITHDRAWN",
              "CANCELLED",
              "CLOSED",
            ] as const
          ).map((item) => (
            <option key={item} value={item}>
              {requestIntakeStatusLabel(item, language)}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => onFiltersChange("", "")}>
          {language === "th" ? "ล้างตัวกรอง" : "Clear filters"}
        </button>
      </section>
      <p role="note">
        {language === "th"
          ? "ค้นหาชื่อหรือเลขคำขอและกรองสถานะจากระบบในขอบเขตสิทธิ์ของคุณ"
          : "Search request titles or numbers and filter status across your authorized scope."}
      </p>
      <article className={styles.card}>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th scope="col">{language === "th" ? "โครงการ" : "Project"}</th>
                <th scope="col">{language === "th" ? "ประเภทคำขอ" : "Request type"}</th>
                <th scope="col">
                  {language === "th" ? "ฝ่าย / ผู้ส่งคำขอ" : "Department / requester"}
                </th>
                <th scope="col">{language === "th" ? "วันที่สร้าง" : "Created"}</th>
                <th scope="col">
                  {language === "th" ? "วันที่ต้องการเผยแพร่" : "Requested date"}
                </th>
                <th scope="col">Content Package</th>
                <th scope="col">{language === "th" ? "สถานะคำขอ" : "Request status"}</th>
                <th scope="col">{language === "th" ? "จัดการ" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((request) => {
                const requestTasks = taskItems.filter(
                  (task) => task.requestId === request.id,
                );
                const contentPackage = summarizeRequestTableTasks(
                  requestTasks.map((task) => ({
                    contentType: task.type,
                    status: task.status,
                  })),
                );
                const submittedAt = request.createdAt
                  ? new Date(request.createdAt).toLocaleString(
                      language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
                      {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Asia/Bangkok",
                      },
                    )
                  : "—";
                return (
                  <tr key={request.id} id={`request-${request.id}`}>
                    <td>
                      <strong>{request.title}</strong>
                      <small>{request.id}</small>
                    </td>
                    <td>
                      {request.type === "offsite"
                        ? language === "th"
                          ? "นอกสถานที่"
                          : "Off-site"
                        : language === "th"
                          ? "ประชาสัมพันธ์"
                          : "PR"}
                    </td>
                    <td>
                      <span>{request.department}</span>
                      <small>{request.requesterName || "—"}</small>
                    </td>
                    <td>{submittedAt}</td>
                    <td>
                      {request.requestedDate
                        ? new Date(
                            `${request.requestedDate}T00:00:00Z`,
                          ).toLocaleDateString(
                            language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
                            { timeZone: "Asia/Bangkok" },
                          )
                        : "—"}
                    </td>
                    <td>
                      <strong>{contentPackage.count}</strong>{" "}
                      {language === "th" ? "ชิ้น" : "items"}
                      <small>
                        {contentPackage.contentTypes.length > 0
                          ? contentPackage.contentTypes.join(", ")
                          : language === "th"
                            ? "ยังไม่มีประเภท Content"
                            : "No content types yet"}
                      </small>
                    </td>
                    <td>
                      <Status>
                        {requestIntakeStatusLabel(request.status, language)}
                      </Status>
                      {contentPackage.count > 0 && (
                        <small>
                          {language === "th" ? "ความคืบหน้างาน: " : "Content progress: "}
                          {requestTableStatusLabel(contentPackage.status, language)}
                        </small>
                      )}
                    </td>
                    <td>
                      <button onClick={() => setSelectedId(request.id)}>
                        {language === "th" ? "เปิด" : "Open"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {error && (
          <p role="alert">
            {language === "th"
              ? "โหลดคำขอไม่สำเร็จ ลองรีเฟรชอีกครั้ง"
              : "Unable to load requests. Refresh to retry."}
          </p>
        )}
        {loading && visibleRequests.length === 0 && (
          <p role="status">Loading requests…</p>
        )}
        {!loading && !error && visibleRequests.length === 0 && <p>No requests found.</p>}
        {hasMore && (
          <button disabled={loadingMore || loading} onClick={onLoadMore}>
            {loadingMore ? "Loading…" : "Load more requests"}
          </button>
        )}
        {selected && (
          <section className={styles.card} style={{ marginTop: 16 }}>
            <p className={styles.eyebrow}>
              {selected.id} · {selected.department}
            </p>
            <h2>{selected.title}</h2>
            {selected.decisionHistory?.map((decision, index) => (
              <p key={`${decision.status}-${decision.createdAt}-${index}`}>
                <strong>
                  {decision.status === "APPROVED"
                    ? language === "th"
                      ? "อนุมัติแล้ว"
                      : "Approved"
                    : t.rejectionReason}
                </strong>
                {decision.reason ? `: ${decision.reason}` : ""} ·{" "}
                {new Date(decision.createdAt).toLocaleString(
                  language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
                )}
              </p>
            ))}
            {(selected.status === "WITHDRAWN" || selected.status === "REJECTED") && (
              <p role="note">
                {selected.status === "WITHDRAWN"
                  ? language === "th"
                    ? "แก้ไขคำขอนี้ได้ เมื่อบันทึกแล้วคำขอจะกลับเป็นฉบับร่าง และต้องส่งเข้าคิวอนุมัติอีกครั้ง"
                    : "You can amend this request. Saving returns it to draft; submit it again for approval."
                  : language === "th"
                    ? "แก้ไขคำขอนี้ได้ เมื่อบันทึกแล้วคำขอจะกลับเป็นฉบับร่าง และต้องส่งเข้าคิวอนุมัติอีกครั้ง"
                    : "You can amend this rejected request. Saving returns it to draft; submit it again for approval."}
              </p>
            )}
            <p>{selected.objective || "No communication objective provided."}</p>
            {selected.whyNow && (
              <p>
                {language === "th" ? "เหตุผลที่ต้องสื่อสารช่วงนี้" : "Why now"}:{" "}
                {selected.whyNow}
              </p>
            )}
            {selected.projectOwner && (
              <p>
                {language === "th" ? "เจ้าของโครงการ" : "Project owner"}:{" "}
                {selected.projectOwner}
              </p>
            )}
            {selected.assigner && (
              <p>
                {language === "th" ? "ผู้มอบหมายงาน" : "Assigner"}: {selected.assigner}
              </p>
            )}
            {selected.contentTypes && selected.contentTypes.length > 0 && (
              <p>
                {language === "th" ? "ประเภทเนื้อหา" : "Content types"}:{" "}
                {selected.contentTypes.join(", ")}
              </p>
            )}
            {selected.priority && (
              <p>
                {language === "th" ? "ความสำคัญ" : "Priority"}: {selected.priority}
                {selected.priorityReason ? ` · ${selected.priorityReason}` : ""}
              </p>
            )}
            {selected.projectDetails && <p>{selected.projectDetails}</p>}
            {selected.type === "offsite" && (
              <p>
                {language === "th" ? "เวลาลงพื้นที่" : "Off-site time"}:{" "}
                {selected.startTime || "—"}–{selected.endTime || "—"} ·{" "}
                {selected.travel || "—"}
              </p>
            )}
            <p>
              {selected.sources?.length || selected.source
                ? `Source: ${(selected.sources?.length ? selected.sources : [selected.source]).join(", ")}`
                : "No source link provided."}
            </p>
            {selected.attachments && selected.attachments.length > 0 && (
              <div>
                <b>{language === "th" ? "ไฟล์ตัวอย่าง" : "Sample files"}</b>
                <ul>
                  {selected.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      {attachment.file.fileName} · {attachment.file.scanStatus}
                      {attachment.file.scanStatus === "CLEAN" &&
                        !attachment.file.deletedAt && (
                          <a href={`/api/pr-center/files/${attachment.file.id}/download`}>
                            {language === "th" ? " ดาวน์โหลด" : " Download"}
                          </a>
                        )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p>
              {selected.audience
                ? `Audience: ${selected.audience}`
                : "No target audience provided."}
            </p>
            <p>
              Tasks:{" "}
              {taskItems
                .filter((task) => task.requestId === selected.id)
                .map((task) => task.title)
                .join(", ") || "None"}
            </p>
            {canEditOwnRequest(selected, currentUserId) && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => onEditRequest(selected)}>
                  {selected.status === "WITHDRAWN" || selected.status === "REJECTED"
                    ? language === "th"
                      ? "แก้ไขและส่งใหม่"
                      : "Amend and resubmit"
                    : language === "th"
                      ? "แก้ไขคำขอ"
                      : "Edit request"}
                </button>
                {selected.status === "DRAFT" && (
                  <button
                    className={styles.primary}
                    onClick={() => onSubmitRequest(selected)}
                  >
                    Submit request
                  </button>
                )}
                {(selected.status === "DRAFT" || selected.status === "SUBMITTED") && (
                  <button onClick={() => onWithdrawRequest(selected)}>
                    Withdraw request
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </article>
    </>
  );
}
function Operations({
  tasks: taskItems,
  channels,
  language,
  onTransition,
  onAssign,
  onSchedule,
  onPublish,
  onCreateRevision,
  canManageTasks,
  currentUserId,
  canFactCheckPR,
  canConfigureApprovalRequirements,
  onFinalAssetAssigned,
  canViewPublishing,
}: {
  tasks: Task[];
  channels: string[];
  language: Language;
  onTransition: (taskId: string, status: StatusId) => void;
  onAssign: (
    taskId: string,
    ownerId: string,
    dueDate: string,
    planningKeyMessage?: string,
    technicalReviewRequired?: boolean,
    managementApprovalRequired?: boolean,
  ) => Promise<void>;
  onSchedule: (taskId: string, channel: string, scheduledFor: string) => Promise<boolean>;
  onPublish: (
    taskId: string,
    channel: string,
    publishedUrl: string,
    publishedReference: string,
  ) => Promise<boolean>;
  onCreateRevision: (
    taskId: string,
    body: string,
    keyMessage: string,
    changeSummary: string,
  ) => Promise<boolean>;
  canManageTasks: boolean;
  canConfigureApprovalRequirements: boolean;
  currentUserId: string;
  canFactCheckPR: boolean;
  onFinalAssetAssigned: (taskId: string, fileId: string) => void;
  canViewPublishing: boolean;
}) {
  const [view, setView] = useState<"board" | "table" | "publishing">("board");
  const [status, setStatus] = useState<"all" | StatusId>("all");
  const [ownerId, setOwnerId] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [planningKeyMessage, setPlanningKeyMessage] = useState("");
  const [technicalReviewRequired, setTechnicalReviewRequired] = useState(false);
  const [managementApprovalRequired, setManagementApprovalRequired] = useState(false);
  const [channel, setChannel] = useState("");
  const [evidenceChannel, setEvidenceChannel] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [publishedReference, setPublishedReference] = useState("");
  const [revisionBody, setRevisionBody] = useState("");
  const [revisionKeyMessage, setRevisionKeyMessage] = useState("");
  const [revisionSummary, setRevisionSummary] = useState("");
  const [savingRevision, setSavingRevision] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [assignableUsers, setAssignableUsers] = useState<
    { id: string; displayName: string; department?: { name: string } | null }[]
  >([]);
  const [scheduleChoices, setScheduleChoices] = useState<
    { id: string; channel: string; scheduledFor: string }[]
  >([]);
  const [scheduleChoicesTaskId, setScheduleChoicesTaskId] = useState<string | null>(null);
  const [activity, setActivity] = useState<{
    comments: {
      id: string;
      body: string;
      createdAt: string;
      author: { displayName: string };
    }[];
    statuses: { id: string; fromState: string; toState: string; createdAt: string }[];
    audit: { id: string; action: string; createdAt: string }[];
  } | null>(null);
  const [activityTaskId, setActivityTaskId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [activityError, setActivityError] = useState("");
  const loadTaskActivity = async (taskId: string) => {
    const response = await fetch(`/api/pr-center/tasks/${taskId}/history`, {
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Unable to load task history");
    setActivity(await response.json());
    setActivityTaskId(taskId);
  };
  const loadTaskSchedules = async (taskId: string) => {
    setScheduleChoicesTaskId(null);
    const response = await fetch(`/api/pr-center/tasks/${taskId}/schedules`, {
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Unable to load task schedules");
    const schedules = (await response.json()) as {
      id: string;
      channel: string;
      scheduledFor: string;
    }[];
    setScheduleChoices(schedules);
    setScheduleChoicesTaskId(taskId);
    if (schedules[0])
      setEvidenceChannel((previous) =>
        schedules.some((schedule) => schedule.channel === previous)
          ? previous
          : schedules[0].channel,
      );
  };
  useEffect(() => {
    if (!canManageTasks) return;
    fetch("/api/pr-center/users/assignable", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.ok) setAssignableUsers(await response.json());
      })
      .catch(() => undefined);
  }, [canManageTasks]);
  useEffect(() => {
    if (!selectedId || !canManageTasks) return;
    let cancelled = false;
    fetch(`/api/pr-center/tasks/${selectedId}/history`, {
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load task history");
        setActivity(await response.json());
        setActivityTaskId(selectedId);
      })
      .catch(() => setActivityError("Unable to load task activity"));
    fetch(`/api/pr-center/tasks/${selectedId}/schedules`, {
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load task schedules");
        const schedules = (await response.json()) as {
          id: string;
          channel: string;
          scheduledFor: string;
        }[];
        if (cancelled) return;
        setScheduleChoices(schedules);
        setScheduleChoicesTaskId(selectedId);
        if (schedules[0])
          setEvidenceChannel((previous) =>
            schedules.some((schedule) => schedule.channel === previous)
              ? previous
              : schedules[0].channel,
          );
      })
      .catch(() => {
        if (cancelled) return;
        setScheduleChoices([]);
        setScheduleChoicesTaskId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, canManageTasks]);
  const visibleTasks = taskItems.filter(
    (task) =>
      (canManageTasks ||
        task.ownerId === currentUserId ||
        task.requesterId === currentUserId) &&
      (status === "all" || task.status === status) &&
      (ownerId === "all" || task.ownerId === ownerId),
  );
  const columns: [string, StatusId[]][] = [
    ["New request", ["draft", "waiting_for_information"]],
    ["Planning", ["communication_planning"]],
    ["In production", ["in_production"]],
    [
      "Review",
      [
        "source_fact_check",
        "technical_review",
        "pr_editorial_review",
        "management_approval",
      ],
    ],
    ["Scheduled", ["approved", "scheduled", "published", "closed"]],
  ];
  const selected = visibleTasks.find((task) => task.id === selectedId);
  const currentActivity = activityTaskId === selected?.id ? activity : null;
  return (
    <>
      <SectionHeading
        eyebrow="CONTENT OPERATIONS"
        title={
          view === "publishing"
            ? language === "th"
              ? "สถานะการเผยแพร่"
              : "Publishing status"
            : "Production board"
        }
        action={
          <div className={styles.segmented}>
            <button aria-pressed={view === "board"} onClick={() => setView("board")}>
              Board
            </button>
            <button aria-pressed={view === "table"} onClick={() => setView("table")}>
              Table
            </button>
            {canViewPublishing && (
              <button
                aria-pressed={view === "publishing"}
                onClick={() => setView("publishing")}
              >
                Publishing status
              </button>
            )}
          </div>
        }
      />
      {view !== "publishing" && (
        <section className={styles.filterBar}>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | StatusId)}
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
            <option value="all">All owners</option>
            {assignableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </section>
      )}
      {view === "publishing" && canViewPublishing && (
        <PublishingOperations language={language} />
      )}
      {view === "board" && (
        <div className={styles.board}>
          {columns.map(([column, statuses]) => (
            <section key={column}>
              <header>
                <b>{column}</b>
                <span>
                  {visibleTasks.filter((task) => statuses.includes(task.status)).length}
                </span>
              </header>
              {visibleTasks
                .filter((task) => statuses.includes(task.status))
                .map((task) => (
                  <article key={`${column}-${task.id}`} id={`task-${task.id}`}>
                    <small>{task.type}</small>
                    <b>{task.title}</b>
                    <Status>{STATUS_LABELS[task.status]}</Status>
                    <footer>
                      {getUser(task.ownerId)?.name ?? task.ownerName ?? "Unassigned"}
                      <span>{task.dueDate}</span>
                    </footer>
                    <button
                      onClick={() => {
                        setSelectedId(task.id);
                        setDueDate(task.dueDate);
                        setAssigneeId(task.ownerId);
                        setPlanningKeyMessage(task.planningKeyMessage || "");
                        setTechnicalReviewRequired(task.technicalReviewRequired === true);
                        setManagementApprovalRequired(
                          task.managementApprovalRequired === true,
                        );
                        setRevisionBody(task.contentBody || "");
                        setRevisionKeyMessage(task.keyMessage || "");
                        setRevisionSummary("");
                      }}
                    >
                      Details
                    </button>
                  </article>
                ))}
            </section>
          ))}
        </div>
      )}
      {view === "table" && (
        <article className={styles.card}>
          <h2>{language === "th" ? "มุมมองตาราง" : "Table view"}</h2>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {[
                    language === "th" ? "ประเภท" : "Type",
                    language === "th" ? "เนื้อหา" : "Content",
                    language === "th" ? "สถานะ" : "Status",
                    language === "th" ? "ผู้รับผิดชอบ" : "Owner",
                    language === "th" ? "รายละเอียด" : "Details",
                  ].map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.type}</td>
                    <td>{task.title}</td>
                    <td>
                      <Status>{STATUS_LABELS[task.status]}</Status>
                    </td>
                    <td>
                      {getUser(task.ownerId)?.name ??
                        task.ownerName ??
                        (language === "th" ? "ยังไม่มอบหมาย" : "Unassigned")}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(task.id);
                          setDueDate(task.dueDate);
                          setAssigneeId(task.ownerId);
                          setPlanningKeyMessage(task.planningKeyMessage || "");
                          setTechnicalReviewRequired(
                            task.technicalReviewRequired === true,
                          );
                          setManagementApprovalRequired(
                            task.managementApprovalRequired === true,
                          );
                          setRevisionBody(task.contentBody || "");
                          setRevisionKeyMessage(task.keyMessage || "");
                          setRevisionSummary("");
                        }}
                      >
                        {language === "th" ? "เปิดรายละเอียด" : "Open details"}
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleTasks.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      {language === "th"
                        ? "ไม่พบงานตามตัวกรอง"
                        : "No tasks match these filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}
      {selected && view !== "publishing" && (
        <article className={styles.card}>
          <p className={styles.eyebrow}>
            {selected.id} · due {selected.dueDate}
          </p>
          <h2>{selected.title}</h2>
          <p>
            {language === "th" ? "ฉบับเนื้อหา" : "Content revision"}:{" "}
            {selected.revisionNumber ?? "—"}
            {selected.keyMessage ? ` · ${selected.keyMessage}` : ""}
          </p>
          {selected.contentBody && (
            <section className={styles.card}>
              <h3>{language === "th" ? "เนื้อหาฉบับปัจจุบัน" : "Current content"}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{selected.contentBody}</p>
            </section>
          )}
          {selected.sourceUrls && selected.sourceUrls.length > 0 && (
            <section className={styles.card}>
              <h3>
                {language === "th" ? "แหล่งข้อมูลที่แนบกับคำขอ" : "Request sources"}
              </h3>
              <ul>
                {selected.sourceUrls.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {canManageTasks &&
            selected.requestStatus === "APPROVED" &&
            ["in_production", "revision_required"].includes(selected.status) && (
              <form
                className={styles.taskRevisionForm}
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (savingRevision) return;
                  setSavingRevision(true);
                  const saved = await onCreateRevision(
                    selected.id,
                    revisionBody,
                    revisionKeyMessage,
                    revisionSummary,
                  );
                  if (saved) {
                    setRevisionBody("");
                    setRevisionSummary("");
                  }
                  setSavingRevision(false);
                }}
              >
                <h3>
                  {language === "th"
                    ? "บันทึกฉบับเนื้อหาใหม่"
                    : "Create content revision"}
                </h3>
                <label>
                  {language === "th" ? "เนื้อหาฉบับที่จะส่งตรวจ" : "Content to review"}
                  <textarea
                    value={revisionBody}
                    onChange={(event) => setRevisionBody(event.target.value)}
                    maxLength={20000}
                    rows={4}
                    required
                  />
                </label>
                <label>
                  {language === "th" ? "Key Message" : "Key message"}
                  <textarea
                    value={revisionKeyMessage}
                    onChange={(event) => setRevisionKeyMessage(event.target.value)}
                    maxLength={2000}
                    rows={2}
                    required
                  />
                </label>
                <label>
                  {language === "th" ? "สรุปการเปลี่ยนแปลง" : "Change summary"}
                  <input
                    value={revisionSummary}
                    onChange={(event) => setRevisionSummary(event.target.value)}
                    maxLength={1000}
                  />
                </label>
                <button
                  className={styles.secondaryButton}
                  type="submit"
                  disabled={savingRevision}
                >
                  {savingRevision
                    ? language === "th"
                      ? "กำลังบันทึก…"
                      : "Saving…"
                    : language === "th"
                      ? "บันทึกและส่งกลับเข้าสู่การผลิต"
                      : "Save and return to production"}
                </button>
              </form>
            )}
          {canManageTasks && (
            <>
              <label>
                Assign to{" "}
                <select
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {assignableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName}
                      {user.department?.name ? ` · ${user.department.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {selected.planningKeyMessage && (
                <p>
                  <strong>
                    {language === "th"
                      ? "Key Message สำหรับแผนงาน:"
                      : "Planning key message:"}
                  </strong>{" "}
                  {selected.planningKeyMessage}
                </p>
              )}
              {selected.status === "communication_planning" &&
                canConfigureApprovalRequirements && (
                  <fieldset className={styles.card}>
                    <legend>
                      {language === "th"
                        ? "ขั้นตอนตรวจอนุมัติของงานนี้"
                        : "Review requirements for this task"}
                    </legend>
                    <label>
                      <input
                        type="checkbox"
                        checked={technicalReviewRequired}
                        onChange={(event) =>
                          setTechnicalReviewRequired(event.target.checked)
                        }
                      />
                      {language === "th"
                        ? "ต้องตรวจงานเทคนิค (ผู้อนุมัติ/PR)"
                        : "Require technical review (Approver/PR)"}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={managementApprovalRequired}
                        onChange={(event) =>
                          setManagementApprovalRequired(event.target.checked)
                        }
                      />
                      {language === "th"
                        ? "ต้องขออนุมัติจากผู้บริหาร"
                        : "Require management approval"}
                    </label>
                  </fieldset>
                )}
              {selected.status === "communication_planning" && (
                <label>
                  {language === "th" ? "Key Message (แผนงาน)" : "Planning key message"}
                  <textarea
                    value={planningKeyMessage}
                    onChange={(event) => setPlanningKeyMessage(event.target.value)}
                    maxLength={2000}
                    rows={2}
                    placeholder={
                      language === "th"
                        ? "ใจความสำคัญที่ต้องการสื่อ"
                        : "Core message to communicate"
                    }
                  />
                </label>
              )}
              <label>
                Due date{" "}
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
              <button
                onClick={() =>
                  onAssign(
                    selected.id,
                    assigneeId,
                    dueDate,
                    selected.status === "communication_planning"
                      ? planningKeyMessage
                      : undefined,
                    selected.status === "communication_planning" &&
                      canConfigureApprovalRequirements
                      ? technicalReviewRequired
                      : undefined,
                    selected.status === "communication_planning" &&
                      canConfigureApprovalRequirements
                      ? managementApprovalRequired
                      : undefined,
                  )
                }
              >
                Save assignment
              </button>
            </>
          )}
          {(canFactCheckPR || selected.ownerId === currentUserId) &&
            selected.revisionNumber !== undefined &&
            ["in_production", "source_fact_check", "revision_required"].includes(
              selected.status,
            ) && (
              <TaskFactCheckPanel key={selected.id} task={selected} language={language} />
            )}
          {canManageTasks &&
            STATUS_TRANSITIONS[selected.status].filter(
              (next) =>
                next !== "scheduled" &&
                next !== "published" &&
                !(selected.status === "published" && next === "closed"),
            ).length > 0 && (
              <label>
                Move to{" "}
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value)
                      onTransition(selected.id, event.target.value as StatusId);
                  }}
                >
                  <option value="">Choose a legal next state</option>
                  {STATUS_TRANSITIONS[selected.status]
                    .filter((next) => next !== "scheduled" && next !== "published")
                    .map((next) => (
                      <option key={next} value={next}>
                        {STATUS_LABELS[next]}
                      </option>
                    ))}
                </select>
              </label>
            )}
          {canManageTasks &&
            (selected.status === "approved" || selected.status === "scheduled") && (
              <>
                <label>
                  Channel{" "}
                  <select
                    value={channel}
                    onChange={(event) => setChannel(event.target.value)}
                    required
                  >
                    <option value="">Select a channel</option>
                    {channels.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {language === "th"
                    ? "วันและเวลาเผยแพร่ (เวลาไทย, Asia/Bangkok)"
                    : "Schedule time (Thailand, Asia/Bangkok)"}{" "}
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                    required
                  />
                </label>
                <button
                  onClick={async () => {
                    const saved = await onSchedule(selected.id, channel, scheduledFor);
                    if (saved)
                      await loadTaskSchedules(selected.id).catch(() =>
                        setScheduleChoices([]),
                      );
                  }}
                >
                  Schedule channel
                </button>
              </>
            )}
          {canManageTasks &&
            (selected.status === "scheduled" || selected.status === "published") &&
            scheduleChoices.length > 0 && (
              <>
                <label>
                  Evidence channel{" "}
                  <select
                    value={evidenceChannel}
                    onChange={(event) => setEvidenceChannel(event.target.value)}
                  >
                    {scheduleChoices.map((schedule) => (
                      <option key={schedule.id} value={schedule.channel}>
                        {schedule.channel} ·{" "}
                        {new Date(schedule.scheduledFor).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Published URL{" "}
                  <input
                    type="url"
                    value={publishedUrl}
                    onChange={(event) => setPublishedUrl(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Publication reference{" "}
                  <input
                    value={publishedReference}
                    onChange={(event) => setPublishedReference(event.target.value)}
                    required
                  />
                </label>
                <button
                  onClick={async () => {
                    const saved = await onPublish(
                      selected.id,
                      evidenceChannel,
                      publishedUrl,
                      publishedReference,
                    );
                    if (saved)
                      await loadTaskSchedules(selected.id).catch(() =>
                        setScheduleChoices([]),
                      );
                  }}
                >
                  Record publishing evidence
                </button>
              </>
            )}
          {canManageTasks && selected.status === "published" && (
            <section className={styles.card} aria-labelledby="close-published-task">
              <h3 id="close-published-task">
                {language === "th" ? "10. ปิดงาน" : "10. Close task"}
              </h3>
              {scheduleChoicesTaskId !== selected.id ? (
                <p role="status">
                  {language === "th"
                    ? "กำลังตรวจสอบสถานะหลักฐานเผยแพร่ของทุกช่องทาง"
                    : "Checking publication evidence for every scheduled channel…"}
                </p>
              ) : scheduleChoices.length > 0 ? (
                <p role="status">
                  {language === "th"
                    ? `ยังต้องเผยแพร่และบันทึกหลักฐานอีก ${scheduleChoices.length} ช่องทางก่อนปิดงาน`
                    : `Publish and record evidence for ${scheduleChoices.length} remaining channel(s) before closing.`}
                </p>
              ) : (
                <p role="status">
                  {language === "th"
                    ? "บันทึกหลักฐานครบทุกช่องทางแล้ว สามารถปิดงานได้"
                    : "Publication evidence is recorded for every scheduled channel. The task is ready to close."}
                </p>
              )}
              <button
                type="button"
                disabled={
                  scheduleChoicesTaskId !== selected.id || scheduleChoices.length > 0
                }
                onClick={() => onTransition(selected.id, "closed")}
              >
                {language === "th" ? "ปิดงาน" : "Close task"}
              </button>
            </section>
          )}
          {canManageTasks && (
            <section className={styles.card}>
              <h3>Comments and activity</h3>
              {activityError && <p role="alert">{activityError}</p>}
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  try {
                    const response = await fetch(
                      `/api/pr-center/tasks/${selected.id}/comments`,
                      {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ body: commentBody }),
                      },
                    );
                    if (!response.ok) {
                      setActivityError("Unable to add comment");
                      return;
                    }
                    setCommentBody("");
                    setActivityError("");
                    await loadTaskActivity(selected.id).catch(() =>
                      setActivityError("Unable to reload task activity"),
                    );
                  } catch {
                    setActivityError("Unable to add or reload task comment");
                  }
                }}
              >
                <label>
                  Add comment{" "}
                  <textarea
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    maxLength={5000}
                    required
                  />
                </label>
                <button type="submit" disabled={!commentBody.trim()}>
                  Add comment
                </button>
              </form>
              <ul>
                {currentActivity?.comments.map((comment) => (
                  <li key={comment.id}>
                    <b>{comment.author.displayName}</b> ·{" "}
                    {new Date(comment.createdAt).toLocaleString()}
                    <p>{comment.body}</p>
                  </li>
                ))}
                {currentActivity?.statuses.map((entry) => (
                  <li key={entry.id}>
                    Status: {entry.fromState} → {entry.toState} ·{" "}
                    {new Date(entry.createdAt).toLocaleString()}
                  </li>
                ))}
                {currentActivity?.audit.map((entry) => (
                  <li key={entry.id}>
                    {entry.action} · {new Date(entry.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {canManageTasks && (
            <AttachmentPanel
              taskId={selected.id}
              taskVersion={selected.version ?? 0}
              revisionNumber={selected.revisionNumber}
              finalAssetId={selected.finalAssetId}
              onFinalAssetAssigned={(fileId) => onFinalAssetAssigned(selected.id, fileId)}
            />
          )}
        </article>
      )}
    </>
  );
}
function TaskFactCheckPanel({ task, language }: { task: Task; language: Language }) {
  type FactCheck = NonNullable<Task["factChecks"]>[number];
  const [checks, setChecks] = useState<FactCheck[]>(task.factChecks || []);
  const [claim, setClaim] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] =
    useState<FactCheck["items"][number]["result"]>("NEEDS_EVIDENCE");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <section className={styles.card}>
      <h3>
        {language === "th"
          ? "ตรวจสอบข้อเท็จจริงและแหล่งอ้างอิง"
          : "Fact-check and sources"}
      </h3>
      <p>
        {language === "th"
          ? `ตรวจเนื้อหา revision ${task.revisionNumber} โดยบันทึกทีละข้อ`
          : `Record one checked claim at a time for revision ${task.revisionNumber}.`}
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) return;
          setSaving(true);
          setError("");
          try {
            const response = await fetch(`/api/pr-center/tasks/${task.id}/fact-checks`, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                summary,
                items: [{ claim, evidenceUrl, note, result }],
              }),
            });
            const payload = (await response.json().catch(() => null)) as
              | (FactCheck & { message?: string })
              | null;
            if (!response.ok || !payload?.id)
              throw new Error(payload?.message || "Unable to save fact check");
            setChecks((previous) => [payload, ...previous]);
            setClaim("");
            setEvidenceUrl("");
            setNote("");
            setSummary("");
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "Unable to save fact check",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          {language === "th" ? "ข้อเท็จจริง/ข้อความที่ตรวจ" : "Claim checked"}
          <textarea
            value={claim}
            onChange={(event) => setClaim(event.target.value)}
            maxLength={2000}
            required
            rows={2}
          />
        </label>
        <label>
          {language === "th" ? "URL หลักฐาน (HTTPS)" : "Evidence URL (HTTPS)"}
          <input
            type="url"
            value={evidenceUrl}
            onChange={(event) => setEvidenceUrl(event.target.value)}
            required
          />
        </label>
        <label>
          {language === "th" ? "ผลตรวจ" : "Result"}
          <select
            value={result}
            onChange={(event) =>
              setResult(event.target.value as FactCheck["items"][number]["result"])
            }
          >
            <option value="VERIFIED">
              {language === "th" ? "ยืนยันแล้ว" : "Verified"}
            </option>
            <option value="NEEDS_CORRECTION">
              {language === "th" ? "ต้องแก้ไข" : "Needs correction"}
            </option>
            <option value="NEEDS_EVIDENCE">
              {language === "th" ? "หลักฐานยังไม่พอ" : "Needs evidence"}
            </option>
          </select>
        </label>
        <label>
          {language === "th" ? "หมายเหตุ" : "Note"}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2000}
            rows={2}
          />
        </label>
        <label>
          {language === "th" ? "สรุปผลตรวจ (ถ้ามี)" : "Check summary (optional)"}
          <input
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={2000}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={saving || !claim.trim() || !evidenceUrl.trim()}>
          {saving
            ? language === "th"
              ? "กำลังบันทึก…"
              : "Saving…"
            : language === "th"
              ? "บันทึกผลตรวจ"
              : "Record fact check"}
        </button>
      </form>
      <ul>
        {checks.map((check) => (
          <li key={check.id}>
            <strong>
              {check.taskRevision === task.revisionNumber
                ? ""
                : language === "th"
                  ? "ผลตรวจของ revision เก่า · "
                  : "Older revision · "}
              {check.items[0]?.result}
            </strong>
            <span>
              {" "}
              · {check.checkedBy.displayName} ·{" "}
              {new Date(check.checkedAt).toLocaleString()}
            </span>
            {check.items.map((item, index) => (
              <div key={`${check.id}-${index}`}>
                <p>
                  {item.claim} — {item.result}
                </p>
                <a href={item.evidenceUrl} target="_blank" rel="noreferrer">
                  {item.evidenceUrl}
                </a>
                {item.note && <p>{item.note}</p>}
              </div>
            ))}
            {check.summary && <p>{check.summary}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PublishingOperations({ language }: { language: Language }) {
  const [range, setRange] = useState(() => {
    const from = new Date();
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - 14);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 44);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  });
  const [draftRange, setDraftRange] = useState(range);
  const fromDate = new Date(`${draftRange.from}T00:00:00Z`);
  const toDate = new Date(`${draftRange.to}T00:00:00Z`);
  const rangeDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000 + 1;
  const rangeValid = Number.isFinite(rangeDays) && rangeDays >= 1 && rangeDays <= 45;
  const rangeKey = `${range.from}:${range.to}`;
  const [status, setStatus] = useState<"ALL" | "SCHEDULED" | "PUBLISHED">("ALL");
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    entries: CalendarEntry[];
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const toExclusive = new Date(`${range.to}T00:00:00Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const key = `${rangeKey}:${reload}`;
    fetch(
      `/api/pr-center/calendar?from=${encodeURIComponent(`${range.from}T00:00:00.000Z`)}&to=${encodeURIComponent(toExclusive.toISOString())}`,
      { credentials: "same-origin", cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Publishing records unavailable");
        return parseCalendarEntries(await response.json());
      })
      .then((entries) => {
        if (!controller.signal.aborted) setResult({ key, entries, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, entries: [], failed: true });
      });
    return () => controller.abort();
  }, [range.from, range.to, rangeKey, reload]);

  const current = result?.key === `${rangeKey}:${reload}` ? result : null;
  const entries = (current?.entries ?? []).filter(
    (entry) => entry.status !== "DRAFT" && (status === "ALL" || entry.status === status),
  );
  const locale = language === "th" ? "th-TH-u-ca-buddhist" : "en-GB";
  const text = language === "th";

  return (
    <article className={styles.card}>
      <SectionHeading
        eyebrow={text ? "สถานะการเผยแพร่" : "PUBLISHING STATUS"}
        title={
          text ? "กำหนดการและหลักฐานที่บันทึกแล้ว" : "Schedules and recorded evidence"
        }
        action={
          <button
            type="button"
            disabled={!current}
            onClick={() => setReload((value) => value + 1)}
          >
            {text ? "รีเฟรช" : "Refresh"}
          </button>
        }
      />
      <p role="note">
        {text
          ? "ข้อมูลจากกำหนดการและหลักฐานที่บันทึกในระบบเท่านั้น หน้านี้ไม่เผยแพร่ ไม่ retry และไม่เชื่อมต่อช่องทางภายนอก · เวลา UTC"
          : "Read-only schedule and evidence records only. This view does not publish, retry, or connect to external channels · Times in UTC."}
      </p>
      <div className={styles.filterBar}>
        <label>
          {text ? "ตั้งแต่ (UTC)" : "From (UTC)"}
          <input
            type="date"
            value={draftRange.from}
            onChange={(event) =>
              setDraftRange((previous) => ({ ...previous, from: event.target.value }))
            }
          />
        </label>
        <label>
          {text ? "ถึง (UTC)" : "Through (UTC)"}
          <input
            type="date"
            value={draftRange.to}
            onChange={(event) =>
              setDraftRange((previous) => ({ ...previous, to: event.target.value }))
            }
          />
        </label>
        <button
          type="button"
          disabled={!rangeValid}
          onClick={() => setRange({ ...draftRange })}
        >
          {text ? "แสดงช่วงวันที่" : "Apply date range"}
        </button>
      </div>
      {!rangeValid && (
        <p role="alert">
          {text
            ? "เลือกช่วงวันที่ 1–45 วัน โดยวันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น"
            : "Choose 1–45 days, with the end on or after the start."}
        </p>
      )}
      <label>
        {text ? "สถานะ" : "Status"}{" "}
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="ALL">{text ? "ทั้งหมด" : "All"}</option>
          <option value="SCHEDULED">{text ? "กำหนดเผยแพร่" : "Scheduled"}</option>
          <option value="PUBLISHED">{text ? "เผยแพร่แล้ว" : "Published"}</option>
        </select>
      </label>
      {!current && <p role="status">{text ? "กำลังโหลด…" : "Loading…"}</p>}
      {current?.failed && (
        <p role="alert">
          {text ? "โหลดสถานะการเผยแพร่ไม่สำเร็จ" : "Unable to load publishing status."}
        </p>
      )}
      {current && !current.failed && entries.length === 0 && (
        <p role="status">
          {text
            ? "ไม่พบรายการในช่วง 14 วันย้อนหลังถึง 30 วันข้างหน้า"
            : "No records from the last 14 days through the next 30 days."}
        </p>
      )}
      {current && !current.failed && entries.length > 0 && (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>{text ? "คำขอ / เนื้อหา" : "Request / content"}</th>
                <th>{text ? "ช่องทาง" : "Channel"}</th>
                <th>{text ? "ฉบับ" : "Revision"}</th>
                <th>{text ? "สถานะ" : "Status"}</th>
                <th>{text ? "เวลา (UTC)" : "Time (UTC)"}</th>
                <th>{text ? "หลักฐานที่บันทึก" : "Recorded evidence"}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {entry.requestNumber} · {entry.title}
                  </td>
                  <td>{entry.channel}</td>
                  <td>{entry.taskRevision ?? "—"}</td>
                  <td>
                    {entry.status === "PUBLISHED"
                      ? text
                        ? "เผยแพร่แล้ว"
                        : "Published"
                      : text
                        ? "กำหนดเผยแพร่"
                        : "Scheduled"}
                  </td>
                  <td>
                    {new Date(entry.date).toLocaleString(locale, { timeZone: "UTC" })}
                  </td>
                  <td>
                    {entry.status === "SCHEDULED" ? (
                      text ? (
                        "รอเผยแพร่/บันทึกหลักฐาน"
                      ) : (
                        "Awaiting publication/evidence"
                      )
                    ) : (
                      <>
                        {entry.publishedUrl ? (
                          <a href={entry.publishedUrl} target="_blank" rel="noreferrer">
                            {text ? "เปิดลิงก์" : "Open link"}
                          </a>
                        ) : text ? (
                          "ไม่มี URL"
                        ) : (
                          "No URL"
                        )}
                        {entry.publishedReference && (
                          <span> · {entry.publishedReference}</span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function AttachmentPanel({
  taskId,
  taskVersion,
  revisionNumber,
  finalAssetId,
  onFinalAssetAssigned,
}: {
  taskId: string;
  taskVersion: number;
  revisionNumber?: number;
  finalAssetId?: string | null;
  onFinalAssetAssigned: (fileId: string) => void;
}) {
  const [attachments, setAttachments] = useState<
    Array<{
      id: string;
      kind: string;
      version: number;
      file: {
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        scanStatus: string;
      };
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/pr-center/attachments?taskId=${taskId}`, {
      credentials: "same-origin",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load attachments");
        setAttachments(await r.json());
      })
      .catch(() => setError("Could not load attachments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pr-center/attachments?taskId=${taskId}`, {
      credentials: "same-origin",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load attachments");
        const data = await r.json();
        if (!cancelled) setAttachments(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load attachments");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const handleUpload = async (event: { target: HTMLInputElement }) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setNotice(null);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const uploadRes = await fetch("/api/pr-center/files", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          content: base64,
        }),
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => null);
        throw new Error(err?.message || "Upload failed");
      }
      const uploaded = (await uploadRes.json()) as { id: string };
      const attachRes = await fetch("/api/pr-center/attachments", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: uploaded.id,
          taskId,
          kind: "evidence",
        }),
      });
      if (!attachRes.ok) throw new Error("Attachment link failed");
      setNotice("File attached");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleRemove = async (attachmentId: string) => {
    try {
      const res = await fetch(`/api/pr-center/attachments/${attachmentId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Remove failed");
      setNotice("Attachment removed");
      reload();
    } catch {
      setError("Remove failed");
    }
  };

  const handleAssignFinalAsset = async (fileId: string) => {
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/pr-center/tasks/${taskId}/final-asset`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "If-Match": String(taskVersion),
        },
        body: JSON.stringify({ fileId, revisionNumber }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(result?.message || "Could not set final asset");
      }
      onFinalAssetAssigned(fileId);
      setNotice("Final asset assigned to this revision");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not set final asset");
    }
  };

  const handleDownload = (fileId: string) => {
    window.open(`/api/pr-center/files/${fileId}/download`, "_blank");
  };

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <section style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
      <p className={styles.eyebrow}>ATTACHMENTS</p>
      {notice && (
        <p style={{ color: "#16a34a", fontSize: 13, margin: "4px 0" }}>{notice}</p>
      )}
      {error && (
        <p style={{ color: "#dc2626", fontSize: 13, margin: "4px 0" }}>{error}</p>
      )}
      {loading && <p style={{ fontSize: 13 }}>Loading…</p>}
      {!loading && attachments.length === 0 && (
        <p style={{ fontSize: 13, color: "#6b7280" }}>No files attached.</p>
      )}
      {attachments.map((att) => {
        const isClean = att.file.scanStatus === "CLEAN";
        return (
          <div
            key={att.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
              fontSize: 13,
            }}
          >
            <span>{att.file.fileName}</span>
            {finalAssetId === att.file.id && <b>Final asset</b>}
            <span style={{ color: "#6b7280" }}>{formatSize(att.file.sizeBytes)}</span>
            <span style={{ color: "#6b7280" }}>
              {att.kind} v{att.version}
            </span>
            <span
              style={{
                display: "inline-block",
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
                backgroundColor:
                  att.file.scanStatus === "CLEAN"
                    ? "#16a34a"
                    : att.file.scanStatus === "PENDING"
                      ? "#d97706"
                      : att.file.scanStatus === "QUARANTINED"
                        ? "#dc2626"
                        : "#6b7280",
              }}
            >
              {att.file.scanStatus}
            </span>
            <button
              type="button"
              onClick={() => handleDownload(att.file.id)}
              disabled={!isClean}
              style={{
                fontSize: 12,
                opacity: isClean ? 1 : 0.4,
                cursor: isClean ? "pointer" : "not-allowed",
              }}
              title={isClean ? "Download" : "File must be CLEAN to download"}
            >
              Download
            </button>
            <button
              type="button"
              onClick={() => handleRemove(att.id)}
              disabled={!isClean}
              style={{
                fontSize: 12,
                color: "#dc2626",
                opacity: isClean ? 1 : 0.4,
                cursor: isClean ? "pointer" : "not-allowed",
              }}
              title={isClean ? "Remove" : "File must be CLEAN to remove"}
            >
              Remove
            </button>
            {revisionNumber !== undefined && isClean && (
              <button
                type="button"
                onClick={() => void handleAssignFinalAsset(att.file.id)}
                disabled={finalAssetId === att.file.id}
              >
                {finalAssetId === att.file.id
                  ? "Final asset selected"
                  : "Set as final asset"}
              </button>
            )}
          </div>
        );
      })}
      <label
        style={{
          display: "inline-block",
          marginTop: 8,
          fontSize: 13,
          cursor: "pointer",
          color: "#2563eb",
        }}
      >
        {uploading ? "Uploading…" : "📎 Attach file"}
        <input
          type="file"
          onChange={handleUpload}
          disabled={uploading}
          style={{ display: "none" }}
        />
      </label>
    </section>
  );
}

function Calendar({ language }: { language: Language }) {
  const [anchorDate, setAnchorDate] = useState(() => {
    return bangkokCalendarAnchor(new Date());
  });
  const [view, setView] = useState<"month" | "week">("month");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CalendarEntry["status"]>(
    "ALL",
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState(() => bangkokDateKey(new Date()));
  const [result, setResult] = useState<{
    key: string;
    entries: CalendarEntry[];
    failed: boolean;
  } | null>(null);
  const [decisionResult, setDecisionResult] = useState<{
    key: string;
    entries: CalendarRequestDecision[];
    failed: boolean;
  } | null>(null);

  const firstOfMonth = new Date(
    Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), 1),
  );
  const rangeStart = new Date(firstOfMonth);
  let dayCount = 42;
  if (view === "month") {
    rangeStart.setUTCDate(1 - ((firstOfMonth.getUTCDay() + 6) % 7));
  } else {
    rangeStart.setTime(anchorDate.getTime());
    rangeStart.setUTCDate(rangeStart.getUTCDate() - ((rangeStart.getUTCDay() + 6) % 7));
    dayCount = 7;
  }
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + dayCount);
  const from = new Date(rangeStart.getTime() - 7 * 60 * 60 * 1000).toISOString();
  const to = new Date(rangeEnd.getTime() - 7 * 60 * 60 * 1000).toISOString();
  const rangeKey = `${from}|${to}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/pr-center/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { credentials: "same-origin", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Calendar unavailable");
        return parseCalendarEntries(await response.json());
      })
      .then((entries) => {
        if (!controller.signal.aborted)
          setResult({ key: rangeKey, entries, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ key: rangeKey, entries: [], failed: true });
      });
    fetch(
      `/api/pr-center/calendar/request-decisions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { credentials: "same-origin", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Calendar request decisions unavailable");
        return parseCalendarRequestDecisions(await response.json());
      })
      .then((entries) => {
        if (!controller.signal.aborted)
          setDecisionResult({ key: rangeKey, entries, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDecisionResult({ key: rangeKey, entries: [], failed: true });
      });
    return () => controller.abort();
  }, [from, rangeKey, to]);

  const currentResult = result?.key === rangeKey ? result : null;
  const entries = currentResult?.entries ?? [];
  const currentDecisionResult = decisionResult?.key === rangeKey ? decisionResult : null;
  const decisions = currentDecisionResult?.entries ?? [];
  const selectedDayDecisions = decisions.filter(
    (decision) => bangkokDateKey(decision.date) === selectedDayKey,
  );
  const visibleEntries = entries.filter(
    (entry) => statusFilter === "ALL" || entry.status === statusFilter,
  );
  const days = Array.from(
    { length: dayCount },
    (_, index) => new Date(rangeStart.getTime() + index * 24 * 60 * 60 * 1000),
  );
  const locale = language === "th" ? "th-TH-u-ca-buddhist" : "en-GB";
  const monthLabel = anchorDate.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Bangkok",
    });
  const entryKey = (entry: CalendarEntry) => `${entry.status}:${entry.id}`;
  const selected = visibleEntries.find((entry) => entryKey(entry) === selectedKey);
  const statusLabelFor = (status: CalendarEntry["status"]) =>
    status === "DRAFT"
      ? language === "th"
        ? "กำหนดส่งฉบับร่าง"
        : "Draft due"
      : status === "SCHEDULED"
        ? language === "th"
          ? "กำหนดเผยแพร่"
          : "Scheduled"
        : language === "th"
          ? "เผยแพร่แล้ว"
          : "Published";
  const moveRange = (direction: -1 | 1) => {
    setAnchorDate((current) => {
      if (view === "month")
        return new Date(
          Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + direction, 1),
        );
      const next = new Date(current);
      next.setUTCDate(next.getUTCDate() + direction * 7);
      return next;
    });
    setSelectedKey(null);
  };
  const showToday = () => {
    const today = bangkokCalendarAnchor(new Date());
    setAnchorDate(today);
    setSelectedDayKey(bangkokDateKey(today));
    setSelectedKey(null);
  };

  return (
    <>
      <SectionHeading
        eyebrow={language === "th" ? "ปฏิทินเนื้อหา" : "CONTENT CALENDAR"}
        title={monthLabel}
        action={
          <div className={styles.segmented}>
            <button type="button" onClick={() => moveRange(-1)}>
              {language === "th" ? "ก่อนหน้า" : "Previous"}
            </button>
            <button type="button" onClick={() => setView("month")}>
              {language === "th" ? "เดือน" : "Month"}
            </button>
            <button type="button" onClick={() => setView("week")}>
              {language === "th" ? "สัปดาห์" : "Week"}
            </button>
            <button type="button" onClick={() => moveRange(1)}>
              {language === "th" ? "ถัดไป" : "Next"}
            </button>
            <button type="button" onClick={showToday}>
              {language === "th" ? "วันนี้" : "Today"}
            </button>
          </div>
        }
      />
      <p role="note">
        {language === "th"
          ? "เวลาแสดงตามเขตเวลา Asia/Bangkok · วันฉบับร่างคือกำหนดส่ง ไม่ใช่กำหนดเผยแพร่"
          : "Times are shown in Asia/Bangkok · Draft dates are due dates, not publication commitments."}
      </p>
      <section className={styles.filterBar}>
        <label>
          {language === "th" ? "สถานะ" : "Status"}
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | CalendarEntry["status"])
            }
          >
            <option value="ALL">{language === "th" ? "ทั้งหมด" : "All"}</option>
            <option value="SCHEDULED">
              {language === "th" ? "กำหนดเผยแพร่" : "Scheduled"}
            </option>
            <option value="PUBLISHED">
              {language === "th" ? "เผยแพร่แล้ว" : "Published"}
            </option>
            <option value="DRAFT">
              {language === "th" ? "ฉบับร่าง / กำหนดส่ง" : "Draft due"}
            </option>
          </select>
        </label>
      </section>
      {currentResult === null && (
        <p role="status" aria-live="polite">
          {language === "th" ? "กำลังโหลดปฏิทิน…" : "Loading calendar…"}
        </p>
      )}
      {currentResult?.failed && (
        <p role="alert">
          {language === "th" ? "โหลดปฏิทินไม่สำเร็จ" : "Calendar could not be loaded."}
        </p>
      )}
      {currentResult && !currentResult.failed && entries.length === 0 && (
        <p role="status">
          {language === "th"
            ? "ไม่มีรายการในช่วงเวลานี้"
            : "No entries in this date range."}
        </p>
      )}
      <article className={styles.card}>
        <div className={styles.calendarWeek}>
          {(language === "th"
            ? ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"]
            : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          ).map((day) => (
            <b key={day}>{day}</b>
          ))}
        </div>
        <div className={styles.calendar}>
          {days.map((day) => {
            const dayKey = day.toISOString().slice(0, 10);
            const dayEntries = visibleEntries.filter(
              (entry) => bangkokDateKey(entry.date) === dayKey,
            );
            const dayDecisions = decisions.filter(
              (decision) => bangkokDateKey(decision.date) === dayKey,
            );
            return (
              <div
                key={dayKey}
                className={
                  day.getUTCMonth() !== anchorDate.getUTCMonth() ? styles.mutedDay : ""
                }
              >
                <button
                  type="button"
                  className={styles.calendarDayButton}
                  aria-pressed={selectedDayKey === dayKey}
                  onClick={() => setSelectedDayKey(dayKey)}
                >
                  {day.toLocaleDateString(locale, { day: "numeric", timeZone: "UTC" })}
                  {dayDecisions.length > 0 && <small> · {dayDecisions.length} ✓</small>}
                </button>
                {dayEntries.map((entry) => (
                  <button
                    type="button"
                    key={entryKey(entry)}
                    className={`${styles.event} ${entry.contentType?.includes("Video") ? styles.videoEvent : ""}`}
                    onClick={() => setSelectedKey(entryKey(entry))}
                  >
                    {statusLabelFor(entry.status)} · {formatTime(entry.date)} ·{" "}
                    {entry.channel ? `${entry.channel}: ` : ""}
                    {entry.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </article>
      {selected && (
        <article className={styles.card}>
          <p className={styles.eyebrow}>{selected.requestNumber}</p>
          <h2>{selected.title}</h2>
          <p>
            {statusLabelFor(selected.status)} · {formatTime(selected.date)} UTC
            {selected.channel ? ` · ${selected.channel}` : ""}
          </p>
          {selected.status === "DRAFT" && (
            <p>
              {language === "th"
                ? "วันที่นี้เป็นกำหนดส่งงานฉบับร่าง ไม่ใช่กำหนดเผยแพร่ที่ยืนยันแล้ว"
                : "This is a draft due date, not a confirmed publication date."}
            </p>
          )}
          {selected.taskRevision !== null && (
            <p>
              {language === "th" ? "ฉบับงาน" : "Task revision"} {selected.taskRevision}
            </p>
          )}
        </article>
      )}
      <section className={styles.card} aria-labelledby="calendar-request-decisions-title">
        <SectionHeading
          eyebrow={language === "th" ? "กิจกรรมคำขอ" : "REQUEST ACTIVITY"}
          title={new Date(`${selectedDayKey}T00:00:00.000Z`).toLocaleDateString(locale, {
            dateStyle: "full",
            timeZone: "UTC",
          })}
        />
        <h2 id="calendar-request-decisions-title">
          {language === "th"
            ? "คำขอที่อนุมัติหรือปฏิเสธในวันนี้"
            : "Requests approved or rejected on this day"}
        </h2>
        {currentDecisionResult === null && (
          <p role="status">
            {language === "th" ? "กำลังโหลดกิจกรรม…" : "Loading request activity…"}
          </p>
        )}
        {currentDecisionResult?.failed && (
          <p role="alert">
            {language === "th"
              ? "โหลดกิจกรรมคำขอไม่สำเร็จ"
              : "Request activity could not be loaded."}
          </p>
        )}
        {currentDecisionResult &&
          !currentDecisionResult.failed &&
          selectedDayDecisions.length === 0 && (
            <p role="status">
              {language === "th"
                ? "วันนี้ยังไม่มีคำขอที่อนุมัติหรือปฏิเสธ"
                : "No requests were approved or rejected on this day."}
            </p>
          )}
        <div className={styles.list}>
          {selectedDayDecisions.map((decision) => (
            <article className={styles.listItem} key={decision.id}>
              <div>
                <Status>
                  {decision.decision === "APPROVED"
                    ? language === "th"
                      ? "อนุมัติคำขอ"
                      : "Request approved"
                    : language === "th"
                      ? "ปฏิเสธคำขอ"
                      : "Request rejected"}
                </Status>
                <h3>
                  {decision.requestNumber} · {decision.title}
                </h3>
                <p>
                  {decision.actorName} · {formatTime(decision.date)} Asia/Bangkok
                </p>
                {decision.reason && (
                  <p>
                    {language === "th" ? "เหตุผล" : "Reason"}: {decision.reason}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
function Approvals({
  language,
  tasks: taskItems,
  requests,
  canDecideRequests,
  canDecideTasks,
  requestQueueState,
  onDecision,
  onRequestDecision,
}: {
  language: Language;
  tasks: Task[];
  requests: RequestApprovalItem[];
  canDecideRequests: boolean;
  canDecideTasks: boolean;
  requestQueueState: "loading" | "loaded" | "error" | "not-authorized";
  onDecision: (
    taskId: string,
    decision: "APPROVED" | "REVISION_REQUIRED" | "REJECTED",
    reviewChecklist?: EditorialReviewChecklist,
  ) => void;
  onRequestDecision: (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
    comment: string,
  ) => Promise<boolean>;
}) {
  const [requestComments, setRequestComments] = useState<Record<string, string>>({});
  const [requestDecisionErrors, setRequestDecisionErrors] = useState<
    Record<string, string>
  >({});
  const [decidingRequestId, setDecidingRequestId] = useState<string | null>(null);
  const [editorialChecklists, setEditorialChecklists] = useState<
    Record<string, EditorialReviewChecklist>
  >({});

  const getEditorialChecklist = (taskId: string) =>
    editorialChecklists[taskId] ?? EMPTY_EDITORIAL_REVIEW_CHECKLIST;
  const isEditorialChecklistComplete = (checklist: EditorialReviewChecklist) =>
    EDITORIAL_REVIEW_ITEMS.every((item) => checklist[item.key]);

  const submitRequestDecision = async (
    request: RequestApprovalItem,
    decision: "APPROVED" | "REJECTED",
  ) => {
    const comment = requestComments[request.id]?.trim() || "";
    if (decision === "REJECTED" && !comment) {
      setRequestDecisionErrors((previous) => ({
        ...previous,
        [request.id]:
          language === "th"
            ? "กรุณาระบุเหตุผลก่อนปฏิเสธคำขอ"
            : "A reason is required to reject a request.",
      }));
      return;
    }
    setRequestDecisionErrors((previous) => ({ ...previous, [request.id]: "" }));
    setDecidingRequestId(request.id);
    const saved = await onRequestDecision(request.id, decision, comment);
    setDecidingRequestId(null);
    if (saved) {
      setRequestComments((previous) => ({ ...previous, [request.id]: "" }));
      setRequestDecisionErrors((previous) => ({ ...previous, [request.id]: "" }));
    }
  };

  return (
    <>
      <SectionHeading eyebrow="REVIEW AND APPROVAL" title="Approval Queue" />
      <h2>Submitted Requests · Intake Decision</h2>
      <section className={styles.list}>
        {requestQueueState === "loading" && (
          <p role="status">Loading submitted requests…</p>
        )}
        {requestQueueState === "error" && (
          <p role="alert">
            Could not load submitted requests. Reopen the queue to retry.
          </p>
        )}
        {requestQueueState === "not-authorized" && (
          <p role="note">
            Only PR Operations can view the request intake queue. Task-stage approvals
            appear below when your role allows them.
          </p>
        )}
        {requests.map((request) => (
          <article key={request.id} className={styles.listItem}>
            <div>
              <p>
                {request.requestNumber} · {request.department.name}
              </p>
              <h2>{request.title}</h2>
              <span>Submitted by {request.requester.displayName}</span>
              <details>
                <summary>
                  {language === "th" ? "ดูรายละเอียดคำขอ" : "View request details"}
                </summary>
                <p>
                  Type: {request.type} · Requested date:{" "}
                  {request.requestedFor?.slice(0, 10) || "—"}
                </p>
                <p>
                  Priority: {request.priority}
                  {request.priorityReason ? ` · ${request.priorityReason}` : ""}
                </p>
                {request.revisions[0]?.title && (
                  <p>
                    Revision {request.revisions[0].revisionNumber}:{" "}
                    {request.revisions[0].title}
                    {request.revisions[0].changeSummary
                      ? ` · ${request.revisions[0].changeSummary}`
                      : ""}
                  </p>
                )}
                {request.revisions[0]?.objective && (
                  <p>Objective: {request.revisions[0].objective}</p>
                )}
                {request.revisions[0]?.audience && (
                  <p>Audience: {request.revisions[0].audience}</p>
                )}
                {request.type === "OFFSITE" && (
                  <p>
                    Off-site details:{" "}
                    {(() => {
                      const value = request.revisions[0]?.offsiteDetails;
                      if (!value || typeof value !== "object" || Array.isArray(value))
                        return "Missing details";
                      const details = value as Record<string, unknown>;
                      return `${typeof details.startTime === "string" ? details.startTime : "—"} · ${typeof details.travel === "string" ? details.travel : "—"}`;
                    })()}
                  </p>
                )}
                {request.sources.map((source) => (
                  <p key={source.url}>
                    Source:{" "}
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.url}
                    </a>
                  </p>
                ))}
                {request.attachments.map((attachment) => (
                  <p key={attachment.id}>
                    Evidence: {attachment.file.fileName} · {attachment.file.scanStatus}
                    {attachment.file.scanStatus === "CLEAN" &&
                    !attachment.file.deletedAt ? (
                      <>
                        {" · "}
                        <a href={`/api/pr-center/files/${attachment.file.id}/download`}>
                          Download
                        </a>
                      </>
                    ) : (
                      <>
                        {" "}
                        ·{" "}
                        {language === "th"
                          ? "ยังดาวน์โหลดไม่ได้"
                          : "Not available for download"}
                      </>
                    )}
                  </p>
                ))}
                {request.statusHistory.map((history, index) => (
                  <p key={`${history.toState}-${history.createdAt}-${index}`}>
                    Previous {history.toState.toLowerCase()} ·{" "}
                    {new Date(history.createdAt).toLocaleString()}
                    {history.reason ? ` · ${history.reason}` : ""}
                  </p>
                ))}
              </details>
            </div>
            <div>
              <Status>Awaiting intake approval</Status>
              {request.intakeDecisionBlockedReason === "SELF_SUBMISSION" ? (
                <p role="note">
                  You submitted this request. Another PR Operations user must decide it.
                </p>
              ) : request.intakeDecisionBlockedReason === "TASK_WORK_ALREADY_STARTED" ? (
                <p role="alert">
                  Task work has already started; intake decision is blocked. Use the task
                  workflow.
                </p>
              ) : canDecideRequests ? (
                <>
                  <label>
                    {language === "th"
                      ? "คอมเมนต์ / เหตุผล (อนุมัติไม่บังคับ)"
                      : "Comment / reason (optional for approval)"}
                    <textarea
                      value={requestComments[request.id] || ""}
                      maxLength={5000}
                      rows={3}
                      onChange={(event) =>
                        setRequestComments((previous) => ({
                          ...previous,
                          [request.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {requestDecisionErrors[request.id] && (
                    <p role="alert">{requestDecisionErrors[request.id]}</p>
                  )}
                  <button
                    type="button"
                    disabled={
                      decidingRequestId === request.id ||
                      !requestComments[request.id]?.trim()
                    }
                    onClick={() => void submitRequestDecision(request, "REJECTED")}
                  >
                    {language === "th" ? "ปฏิเสธคำขอ" : "Reject request"}
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={decidingRequestId === request.id}
                    onClick={() => void submitRequestDecision(request, "APPROVED")}
                  >
                    {decidingRequestId === request.id
                      ? language === "th"
                        ? "กำลังบันทึก…"
                        : "Saving…"
                      : language === "th"
                        ? "อนุมัติคำขอ"
                        : "Approve request"}
                  </button>
                </>
              ) : (
                <span>View only for your role</span>
              )}
            </div>
          </article>
        ))}
        {requestQueueState === "loaded" && requests.length === 0 && (
          <p>
            No submitted requests are currently visible in your PR Operations department
            scope.
          </p>
        )}
      </section>
      <h2>{language === "th" ? "คิวตรวจและอนุมัติงาน" : "Task Stage Approvals"}</h2>
      <section className={styles.list}>
        {taskItems.map((task) => (
          <article key={task.id} id={`task-${task.id}`} className={styles.listItem}>
            <div>
              <p>{STATUS_LABELS[task.status]}</p>
              <h2>{task.title}</h2>
              <span>
                Assigned to{" "}
                {getUser(task.ownerId)?.name ?? task.ownerName ?? "Unassigned"}
              </span>
              {task.revisionNumber !== undefined && (
                <p>Content revision {task.revisionNumber}</p>
              )}
              {task.contentBody && (
                <p className={styles.approvalContent}>{task.contentBody}</p>
              )}
              {task.keyMessage && (
                <p>
                  <strong>Key message:</strong> {task.keyMessage}
                </p>
              )}
              {task.sourceUrls?.map((url) => (
                <p key={url}>
                  Source:{" "}
                  <a href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                </p>
              ))}
              {task.finalAssetId ? (
                <p>Final asset attached · {task.finalAssetId}</p>
              ) : (
                <p role="note">Final asset has not been assigned yet.</p>
              )}
              <ApprovalAttachments taskId={task.id} finalAssetId={task.finalAssetId} />
            </div>
            <div>
              <Status>
                {language === "th" ? "รอการตรวจและอนุมัติ" : "Awaiting approval"}
              </Status>
              {canDecideTasks && task.status === "pr_editorial_review" && (
                <fieldset>
                  <legend>
                    {language === "th"
                      ? "ตรวจบรรณาธิการ PR — ยืนยันทุกข้อก่อนอนุมัติ"
                      : "PR editorial review — confirm each criterion before approval"}
                  </legend>
                  {EDITORIAL_REVIEW_ITEMS.map((item) => (
                    <label key={item.key}>
                      <input
                        type="checkbox"
                        checked={getEditorialChecklist(task.id)[item.key]}
                        onChange={(event) =>
                          setEditorialChecklists((previous) => ({
                            ...previous,
                            [task.id]: {
                              ...(previous[task.id] ?? EMPTY_EDITORIAL_REVIEW_CHECKLIST),
                              [item.key]: event.target.checked,
                            },
                          }))
                        }
                      />
                      {item.label[language]}
                    </label>
                  ))}
                </fieldset>
              )}
              {canDecideTasks ? (
                <>
                  <button
                    onClick={() =>
                      onDecision(
                        task.id,
                        "REVISION_REQUIRED",
                        task.status === "pr_editorial_review"
                          ? getEditorialChecklist(task.id)
                          : undefined,
                      )
                    }
                  >
                    {language === "th" ? "ขอให้แก้ไข" : "Request revision"}
                  </button>
                  <button
                    onClick={() =>
                      onDecision(
                        task.id,
                        "REJECTED",
                        task.status === "pr_editorial_review"
                          ? getEditorialChecklist(task.id)
                          : undefined,
                      )
                    }
                  >
                    {language === "th" ? "ปฏิเสธงาน" : "Reject"}
                  </button>
                  <button
                    className={styles.primary}
                    disabled={
                      task.status === "pr_editorial_review" &&
                      !isEditorialChecklistComplete(getEditorialChecklist(task.id))
                    }
                    onClick={() =>
                      onDecision(
                        task.id,
                        "APPROVED",
                        task.status === "pr_editorial_review"
                          ? getEditorialChecklist(task.id)
                          : undefined,
                      )
                    }
                  >
                    {language === "th" ? "อนุมัติ" : "Approve"}
                  </button>
                </>
              ) : (
                <span>View only for your role</span>
              )}
            </div>
          </article>
        ))}
        {taskItems.length === 0 && <p>No task-stage approvals are waiting.</p>}
      </section>
    </>
  );
}

function ApprovalAttachments({
  taskId,
  finalAssetId,
}: {
  taskId: string;
  finalAssetId?: string | null;
}) {
  const [files, setFiles] = useState<
    Array<{
      id: string;
      file: { id: string; fileName: string; scanStatus: string };
    }>
  >([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/pr-center/attachments?taskId=${taskId}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Attachments unavailable");
        return response.json();
      })
      .then((records: typeof files) => {
        if (active) setFiles(records);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [taskId]);

  if (error) return <p role="alert">Attachments could not be loaded.</p>;
  if (files.length === 0) return null;
  return (
    <ul>
      {files.map((attachment) => (
        <li key={attachment.id}>
          {attachment.file.fileName} · {attachment.file.scanStatus}
          {finalAssetId === attachment.file.id ? " · Final asset" : ""}
          {attachment.file.scanStatus === "CLEAN" && (
            <a
              href={`/api/pr-center/files/${attachment.file.id}/download`}
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function libraryStatusLabel(status: string, language: Language) {
  const labels: Record<string, { th: string; en: string }> = {
    DRAFT: { th: "ฉบับร่าง", en: "Draft" },
    SUBMITTED: { th: "ส่งคำขอแล้ว", en: "Submitted" },
    APPROVED: { th: "อนุมัติแล้ว", en: "Approved" },
    REJECTED: { th: "ไม่อนุมัติ", en: "Rejected" },
    WITHDRAWN: { th: "ถอนคำขอ", en: "Withdrawn" },
    CANCELLED: { th: "ยกเลิก", en: "Cancelled" },
    CLOSED: { th: "ปิดคำขอ", en: "Closed" },
  };
  return labels[status]?.[language] ?? status.replaceAll("_", " ");
}

function Library({ language }: { language: Language }) {
  const [items, setItems] = useState<ContentLibraryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (nextCursor?: string, append = false) => {
      const query = new URLSearchParams({ take: "100" });
      if (nextCursor) query.set("cursor", nextCursor);
      try {
        const response = await fetch(`/api/pr-center/content-library?${query}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to load Content Library");
        const records = (await response.json()) as ContentLibraryRecord[];
        const pageRecords = records.slice(0, 100);
        setItems((previous) =>
          append
            ? [
                ...previous,
                ...pageRecords.filter(
                  (item) => !previous.some((old) => old.id === item.id),
                ),
              ]
            : pageRecords,
        );
        setCursor(pageRecords.at(-1)?.id ?? null);
        setHasMore(records.length > pageRecords.length);
        setError("");
      } catch {
        setError(
          language === "th"
            ? "โหลดข้อมูลคลังคำขอไม่สำเร็จ กรุณาลองอีกครั้ง"
            : "Unable to load request content. Please try again.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [language],
  );

  useEffect(() => {
    let active = true;
    void fetch("/api/pr-center/content-library?take=100", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load Content Library");
        return (await response.json()) as ContentLibraryRecord[];
      })
      .then((records) => {
        if (!active) return;
        const pageRecords = records.slice(0, 100);
        setItems(pageRecords);
        setCursor(pageRecords.at(-1)?.id ?? null);
        setHasMore(records.length > pageRecords.length);
      })
      .catch(() => {
        if (!active) return;
        setError(
          language === "th"
            ? "โหลดข้อมูลคลังคำขอไม่สำเร็จ กรุณาลองอีกครั้ง"
            : "Unable to load request content. Please try again.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [language]);

  const refresh = () => {
    if (loading || loadingMore) return;
    setLoading(true);
    setCursor(null);
    void load();
  };

  const loadMore = () => {
    if (!cursor || loading || loadingMore) return;
    setLoadingMore(true);
    void load(cursor, true);
  };

  return (
    <>
      <SectionHeading
        eyebrow="REQUEST CONTENT"
        title={
          language === "th" ? "คลัง Content จากคำขอ" : "Content Library from Requests"
        }
        action={
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={refresh}
            disabled={loading || loadingMore}
          >
            {language === "th" ? "รีเฟรช" : "Refresh"}
          </button>
        }
      />
      <p className={styles.libraryNotice}>
        {language === "th"
          ? "แสดงเนื้อหาและรายละเอียดจากคำขอ PR Center ตามขอบเขตสิทธิ์ของคุณ ไม่มีค่าประมาณ Reach"
          : "Request content and details visible within your PR Center access scope. Reach estimates are not shown."}
      </p>
      {loading && <p role="status">{language === "th" ? "กำลังโหลด…" : "Loading…"}</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" className={styles.secondaryButton} onClick={refresh}>
            {language === "th" ? "ลองอีกครั้ง" : "Retry"}
          </button>
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <article className={styles.card}>
          <p>
            {language === "th"
              ? "ยังไม่มีข้อมูลคำขอในขอบเขตนี้"
              : "No requests in your scope yet."}
          </p>
        </article>
      )}
      <section className={styles.library} aria-busy={loading || loadingMore}>
        {items.map((item) => {
          const revision = item.revisions[0];
          const sourceLinks = item.sources.map((source) => {
            try {
              const url = new URL(source.url);
              return url.protocol === "https:" || url.protocol === "http:"
                ? url.href
                : null;
            } catch {
              return null;
            }
          });
          return (
            <article key={item.id} className={styles.libraryRecord}>
              <small>
                {item.requestNumber} ·{" "}
                {item.type === "OFFSITE"
                  ? language === "th"
                    ? "ลงพื้นที่"
                    : "Offsite"
                  : "PR"}
              </small>
              <h2>{revision?.title || item.title}</h2>
              <p>
                {item.department.name} · {libraryStatusLabel(item.status, language)}
              </p>
              <dl>
                <dt>{language === "th" ? "วัตถุประสงค์" : "Objective"}</dt>
                <dd>
                  {revision?.objective ||
                    (language === "th" ? "ไม่ได้ระบุ" : "Not provided")}
                </dd>
                <dt>{language === "th" ? "กลุ่มเป้าหมาย" : "Audience"}</dt>
                <dd>
                  {revision?.audience ||
                    (language === "th" ? "ไม่ได้ระบุ" : "Not provided")}
                </dd>
                {revision?.offsiteDetails != null && (
                  <>
                    <dt>
                      {language === "th" ? "รายละเอียดการลงพื้นที่" : "Offsite details"}
                    </dt>
                    <dd>
                      <pre>{JSON.stringify(revision.offsiteDetails, null, 2)}</pre>
                    </dd>
                  </>
                )}
              </dl>
              {revision?.changeSummary && <p>{revision.changeSummary}</p>}
              {item.sources.length > 0 && (
                <div>
                  <strong>{language === "th" ? "แหล่งข้อมูล" : "Sources"}</strong>
                  <ul>
                    {item.sources.map((source, index) => (
                      <li key={source.id}>
                        {sourceLinks[index] ? (
                          <a
                            href={sourceLinks[index]!}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {source.label || sourceLinks[index]}
                          </a>
                        ) : (
                          source.label || source.url
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.attachments.length > 0 && (
                <div>
                  <strong>
                    {language === "th" ? "ไฟล์แนบในคำขอ" : "Request attachments"}
                  </strong>
                  <ul>
                    {item.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        {attachment.file.fileName} · {attachment.kind} ·{" "}
                        {attachment.file.scanStatus}
                        {attachment.file.deletedAt
                          ? language === "th"
                            ? " (ถูกลบแล้ว)"
                            : " (deleted)"
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <small>
                {language === "th" ? "แก้ไขล่าสุด" : "Last updated"}:{" "}
                {new Date(item.updatedAt).toLocaleDateString(
                  language === "th" ? "th-TH" : "en-GB",
                )}
                {revision ? ` · v${revision.revisionNumber}` : ""}
              </small>
            </article>
          );
        })}
      </section>
      {hasMore && (
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore
            ? language === "th"
              ? "กำลังโหลด…"
              : "Loading…"
            : language === "th"
              ? "โหลดเพิ่มเติม"
              : "Load more"}
        </button>
      )}
    </>
  );
}
type IdeaComment = {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
  author: { displayName: string };
};

function IdeaComments({ ideaId, language }: { ideaId: string; language: Language }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const loadComments = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/pr-center/ideas/${ideaId}/comments`, {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Unable to load comments");
      setComments((await response.json()) as IdeaComment[]);
      setLoaded(true);
    } catch {
      setError(
        language === "th" ? "โหลดความคิดเห็นไม่สำเร็จ" : "Unable to load comments.",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (!loaded) await loadComments();
  };

  return (
    <section>
      <button
        type="button"
        className={styles.secondaryButton}
        aria-expanded={open}
        onClick={() => void toggle()}
      >
        {language === "th"
          ? `ความคิดเห็น${loaded ? ` (${comments.length})` : ""}`
          : `Comments${loaded ? ` (${comments.length})` : ""}`}
      </button>
      {open && (
        <div>
          {loading && <p>{language === "th" ? "กำลังโหลด…" : "Loading…"}</p>}
          {error && (
            <p role="alert">
              {error}{" "}
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void loadComments()}
              >
                {language === "th" ? "ลองอีกครั้ง" : "Retry"}
              </button>
            </p>
          )}
          {loaded && comments.length === 0 && (
            <p>{language === "th" ? "ยังไม่มีความคิดเห็น" : "No comments yet."}</p>
          )}
          {comments.map((comment) => (
            <article key={comment.id}>
              <p>
                <strong>{comment.author.displayName}</strong>
                {" · "}
                {new Date(comment.createdAt).toLocaleString(
                  language === "th" ? "th-TH" : "en-US",
                )}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{comment.body}</p>
            </article>
          ))}
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const body = draft.trim();
              if (!body || saving) return;
              setSaving(true);
              setError("");
              try {
                const response = await fetch(`/api/pr-center/ideas/${ideaId}/comments`, {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ body }),
                });
                if (!response.ok) throw new Error("Unable to add comment");
                const saved = (await response.json()) as IdeaComment;
                setComments((current) => [...current, saved]);
                setLoaded(true);
                setDraft("");
              } catch {
                setError(
                  language === "th"
                    ? "ส่งความคิดเห็นไม่สำเร็จ"
                    : "Unable to add comment.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            <label>
              {language === "th" ? "เพิ่มความคิดเห็น" : "Add a comment"}
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                rows={3}
                required
              />
            </label>
            <button
              type="submit"
              className={styles.secondaryButton}
              disabled={saving || !draft.trim()}
            >
              {saving
                ? language === "th"
                  ? "กำลังส่ง…"
                  : "Sending…"
                : language === "th"
                  ? "ส่งความคิดเห็น"
                  : "Add comment"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function parseIdeaChannels(value?: string): string[] {
  return [
    ...new Set(
      (value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function ideaChannelMark(channel: string): string {
  const normalized = channel.toLowerCase();
  if (normalized === "website") return "◎";
  if (normalized === "facebook") return "f";
  if (normalized === "tiktok") return "♪";
  if (normalized === "youtube") return "▶";
  if (normalized === "x") return "𝕏";
  if (normalized === "linkedin") return "in";
  if (normalized === "press release") return "▤";
  if (normalized === "internal") return "Ⅱ";
  return channel.slice(0, 1).toUpperCase();
}

function Ideas({
  ideas,
  currentUser,
  channels,
  contentPillars,
  canReview,
  canApprove,
  onCreate,
  onUpdate,
  onStatus,
  onConvert,
  language,
  listStatus,
  hasMore,
  loadingMore,
  onLoadMore,
  onRefresh,
  onFilters,
}: {
  ideas: Idea[];
  currentUser: User;
  channels: string[];
  contentPillars: string[];
  canReview: boolean;
  canApprove: boolean;
  onCreate: (input: CreateContentIdeaInput) => Promise<boolean>;
  onUpdate: (id: string, input: CreateContentIdeaInput) => Promise<boolean>;
  onStatus: (id: string, status: IdeaStatus) => Promise<void>;
  onConvert: (id: string) => Promise<void>;
  language: Language;
  listStatus: "loading" | "loaded" | "error";
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onFilters: (search: string, status: "all" | IdeaStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | IdeaStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [expandedIdeaId, setExpandedIdeaId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [audience, setAudience] = useState("");
  const [pillar, setPillar] = useState("");
  const [channel, setChannel] = useState("");
  const [priority, setPriority] = useState("");
  const [campaign, setCampaign] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [saving, setSaving] = useState(false);
  const [ideaDraftHydrated, setIdeaDraftHydrated] = useState(false);
  const [ideaDraftSaving, setIdeaDraftSaving] = useState(false);
  const [ideaDraftMessage, setIdeaDraftMessage] = useState("");
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const visible = ideas.filter(
    (idea) =>
      (status === "all" || idea.status === status) &&
      (!priorityFilter || idea.priority === priorityFilter) &&
      (!channelFilter ||
        parseIdeaChannels(idea.channel).some(
          (item) => item.toLowerCase() === channelFilter.toLowerCase(),
        )) &&
      [
        idea.title,
        idea.summary,
        idea.audience,
        idea.pillar,
        idea.channel,
        idea.priority,
        idea.campaign,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const channelOptions = [
    ...new Set([
      ...channels,
      ...ideas.flatMap((idea) => parseIdeaChannels(idea.channel)),
    ]),
  ];
  const priorityOptions = [
    ...new Set(
      ideas
        .map((idea) => idea.priority)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const ideaStatusLabel = (value: IdeaStatus) => {
    if (language === "th")
      return {
        proposed: "เสนอแล้ว",
        under_review: "PR กำลังพิจารณา",
        pending_approval: "รอผู้มีอำนาจอนุมัติ",
        revision_required: "ขอให้แก้ไข",
        accepted: "อนุมัติแล้ว",
        rejected: "ปฏิเสธ",
        converted: "แปลงเป็นคำขอแล้ว",
        archived: "เก็บถาวร",
      }[value];
    return value.replaceAll("_", " ");
  };
  const exportRows = visible.map((idea) => ({
    id: idea.id,
    title: idea.title,
    summary: idea.summary,
    channels: parseIdeaChannels(idea.channel).join(", ") || "—",
    priority: idea.priority || "—",
    status: ideaStatusLabel(idea.status),
    author: getUser(idea.authorId)?.name ?? "Unknown",
    links: idea.evidenceUrls || [],
  }));
  const downloadExport = (format: "word" | "excel") => {
    const isWord = format === "word";
    const content = isWord
      ? createContentIdeasWordHtml(exportRows)
      : createContentIdeasCsv(exportRows);
    const blob = new Blob([content], {
      type: isWord ? "application/msword;charset=utf-8" : "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `content-ideas-${new Date().toISOString().slice(0, 10)}.${isWord ? "doc" : "csv"}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const transitionsForRole = (idea: Idea): IdeaStatus[] => {
    if (canReview && canApprove) return IDEA_TRANSITIONS[idea.status];
    if (canApprove && idea.status === "pending_approval")
      return ["accepted", "revision_required", "rejected"];
    if (!canReview) return [];
    if (idea.status === "proposed") return ["under_review"];
    if (idea.status === "under_review") return ["pending_approval", "rejected"];
    if (idea.status === "revision_required") return ["under_review"];
    if (idea.status === "accepted" || idea.status === "rejected") return ["archived"];
    return [];
  };

  useEffect(() => {
    if (!open || editingIdeaId) return;
    let cancelled = false;
    fetch("/api/pr-center/drafts/IDEA", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Idea draft unavailable");
        return response.json();
      })
      .then((result) => {
        const payload = result?.payload;
        if (cancelled || !payload) return;
        setIdeaDraftMessage(
          language === "th" ? "โหลดร่างที่บันทึกไว้แล้ว" : "Saved draft restored.",
        );
        setTitle(typeof payload.title === "string" ? payload.title : "");
        setSummary(typeof payload.rationale === "string" ? payload.rationale : "");
        setAudience(typeof payload.audience === "string" ? payload.audience : "");
        setPillar(typeof payload.pillar === "string" ? payload.pillar : "");
        setChannel(typeof payload.channel === "string" ? payload.channel : "");
        setPriority(typeof payload.priority === "string" ? payload.priority : "");
        setCampaign(typeof payload.campaign === "string" ? payload.campaign : "");
        setEvidenceText(
          Array.isArray(payload.evidenceUrls)
            ? payload.evidenceUrls
                .filter((url: unknown): url is string => typeof url === "string")
                .join("\n")
            : "",
        );
      })
      .catch(() => {
        if (!cancelled)
          setIdeaDraftMessage(
            language === "th"
              ? "โหลดร่างแนวคิดไม่สำเร็จ"
              : "Could not load the saved idea draft.",
          );
      })
      .finally(() => {
        if (!cancelled) setIdeaDraftHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [editingIdeaId, language, open]);

  useEffect(() => {
    if (!open || editingIdeaId || !ideaDraftHydrated) return;
    const input = {
      title: title.trim(),
      rationale: summary.trim(),
      audience,
      pillar,
      channel,
      priority,
      campaign,
      evidenceUrls: evidenceText
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean),
    };
    if (!input.title && !input.rationale && !input.evidenceUrls.length) return;
    const timer = window.setTimeout(() => {
      setIdeaDraftSaving(true);
      void fetch("/api/pr-center/drafts/IDEA", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Idea draft save failed");
          setIdeaDraftMessage(
            language === "th" ? "ร่างบันทึกอัตโนมัติแล้ว" : "Draft autosaved.",
          );
        })
        .catch(() =>
          setIdeaDraftMessage(
            language === "th" ? "บันทึกร่างไม่สำเร็จ" : "Draft could not be autosaved.",
          ),
        )
        .finally(() => setIdeaDraftSaving(false));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    audience,
    campaign,
    channel,
    editingIdeaId,
    evidenceText,
    ideaDraftHydrated,
    language,
    open,
    pillar,
    priority,
    summary,
    title,
  ]);

  useEffect(() => {
    if (!open) return;
    const dialog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-labelledby="idea-modal-title"]',
    );
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [
        ...(dialog?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary",
        ) || []),
      ].filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  return (
    <>
      <SectionHeading
        eyebrow="COLLABORATION"
        title={language === "th" ? "เสนอ Content Ideas" : "Content Ideas"}
        help={
          <button
            type="button"
            className={styles.ideaHelpButton}
            aria-label={
              language === "th" ? "ข้อมูลเกี่ยวกับ Content Ideas" : "About Content Ideas"
            }
            title={
              language === "th"
                ? "เสนอไอเดียให้ทีม PR ตรวจสอบก่อนส่งอนุมัติ"
                : "Submit an idea for PR review before approval."
            }
          >
            ?
          </button>
        }
        action={
          <div className={styles.ideaToolbar}>
            <button
              className={styles.secondaryButton}
              onClick={() => void onRefresh()}
              disabled={listStatus === "loading"}
            >
              {language === "th" ? "รีเฟรช" : "Refresh"}
            </button>
            <button
              className={styles.secondaryButton}
              onClick={() => downloadExport("word")}
              disabled={!visible.length}
            >
              ↓ Export Word
            </button>
            <button
              className={styles.secondaryButton}
              onClick={() => downloadExport("excel")}
              disabled={!visible.length}
              title={
                language === "th" ? "ไฟล์ CSV เปิดด้วย Excel ได้" : "Excel-compatible CSV"
              }
            >
              ↓ Export CSV
            </button>
            <button
              className={styles.primary}
              onClick={() => {
                if (open) {
                  setOpen(false);
                  return;
                }
                if (editingIdeaId) {
                  setTitle("");
                  setSummary("");
                  setAudience("");
                  setPillar("");
                  setChannel("");
                  setPriority("");
                  setCampaign("");
                  setEvidenceText("");
                }
                setEditingIdeaId(null);
                setIdeaDraftHydrated(false);
                setIdeaDraftMessage("");
                setOpen(true);
              }}
            >
              💡 {language === "th" ? "เสนอ Content Idea" : "Propose Content Idea"}
            </button>
          </div>
        }
      />
      <div className={styles.ideaInfoBanner}>
        <span aria-hidden="true">💡</span>
        <p>
          {language === "th"
            ? "พนักงานทุกคนสามารถเสนอไอเดียได้ หัวหน้าทีม PR จะรวบรวม ตรวจสอบ และส่งให้ผู้มีสิทธิ์อนุมัติ"
            : "All staff can submit ideas. The PR team reviews and routes them to the authorized approver."}
        </p>
      </div>
      {open && (
        <div className={styles.ideaModalBackdrop}>
          <form
            className={styles.ideaModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="idea-modal-title"
            tabIndex={-1}
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                const input = {
                  title: title.trim(),
                  rationale: summary.trim(),
                  audience,
                  pillar,
                  channel,
                  priority,
                  campaign,
                  evidenceUrls: evidenceText
                    .split(/\r?\n/)
                    .map((url) => url.trim())
                    .filter(Boolean),
                };
                const saved = await submitIdeaForm(
                  () =>
                    editingIdeaId ? onUpdate(editingIdeaId, input) : onCreate(input),
                  () => {
                    const shouldDeleteDraft = !editingIdeaId;
                    setTitle("");
                    setSummary("");
                    setAudience("");
                    setPillar("");
                    setChannel("");
                    setPriority("");
                    setCampaign("");
                    setEvidenceText("");
                    setEditingIdeaId(null);
                    setOpen(false);
                    if (shouldDeleteDraft)
                      void fetch("/api/pr-center/drafts/IDEA", {
                        method: "DELETE",
                        credentials: "same-origin",
                      });
                  },
                );
                if (!saved) return;
                await onRefresh();
              } finally {
                setSaving(false);
              }
            }}
          >
            <header className={styles.ideaModalHeader}>
              <div>
                <p className={styles.eyebrow}>CONTENT IDEAS</p>
                <h2 id="idea-modal-title">
                  {editingIdeaId
                    ? language === "th"
                      ? "แก้ไขแนวคิดตามข้อเสนอแนะ"
                      : "Revise idea"
                    : language === "th"
                      ? "เสนอ Content Ideas"
                      : "Propose a Content Idea"}
                </h2>
              </div>
              <button
                type="button"
                className={styles.ideaModalClose}
                onClick={() => setOpen(false)}
                aria-label={language === "th" ? "ปิดหน้าต่าง" : "Close dialog"}
              >
                ×
              </button>
            </header>
            <div className={styles.ideaModalBody}>
              <div className={styles.ideaModalNotice}>
                <span className={styles.ideaDraftBadge} role="status">
                  {ideaDraftSaving
                    ? language === "th"
                      ? "กำลังบันทึกร่าง…"
                      : "Saving draft…"
                    : ideaDraftMessage ||
                      (editingIdeaId
                        ? language === "th"
                          ? "กำลังแก้ไขแนวคิดที่ได้รับข้อเสนอแนะ"
                          : "Editing an idea revision"
                        : language === "th"
                          ? "ระบบบันทึกร่างอัตโนมัติเมื่อกรอกข้อมูล"
                          : "Draft autosave is enabled")}
                </span>
                <span>
                  {language === "th"
                    ? "พนักงานทุกคนสามารถเสนอไอเดียได้ หัวหน้าทีม PR จะรวบรวม ตรวจสอบ และส่งให้ผู้มีสิทธิ์อนุมัติ"
                    : "All staff can submit ideas. The PR team reviews and routes them to the authorized approver."}
                </span>
              </div>
              <fieldset
                disabled={!ideaDraftHydrated || saving}
                className={styles.ideaDraftFields}
              >
                <label>
                  <span>
                    {language === "th" ? "หัวข้อ Content" : "Content title"}{" "}
                    <i className={styles.ideaRequired}>*</i>
                  </span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={300}
                    required
                  />
                </label>
                <label>
                  <span>
                    {language === "th"
                      ? "เนื้อหา / รายละเอียด Content"
                      : "Content details"}{" "}
                    <i className={styles.ideaRequired}>*</i>
                  </span>
                  <textarea
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    maxLength={5000}
                    required
                  />
                </label>
                <fieldset className={styles.ideaChannelGroup}>
                  <legend>{language === "th" ? "ช่องทาง" : "Channels"}</legend>
                  <div className={styles.ideaChannelGrid}>
                    {channelOptions.map((item) => (
                      <label className={styles.ideaChannelOption} key={item}>
                        <input
                          type="checkbox"
                          checked={parseIdeaChannels(channel).includes(item)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setChannel((current) => {
                              const selected = parseIdeaChannels(current);
                              const next = checked
                                ? [...selected, item]
                                : selected.filter((value) => value !== item);
                              return [...new Set(next)].join(", ");
                            });
                          }}
                        />
                        <span
                          className={styles.ideaChannelIcon}
                          data-channel={item.toLowerCase().replaceAll(" ", "-")}
                          aria-hidden="true"
                        >
                          {ideaChannelMark(item)}
                        </span>
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <details className={styles.ideaOptionalFields}>
                  <summary>
                    {language === "th"
                      ? "รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                      : "Additional details (optional)"}
                  </summary>
                  <div className={styles.ideaOptionalGrid}>
                    <label>
                      {language === "th" ? "กลุ่มเป้าหมาย" : "Audience"}
                      <input
                        value={audience}
                        onChange={(event) => setAudience(event.target.value)}
                        maxLength={500}
                      />
                    </label>
                    <label>
                      {language === "th" ? "เสาหลักเนื้อหา" : "Content pillar"}
                      <select
                        value={pillar}
                        onChange={(event) => setPillar(event.target.value)}
                      >
                        <option value="">
                          {language === "th" ? "เลือกเสาหลัก" : "Select a pillar"}
                        </option>
                        {contentPillars.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {language === "th" ? "ระดับความสำคัญ" : "Priority"}
                      <input
                        value={priority}
                        onChange={(event) => setPriority(event.target.value)}
                        maxLength={40}
                      />
                    </label>
                    <label>
                      {language === "th" ? "แคมเปญ" : "Campaign"}
                      <input
                        value={campaign}
                        onChange={(event) => setCampaign(event.target.value)}
                        maxLength={200}
                      />
                    </label>
                    <label className={styles.ideaEvidenceField}>
                      {language === "th"
                        ? "ลิงก์หลักฐาน (HTTPS หนึ่งลิงก์ต่อบรรทัด)"
                        : "Evidence links (one HTTPS URL per line)"}
                      <textarea
                        value={evidenceText}
                        onChange={(event) => setEvidenceText(event.target.value)}
                        placeholder="https://…"
                      />
                    </label>
                  </div>
                </details>
              </fieldset>
            </div>
            <footer className={styles.ideaModalFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                {language === "th" ? "ยกเลิก" : "Cancel"}
              </button>
              <button
                className={styles.primary}
                type="submit"
                disabled={saving || !ideaDraftHydrated}
              >
                {saving
                  ? language === "th"
                    ? "กำลังบันทึก…"
                    : "Saving…"
                  : editingIdeaId
                    ? language === "th"
                      ? "ส่งแนวคิดที่แก้ไขแล้ว"
                      : "Resubmit revised idea"
                    : language === "th"
                      ? "บันทึกและเสนอไอเดีย"
                      : "Save and submit idea"}
              </button>
            </footer>
          </form>
        </div>
      )}
      <div className={styles.ideaFilters}>
        <input
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            onFilters(value, status);
          }}
          maxLength={100}
          placeholder={language === "th" ? "ค้นหา" : "Search"}
          aria-label={language === "th" ? "ค้นหา Content Ideas" : "Search Content Ideas"}
        />
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          aria-label={language === "th" ? "กรองระดับความสำคัญ" : "Filter by priority"}
        >
          <option value="">
            {language === "th" ? "ทุกระดับความสำคัญ" : "All priorities"}
          </option>
          {priorityOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => {
            const value = event.target.value as "all" | IdeaStatus;
            setStatus(value);
            onFilters(query, value);
          }}
          aria-label={language === "th" ? "กรองสถานะไอเดีย" : "Filter by status"}
        >
          <option value="all">
            {language === "th" ? "ทุกสถานะไอเดีย" : "All statuses"}
          </option>
          {[
            "proposed",
            "under_review",
            "pending_approval",
            "revision_required",
            "accepted",
            "rejected",
            "converted",
            "archived",
          ].map((value) => (
            <option key={value} value={value}>
              {ideaStatusLabel(value as IdeaStatus)}
            </option>
          ))}
        </select>
        <select
          value={channelFilter}
          onChange={(event) => setChannelFilter(event.target.value)}
          aria-label={language === "th" ? "กรองช่องทาง" : "Filter by channel"}
        >
          <option value="">{language === "th" ? "ทุกช่องทาง" : "All channels"}</option>
          {channelOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.ideaClearFilters}
          onClick={() => {
            setQuery("");
            setStatus("all");
            setPriorityFilter("");
            setChannelFilter("");
            onFilters("", "all");
          }}
        >
          {language === "th" ? "ล้างตัวกรอง" : "Clear filters"}
        </button>
      </div>
      <p className={styles.ideaScopeNote}>
        {language === "th"
          ? "ผลลัพธ์และการส่งออกจำกัดตามสิทธิ์ของคุณ; ตัวกรองช่องทาง/ความสำคัญใช้กับรายการที่โหลดแล้ว"
          : "Results and exports stay within your authorized scope; channel and priority filters apply to loaded rows."}
      </p>
      {listStatus === "loading" && (
        <p>{language === "th" ? "กำลังโหลดแนวคิด…" : "Loading ideas…"}</p>
      )}
      {listStatus === "error" && (
        <p>
          {language === "th" ? "โหลดรายการไม่สำเร็จ" : "Unable to load ideas."}{" "}
          <button className={styles.secondaryButton} onClick={() => void onRefresh()}>
            {language === "th" ? "ลองอีกครั้ง" : "Retry"}
          </button>
        </p>
      )}
      {listStatus === "loaded" && visible.length === 0 && (
        <p>
          {ideas.length === 0
            ? language === "th"
              ? "ยังไม่มีแนวคิด"
              : "No ideas yet."
            : language === "th"
              ? "ไม่พบแนวคิดที่ตรงกับตัวกรองในรายการที่โหลด"
              : "No loaded ideas match these filters."}
        </p>
      )}
      <div className={styles.ideaTableWrap}>
        <table className={styles.ideaTable}>
          <thead>
            <tr>
              <th>ID</th>
              <th>{language === "th" ? "หัวข้อ Content" : "Content title"}</th>
              <th>
                {language === "th" ? "เนื้อหา / รายละเอียด Content" : "Content details"}
              </th>
              <th>{language === "th" ? "ช่องทาง" : "Channels"}</th>
              <th>{language === "th" ? "ระดับความสำคัญ" : "Priority"}</th>
              <th>{language === "th" ? "สถานะไอเดีย" : "Idea status"}</th>
              <th>{language === "th" ? "ผู้บันทึก" : "Submitted by"}</th>
              <th>{language === "th" ? "Link / Folder โครงการ" : "Project links"}</th>
              <th>{language === "th" ? "จัดการ" : "Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((idea) => {
              const ideaChannels = parseIdeaChannels(idea.channel);
              const expanded = expandedIdeaId === idea.id;
              const transitions = transitionsForRole(idea);
              return (
                <Fragment key={idea.id}>
                  <tr id={`idea-${idea.id}`}>
                    <td className={styles.ideaId}>{idea.id}</td>
                    <td className={styles.ideaTitleCell}>
                      <strong>{idea.title}</strong>
                    </td>
                    <td className={styles.ideaSummaryCell}>
                      <span className={styles.ideaSummaryText}>
                        {idea.summary || "—"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.ideaChannelChips}>
                        {ideaChannels.length
                          ? ideaChannels.map((item) => (
                              <span className={styles.ideaChannelChip} key={item}>
                                <span
                                  className={styles.ideaChannelIcon}
                                  data-channel={item.toLowerCase().replaceAll(" ", "-")}
                                  aria-hidden="true"
                                >
                                  {ideaChannelMark(item)}
                                </span>
                                {item}
                              </span>
                            ))
                          : "—"}
                      </div>
                    </td>
                    <td>
                      {idea.priority ? (
                        <span className={styles.ideaPriorityTag}>{idea.priority}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.ideaStatusTag} ${styles[`ideaStatus_${idea.status}`]}`}
                      >
                        {ideaStatusLabel(idea.status)}
                      </span>
                    </td>
                    <td>{getUser(idea.authorId)?.name ?? "Unknown"}</td>
                    <td>
                      {idea.evidenceUrls?.length ? (
                        <div className={styles.ideaLinks}>
                          {idea.evidenceUrls.slice(0, 2).map((url, index) => (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              key={url}
                            >
                              {language === "th"
                                ? `เปิด ${index + 1}`
                                : `Open ${index + 1}`}
                            </a>
                          ))}
                          {idea.evidenceUrls.length > 2 && (
                            <span>+{idea.evidenceUrls.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div className={styles.ideaManageActions}>
                        <button
                          type="button"
                          className={styles.ideaTextAction}
                          aria-expanded={expanded}
                          onClick={() => setExpandedIdeaId(expanded ? null : idea.id)}
                        >
                          {expanded
                            ? language === "th"
                              ? "ซ่อนรายละเอียด"
                              : "Hide details"
                            : language === "th"
                              ? "รายละเอียด"
                              : "Details"}
                        </button>
                        {(canReview || canApprove) && transitions.length > 0 && (
                          <select
                            value=""
                            aria-label={
                              language === "th"
                                ? `เปลี่ยนสถานะ ${idea.title}`
                                : `Change status for ${idea.title}`
                            }
                            onChange={async (event) => {
                              const nextStatus = event.target.value as IdeaStatus;
                              if (!nextStatus) return;
                              await onStatus(idea.id, nextStatus);
                              await onRefresh();
                            }}
                          >
                            <option value="">
                              {language === "th" ? "เปลี่ยนสถานะ…" : "Change status…"}
                            </option>
                            {transitions.map((value) => (
                              <option key={value} value={value}>
                                {ideaStatusLabel(value)}
                              </option>
                            ))}
                          </select>
                        )}
                        {idea.status === "accepted" && canReview && !idea.requestId && (
                          <button
                            type="button"
                            className={styles.ideaTextAction}
                            onClick={async () => {
                              await onConvert(idea.id);
                              await onRefresh();
                            }}
                          >
                            {language === "th" ? "แปลงเป็นคำขอ" : "Convert to request"}
                          </button>
                        )}
                        {idea.status === "revision_required" &&
                          idea.authorId === currentUser.id && (
                            <button
                              type="button"
                              className={styles.ideaTextAction}
                              onClick={() => {
                                setEditingIdeaId(idea.id);
                                setIdeaDraftMessage("");
                                setTitle(idea.title);
                                setSummary(idea.summary);
                                setAudience(idea.audience || "");
                                setPillar(idea.pillar || "");
                                setChannel(idea.channel || "");
                                setPriority(idea.priority || "");
                                setCampaign(idea.campaign || "");
                                setEvidenceText(idea.evidenceUrls?.join("\n") || "");
                                setIdeaDraftHydrated(true);
                                setOpen(true);
                              }}
                            >
                              {language === "th"
                                ? "แก้ไขและส่งกลับให้ตรวจ"
                                : "Revise and resubmit"}
                            </button>
                          )}
                        {idea.requestId && <span>{idea.requestId}</span>}
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className={styles.ideaDetailsRow}>
                      <td colSpan={9}>
                        <div className={styles.ideaExpandedDetails}>
                          <div>
                            <strong>
                              {language === "th" ? "รายละเอียด" : "Details"}
                            </strong>
                            <p>{idea.summary || "—"}</p>
                            {[
                              idea.audience &&
                                `${language === "th" ? "กลุ่มเป้าหมาย" : "Audience"}: ${idea.audience}`,
                              idea.pillar &&
                                `${language === "th" ? "เสาหลักเนื้อหา" : "Pillar"}: ${idea.pillar}`,
                              idea.campaign &&
                                `${language === "th" ? "แคมเปญ" : "Campaign"}: ${idea.campaign}`,
                            ]
                              .filter(Boolean)
                              .map((detail) => (
                                <p key={detail}>{detail}</p>
                              ))}
                            {idea.decisionReason && (
                              <p role="note">
                                <strong>
                                  {language === "th"
                                    ? "เหตุผลประกอบการตัดสินใจ"
                                    : "Decision rationale"}
                                  :
                                </strong>{" "}
                                {idea.decisionReason}
                              </p>
                            )}
                            {!!idea.evidenceUrls?.length && (
                              <ul>
                                {idea.evidenceUrls.map((url) => (
                                  <li key={url}>
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {url}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {(canReview || idea.authorId === currentUser.id) && (
                            <IdeaComments ideaId={idea.id} language={language} />
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {listStatus === "loaded" && (
        <div className={styles.filterBar}>
          <span>
            {language === "th"
              ? `โหลดแล้ว ${ideas.length} แนวคิด`
              : `Loaded ${ideas.length} ideas`}
          </span>
          {hasMore && (
            <button
              className={styles.secondaryButton}
              disabled={loadingMore}
              onClick={() => void onLoadMore()}
            >
              {loadingMore
                ? language === "th"
                  ? "กำลังโหลด…"
                  : "Loading…"
                : language === "th"
                  ? "โหลดเพิ่ม"
                  : "Load more"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
type MessageHouseWorkingVersion = {
  id: string;
  rowVersion: number;
  versionNumber: number;
  status: "DRAFT" | "IN_REVIEW" | "REJECTED";
  vision: string;
  positioning: string;
  pillars: string[];
  foundation: string;
  sourceRationale: string | null;
  decisionReason?: string | null;
};

function MessageHouse({
  data,
  canEdit,
  canReview,
  status,
  history,
  historyStatus,
  onRefresh,
  language,
}: {
  data: MessageHouseData;
  canEdit: boolean;
  canReview: boolean;
  status: "loading" | "empty" | "loaded" | "error";
  history: CurrentMessageHouse[];
  historyStatus: "loading" | "loaded" | "error";
  onRefresh: () => void;
  language: Language;
}) {
  const thai = language === "th";
  const [draft, setDraft] = useState({
    id: "",
    vision: "",
    positioning: "",
    pillars: "",
    foundation: "",
    sourceRationale: "",
  });
  const [working, setWorking] = useState<MessageHouseWorkingVersion | null>(null);
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const draftContent = JSON.stringify({ ...draft, id: "" });
  const [draftLoading, setDraftLoading] = useState(canEdit);
  const [draftLoadFailed, setDraftLoadFailed] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [draftNoticeTone, setDraftNoticeTone] = useState<"success" | "error" | "">("");
  const [reviews, setReviews] = useState<MessageHouseWorkingVersion[]>([]);
  const [reviewStatus, setReviewStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({});
  const [reviewEffectiveAt, setReviewEffectiveAt] = useState<Record<string, string>>({});
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [reviewReload, setReviewReload] = useState(0);
  const dirtyRef = useRef(false);
  const dirty = draftContent !== savedContent;
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    fetch("/api/pr-center/message-house/draft", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Draft unavailable");
        return (await response.json()) as MessageHouseWorkingVersion | null;
      })
      .then((value) => {
        if (cancelled) return;
        setDraftLoadFailed(false);
        if (dirtyRef.current) {
          setDraftNotice(
            thai
              ? "มีการแก้ไขที่ยังไม่บันทึก จึงคงข้อมูลบนหน้าจอไว้"
              : "Unsaved changes were kept; the server draft was not loaded over them.",
          );
          setDraftNoticeTone("");
          return;
        }
        setWorking(value);
        const loadedDraft = {
          id: value?.id ?? "",
          vision: value?.vision ?? "",
          positioning: value?.positioning ?? "",
          pillars: value?.pillars?.join("\n") ?? "",
          foundation: value?.foundation ?? "",
          sourceRationale: value?.sourceRationale ?? "",
        };
        setDraft(loadedDraft);
        setSavedContent(value ? JSON.stringify({ ...loadedDraft, id: "" }) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setDraftLoadFailed(true);
          setDraftNotice(
            thai
              ? "โหลดฉบับร่าง Message House ไม่สำเร็จ"
              : "Message House draft could not be loaded.",
          );
          setDraftNoticeTone("error");
        }
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canEdit, reload, thai]);

  useEffect(() => {
    if (!canReview) return;
    let cancelled = false;
    fetch("/api/pr-center/message-house/review", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Review queue unavailable");
        return (await response.json()) as MessageHouseWorkingVersion[];
      })
      .then((items) => {
        if (!cancelled) {
          setReviews(items);
          setReviewStatus("loaded");
        }
      })
      .catch(() => {
        if (!cancelled) setReviewStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [canReview, reviewReload]);

  const refreshWorking = () => {
    if (
      dirtyRef.current &&
      !window.confirm(
        thai
          ? "มีการแก้ไขที่ยังไม่บันทึก ต้องการทิ้งการแก้ไขและโหลดฉบับร่างใหม่หรือไม่?"
          : "Discard unsaved changes and reload the latest draft?",
      )
    )
      return;
    if (dirtyRef.current) {
      dirtyRef.current = false;
      setSavedContent(draftContent);
    }
    if (canEdit) setDraftLoading(true);
    if (canReview) setReviewStatus("loading");
    setReload((previous) => previous + 1);
    setReviewReload((previous) => previous + 1);
    onRefresh();
  };

  const saveDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !canEdit ||
      draftSaving ||
      draftLoading ||
      draftLoadFailed ||
      working?.status === "IN_REVIEW" ||
      working?.status === "REJECTED"
    )
      return;
    setDraftSaving(true);
    setDraftNotice("");
    setDraftNoticeTone("");
    try {
      const response = await fetch("/api/pr-center/message-house/draft", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...(draft.id && working ? { "If-Match": String(working.rowVersion) } : {}),
        },
        body: JSON.stringify({
          id: draft.id || undefined,
          vision: draft.vision,
          positioning: draft.positioning,
          pillars: draft.pillars
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean),
          foundation: draft.foundation,
          sourceRationale: draft.sourceRationale,
        }),
      });
      const value = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(value?.message || "Message House draft could not be saved");
      setWorking(value as MessageHouseWorkingVersion);
      setSavedContent(draftContent);
      setDraft((previous) => ({ ...previous, id: value.id }));
      setDraftNotice(thai ? "บันทึกฉบับร่างแล้ว" : "Draft saved.");
      setDraftNoticeTone("success");
      onRefresh();
    } catch (error) {
      setDraftNotice(error instanceof Error ? error.message : "Save failed");
      setDraftNoticeTone("error");
    } finally {
      setDraftSaving(false);
    }
  };

  const transition = async (
    version: MessageHouseWorkingVersion,
    to: "IN_REVIEW" | "APPROVED" | "REJECTED",
  ) => {
    if (draftSaving || reviewBusyId) return;
    if (
      to === "IN_REVIEW" &&
      (!canEdit || version.status !== "DRAFT" || draftContent !== savedContent)
    )
      return;
    if (to !== "IN_REVIEW" && (!canReview || version.status !== "IN_REVIEW")) return;
    const reason = reviewReason[version.id]?.trim();
    const effectiveAt =
      to === "APPROVED"
        ? bangkokLocalDateTimeToISOString(reviewEffectiveAt[version.id] ?? "")
        : null;
    if (to !== "IN_REVIEW" && (!reason || reason.length > 2000)) {
      setReviewNotice(
        thai
          ? "ระบุเหตุผลการตัดสินใจ (ไม่เกิน 2000 ตัวอักษร)"
          : "Enter a decision reason (up to 2000 characters).",
      );
      return;
    }
    if (
      to === "APPROVED" &&
      (!effectiveAt || new Date(effectiveAt).getTime() < Date.now())
    ) {
      setReviewNotice(
        thai
          ? "ระบุวันเวลาที่มีผลในอนาคต (เวลาไทย)"
          : "Choose a future effective date and time (Bangkok time).",
      );
      return;
    }
    setReviewBusyId(version.id);
    setReviewNotice("");
    setDraftNotice("");
    try {
      const response = await fetch(
        `/api/pr-center/message-house/${encodeURIComponent(version.id)}/transitions`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "If-Match": String(version.rowVersion),
          },
          body: JSON.stringify({
            to,
            ...(reason && to !== "IN_REVIEW" ? { reason } : {}),
            ...(effectiveAt && to === "APPROVED" ? { effectiveAt } : {}),
          }),
        },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(result?.message || "Message House transition failed");
      if (to === "IN_REVIEW") {
        setWorking(result as MessageHouseWorkingVersion);
        setDraftNotice(thai ? "ส่งให้พิจารณาแล้ว" : "Submitted for review.");
        setDraftNoticeTone("success");
      } else {
        setReviews((previous) => previous.filter((item) => item.id !== version.id));
        setReviewNotice(thai ? "บันทึกผลการพิจารณาแล้ว" : "Decision recorded.");
        setReviewReload((previous) => previous + 1);
      }
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transition failed";
      if (to === "IN_REVIEW") {
        setDraftNotice(message);
        setDraftNoticeTone("error");
      } else setReviewNotice(message);
    } finally {
      setReviewBusyId(null);
    }
  };
  return (
    <>
      <SectionHeading
        eyebrow={thai ? "กลยุทธ์การสื่อสาร" : "COMMUNICATION STRATEGY"}
        title="Message House"
        action={
          <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <span>
              {canEdit
                ? thai
                  ? "ผู้เขียนฉบับร่าง"
                  : "PR author"
                : canReview
                  ? thai
                    ? "ผู้พิจารณา"
                    : "BORD reviewer"
                  : thai
                    ? "อ่านอย่างเดียว"
                    : "Read only"}
            </span>
            <button
              type="button"
              onClick={refreshWorking}
              disabled={
                status === "loading" ||
                historyStatus === "loading" ||
                draftSaving ||
                !!reviewBusyId
              }
            >
              {thai ? "รีเฟรช" : "Refresh"}
            </button>
          </div>
        }
      />
      {canEdit && !draftLoading && working?.status === "IN_REVIEW" && (
        <section className={styles.card} role="status">
          <h2>{thai ? "กำลังรอพิจารณา" : "Awaiting review"}</h2>
          <p>
            {thai
              ? "ส่งฉบับนี้ให้ BORD แล้ว ไม่สามารถแก้ไขระหว่างพิจารณา"
              : "This version has been submitted to BORD and cannot be edited during review."}
          </p>
        </section>
      )}
      {canEdit && !draftLoading && working?.status === "REJECTED" && (
        <section className={styles.card}>
          <h2>{thai ? "ฉบับนี้ถูกส่งกลับ" : "Version rejected"}</h2>
          <p>
            {working.decisionReason ||
              (thai ? "เริ่มฉบับร่างใหม่เพื่อแก้ไข" : "Start a new draft to revise it.")}
          </p>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              setDraft((previous) => ({ ...previous, id: "" }));
              setWorking(null);
              setSavedContent(null);
              setDraftNotice("");
            }}
          >
            {thai ? "เริ่มร่างใหม่จากเนื้อหานี้" : "Start new draft from this content"}
          </button>
        </section>
      )}
      {canEdit &&
        (draftLoading ||
          (!draftLoadFailed && (!working || working.status === "DRAFT"))) && (
          <form
            className={`${styles.card} ${styles.messageHouseForm}`}
            onSubmit={saveDraft}
          >
            <header className={styles.messageHouseFormHeader}>
              <div>
                <span className={styles.messageHouseDraftBadge}>
                  {thai ? "ฉบับร่าง" : "WORKING DRAFT"}
                </span>
                <h2>{thai ? "แก้ไขกรอบสารหลัก" : "Edit Message House"}</h2>
                <p>
                  {thai
                    ? "กรอกข้อมูลจากภาพรวมไปสู่รายละเอียด ระบบจะบันทึกเป็นฉบับร่างเท่านั้น"
                    : "Work from the core message to supporting detail. Changes are saved as a draft only."}
                </p>
              </div>
              <span className={styles.messageHouseFieldCount}>
                {thai ? "5 ช่องกรอก" : "5 fields"}
              </span>
            </header>
            {draftLoading && (
              <p className={styles.messageHouseLoading} role="status" aria-live="polite">
                {thai ? "กำลังโหลดฉบับร่าง…" : "Loading draft…"}
              </p>
            )}
            <fieldset
              className={styles.messageHouseFieldset}
              disabled={draftLoading || draftSaving}
              aria-busy={draftLoading || draftSaving}
            >
              <section className={styles.messageHouseSection}>
                <div className={styles.messageHouseSectionHeader}>
                  <span className={styles.messageHouseStep}>01</span>
                  <div>
                    <h3>{thai ? "แกนหลักขององค์กร" : "Core identity"}</h3>
                    <p>
                      {thai
                        ? "กำหนดภาพที่องค์กรต้องการสื่อและจุดยืนที่ต้องการให้คนจดจำ"
                        : "Set the organization’s purpose and the position it wants people to remember."}
                    </p>
                  </div>
                </div>
                <div className={styles.messageHouseGrid}>
                  <label className={styles.messageHouseField} htmlFor="mh-vision">
                    <span className={styles.messageHouseLabelRow}>
                      <span>{thai ? "วิสัยทัศน์ / พันธกิจ" : "Vision / Mission"}</span>
                      <span className={styles.messageHouseRequired}>
                        {thai ? "จำเป็น" : "Required"}
                      </span>
                    </span>
                    <span className={styles.messageHouseHelp} id="mh-vision-help">
                      {thai
                        ? "องค์กรต้องการมุ่งไปทางใด และมีหน้าที่สำคัญอะไร"
                        : "Where is the organization headed, and what is its core purpose?"}
                    </span>
                    <textarea
                      id="mh-vision"
                      aria-describedby="mh-vision-help mh-vision-count"
                      required
                      maxLength={5000}
                      rows={5}
                      value={draft.vision}
                      onChange={(event) =>
                        setDraft({ ...draft, vision: event.target.value })
                      }
                    />
                    <span className={styles.messageHouseCounter} id="mh-vision-count">
                      {draft.vision.length}/5000
                    </span>
                  </label>
                  <label className={styles.messageHouseField} htmlFor="mh-positioning">
                    <span className={styles.messageHouseLabelRow}>
                      <span>{thai ? "จุดยืนขององค์กร" : "Brand positioning"}</span>
                      <span className={styles.messageHouseRequired}>
                        {thai ? "จำเป็น" : "Required"}
                      </span>
                    </span>
                    <span className={styles.messageHouseHelp} id="mh-positioning-help">
                      {thai
                        ? "อยากให้ประชาชนเข้าใจหรือจดจำองค์กรในฐานะใด"
                        : "How should people understand and remember the organization?"}
                    </span>
                    <textarea
                      id="mh-positioning"
                      aria-describedby="mh-positioning-help mh-positioning-count"
                      required
                      maxLength={5000}
                      rows={5}
                      value={draft.positioning}
                      onChange={(event) =>
                        setDraft({ ...draft, positioning: event.target.value })
                      }
                    />
                    <span
                      className={styles.messageHouseCounter}
                      id="mh-positioning-count"
                    >
                      {draft.positioning.length}/5000
                    </span>
                  </label>
                </div>
              </section>

              <section className={styles.messageHouseSection}>
                <div className={styles.messageHouseSectionHeader}>
                  <span className={styles.messageHouseStep}>02</span>
                  <div>
                    <h3>{thai ? "เสาหลักการสื่อสาร" : "Communication pillars"}</h3>
                    <p>
                      {thai
                        ? "แยกประเด็นสำคัญเป็นข้อ ๆ เพื่อให้ทีมสื่อสารนำไปใช้ได้ชัดเจน"
                        : "List the key themes separately so the communications team can use them consistently."}
                    </p>
                  </div>
                </div>
                <label
                  className={`${styles.messageHouseField} ${styles.messageHouseFieldWide}`}
                  htmlFor="mh-pillars"
                >
                  <span className={styles.messageHouseLabelRow}>
                    <span>{thai ? "รายการเสาหลัก" : "Pillar list"}</span>
                    <span className={styles.messageHouseRequired}>
                      {thai ? "จำเป็น" : "Required"}
                    </span>
                  </span>
                  <span className={styles.messageHouseHelp} id="mh-pillars-help">
                    {thai
                      ? "ใส่หนึ่งเสาหลักต่อหนึ่งบรรทัด ระบบจะแยกแต่ละบรรทัดเป็นรายการ"
                      : "Enter one pillar per line. Each line is saved as a separate item."}
                  </span>
                  <textarea
                    id="mh-pillars"
                    aria-describedby="mh-pillars-help mh-pillars-count"
                    required
                    maxLength={5000}
                    rows={5}
                    value={draft.pillars}
                    onChange={(event) =>
                      setDraft({ ...draft, pillars: event.target.value })
                    }
                  />
                  <span className={styles.messageHouseCounter} id="mh-pillars-count">
                    {draft.pillars.length}/5000
                  </span>
                </label>
              </section>

              <section className={styles.messageHouseSection}>
                <div className={styles.messageHouseSectionHeader}>
                  <span className={styles.messageHouseStep}>03</span>
                  <div>
                    <h3>{thai ? "หลักการและที่มา" : "Supporting rationale"}</h3>
                    <p>
                      {thai
                        ? "ระบุหลักที่รองรับกรอบสาร และเพิ่มที่มาเพื่อให้ตรวจสอบย้อนหลังได้"
                        : "Ground the message in clear principles and provide a source when available."}
                    </p>
                  </div>
                </div>
                <div className={styles.messageHouseGrid}>
                  <label className={styles.messageHouseField} htmlFor="mh-foundation">
                    <span className={styles.messageHouseLabelRow}>
                      <span>{thai ? "หลักการสนับสนุน" : "Foundation"}</span>
                      <span className={styles.messageHouseRequired}>
                        {thai ? "จำเป็น" : "Required"}
                      </span>
                    </span>
                    <span className={styles.messageHouseHelp} id="mh-foundation-help">
                      {thai
                        ? "หลักฐาน ค่านิยม หรือนโยบายที่เป็นฐานของข้อความ"
                        : "Evidence, values, or policy that supports the message."}
                    </span>
                    <textarea
                      id="mh-foundation"
                      aria-describedby="mh-foundation-help mh-foundation-count"
                      required
                      maxLength={5000}
                      rows={4}
                      value={draft.foundation}
                      onChange={(event) =>
                        setDraft({ ...draft, foundation: event.target.value })
                      }
                    />
                    <span className={styles.messageHouseCounter} id="mh-foundation-count">
                      {draft.foundation.length}/5000
                    </span>
                  </label>
                  <label className={styles.messageHouseField} htmlFor="mh-source">
                    <span className={styles.messageHouseLabelRow}>
                      <span>{thai ? "ที่มา / เหตุผลประกอบ" : "Source rationale"}</span>
                      <span className={styles.messageHouseOptional}>
                        {thai ? "ไม่บังคับ" : "Optional"}
                      </span>
                    </span>
                    <span className={styles.messageHouseHelp} id="mh-source-help">
                      {thai
                        ? "อ้างอิงเอกสาร แหล่งข้อมูล หรือเหตุผลที่ใช้ประกอบการกำหนดกรอบสาร"
                        : "Reference the document, source, or reasoning behind this framework."}
                    </span>
                    <textarea
                      id="mh-source"
                      aria-describedby="mh-source-help mh-source-count"
                      maxLength={5000}
                      rows={4}
                      value={draft.sourceRationale}
                      onChange={(event) =>
                        setDraft({ ...draft, sourceRationale: event.target.value })
                      }
                    />
                    <span className={styles.messageHouseCounter} id="mh-source-count">
                      {draft.sourceRationale.length}/5000
                    </span>
                  </label>
                </div>
              </section>
            </fieldset>
            <footer className={styles.messageHouseFormFooter}>
              <div>
                <strong>{thai ? "บันทึกเป็นฉบับร่าง" : "Draft only"}</strong>
                <p>
                  {thai
                    ? "การบันทึกที่นี่จะยังไม่เผยแพร่หรือเปลี่ยนเวอร์ชันที่มีผลใช้งาน"
                    : "Saving here will not publish changes or replace the effective version."}
                </p>
                {draftNotice && (
                  <p
                    className={`${styles.messageHouseNotice} ${
                      draftNoticeTone === "error" ? styles.messageHouseNoticeError : ""
                    }`}
                    role={draftNoticeTone === "error" ? "alert" : "status"}
                    aria-live={draftNoticeTone === "error" ? "assertive" : "polite"}
                  >
                    {draftNotice}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className={styles.primary}
                  type="submit"
                  disabled={
                    draftSaving || draftLoading || draftLoadFailed || !!reviewBusyId
                  }
                >
                  {draftSaving
                    ? thai
                      ? "กำลังบันทึก…"
                      : "Saving…"
                    : thai
                      ? "บันทึกฉบับร่าง"
                      : "Save draft"}
                </button>
                {working?.status === "DRAFT" && (
                  <button
                    type="button"
                    disabled={
                      draftSaving ||
                      draftLoading ||
                      !!reviewBusyId ||
                      draftContent !== savedContent
                    }
                    onClick={() => void transition(working, "IN_REVIEW")}
                  >
                    {thai ? "ส่งให้ BORD พิจารณา" : "Submit to BORD"}
                  </button>
                )}
                {working?.status === "DRAFT" && draftContent !== savedContent && (
                  <span role="status">
                    {thai
                      ? "บันทึกการเปลี่ยนแปลงก่อนส่ง"
                      : "Save changes before submitting."}
                  </span>
                )}
              </div>
            </footer>
          </form>
        )}
      {canEdit && draftNotice && (draftLoadFailed || working?.status === "IN_REVIEW") && (
        <p
          className={styles.card}
          role={draftNoticeTone === "error" ? "alert" : "status"}
        >
          {draftNotice}
        </p>
      )}
      {canReview && (
        <section
          className={styles.card}
          aria-label={thai ? "คิวพิจารณา Message House" : "Message House review queue"}
        >
          <h2>{thai ? "คิวพิจารณา Message House" : "Message House review queue"}</h2>
          {reviewStatus === "loading" && (
            <p role="status">{thai ? "กำลังโหลดคิว…" : "Loading review queue…"}</p>
          )}
          {reviewStatus === "error" && (
            <p role="alert">
              {thai
                ? "โหลดคิวไม่สำเร็จ โปรดรีเฟรช"
                : "Review queue unavailable. Refresh to retry."}
            </p>
          )}
          {reviewNotice && (
            <p
              role={
                reviewNotice.includes("recorded") || reviewNotice.includes("บันทึกผล")
                  ? "status"
                  : "alert"
              }
            >
              {reviewNotice}
            </p>
          )}
          {reviewStatus === "loaded" && reviews.length === 0 && (
            <p>{thai ? "ไม่มีรายการรอพิจารณา" : "No versions awaiting review."}</p>
          )}
          {reviewStatus === "loaded" &&
            reviews.map((version) => (
              <article key={version.id} className={styles.messageHouse}>
                <h3>
                  {thai ? "เวอร์ชัน" : "Version"} {version.versionNumber}
                </h3>
                <h4>{thai ? "วิสัยทัศน์ / พันธกิจ" : "Vision / Mission"}</h4>
                <p>{version.vision}</p>
                <h4>{thai ? "จุดยืนขององค์กร" : "Brand positioning"}</h4>
                <p>{version.positioning}</p>
                <h4>{thai ? "เสาหลักการสื่อสาร" : "Communication pillars"}</h4>
                <ul>
                  {version.pillars.map((pillar, index) => (
                    <li key={`${version.id}-${index}`}>{pillar}</li>
                  ))}
                </ul>
                <h4>{thai ? "หลักการสนับสนุน" : "Foundation"}</h4>
                <p>{version.foundation}</p>
                <h4>{thai ? "ที่มา / เหตุผลประกอบ" : "Source rationale"}</h4>
                <p>{version.sourceRationale || "—"}</p>
                <label htmlFor={`mh-reason-${version.id}`}>
                  {thai ? "เหตุผลการตัดสินใจ (จำเป็น)" : "Decision reason (required)"}
                </label>
                <textarea
                  id={`mh-reason-${version.id}`}
                  maxLength={2000}
                  rows={3}
                  value={reviewReason[version.id] ?? ""}
                  onChange={(event) =>
                    setReviewReason((previous) => ({
                      ...previous,
                      [version.id]: event.target.value,
                    }))
                  }
                  disabled={!!reviewBusyId}
                />
                <label htmlFor={`mh-effective-${version.id}`}>
                  {thai
                    ? "วันเวลาที่มีผล (เวลาไทย; จำเป็นเมื่ออนุมัติ)"
                    : "Effective date and time (Bangkok; required to approve)"}
                </label>
                <input
                  id={`mh-effective-${version.id}`}
                  type="datetime-local"
                  value={reviewEffectiveAt[version.id] ?? ""}
                  onChange={(event) =>
                    setReviewEffectiveAt((previous) => ({
                      ...previous,
                      [version.id]: event.target.value,
                    }))
                  }
                  disabled={!!reviewBusyId}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={
                      !!reviewBusyId ||
                      !reviewReason[version.id]?.trim() ||
                      !reviewEffectiveAt[version.id]
                    }
                    onClick={() => void transition(version, "APPROVED")}
                  >
                    {reviewBusyId === version.id
                      ? thai
                        ? "กำลังบันทึก…"
                        : "Saving…"
                      : thai
                        ? "อนุมัติ"
                        : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={!!reviewBusyId || !reviewReason[version.id]?.trim()}
                    onClick={() => void transition(version, "REJECTED")}
                  >
                    {thai ? "ส่งกลับ" : "Reject"}
                  </button>
                </div>
              </article>
            ))}
        </section>
      )}
      {status === "loading" && (
        <section className={styles.card} role="status" aria-live="polite">
          {thai ? "กำลังโหลด Message House…" : "Loading Message House…"}
        </section>
      )}
      {status === "error" && (
        <section className={styles.card} role="alert">
          {thai
            ? "โหลด Message House ไม่สำเร็จ จึงไม่แสดงข้อมูลตัวอย่าง"
            : "Message House could not be loaded; no sample content is shown."}
        </section>
      )}
      {status === "empty" && (
        <section className={styles.card} role="status">
          {thai
            ? "ยังไม่มี Message House ฉบับที่อนุมัติและมีผลใช้งาน"
            : "No approved and effective Message House version is available."}
        </section>
      )}
      {status === "loaded" && (
        <article className={`${styles.card} ${styles.messageHouse}`}>
          <p>
            <strong>
              {thai ? "เวอร์ชัน" : "Version"} {data.versionNumber}
            </strong>
            {data.effectiveAt && (
              <>
                {" · "}
                {thai ? "มีผลตั้งแต่" : "Effective"}{" "}
                <time dateTime={data.effectiveAt}>
                  {new Date(data.effectiveAt).toLocaleDateString(
                    thai ? "th-TH-u-ca-buddhist" : "en-GB",
                    { year: "numeric", month: "long", day: "numeric" },
                  )}
                </time>
              </>
            )}
          </p>
          <div className={styles.roof}>
            <b>{thai ? "วิสัยทัศน์ / พันธกิจ" : "Vision / Mission"}</b>
            <span>{data.vision}</span>
          </div>
          <div className={styles.positioning}>
            <b>{thai ? "จุดยืนขององค์กร" : "Brand positioning"}</b>
            <span>{data.positioning}</span>
          </div>
          <h2>{thai ? "เสาหลักการสื่อสาร" : "Communication pillars"}</h2>
          <div className={styles.pillars}>
            {data.pillars.map((pillar, index) => (
              <div key={`${index}-${pillar}`}>
                <b>{pillar}</b>
              </div>
            ))}
          </div>
          <div className={styles.foundation}>
            <strong>{thai ? "หลักการสนับสนุน" : "Foundation"}</strong>
            <p>{data.foundation}</p>
          </div>
        </article>
      )}
      {historyStatus === "loading" && (
        <p role="status" aria-live="polite">
          {thai ? "กำลังโหลดประวัติเวอร์ชัน…" : "Loading version history…"}
        </p>
      )}
      {historyStatus === "error" && (
        <p role="alert">
          {thai ? "โหลดประวัติเวอร์ชันไม่สำเร็จ" : "Version history could not be loaded."}
        </p>
      )}
      {historyStatus === "loaded" && (
        <details className={styles.card}>
          <summary>{thai ? "ประวัติเวอร์ชัน" : "Version history"}</summary>
          {history.filter((version) => version.versionNumber !== data.versionNumber)
            .length === 0 ? (
            <p>{thai ? "ไม่มีเวอร์ชันก่อนหน้า" : "No earlier effective versions."}</p>
          ) : (
            history
              .filter((version) => version.versionNumber !== data.versionNumber)
              .map((version) => (
                <details key={version.versionNumber}>
                  <summary>
                    {thai ? "เวอร์ชัน" : "Version"} {version.versionNumber} ·{" "}
                    {new Date(version.effectiveAt).toLocaleDateString(
                      thai ? "th-TH-u-ca-buddhist" : "en-GB",
                      { year: "numeric", month: "long", day: "numeric" },
                    )}
                  </summary>
                  <section className={styles.messageHouse}>
                    <h3>{thai ? "วิสัยทัศน์ / พันธกิจ" : "Vision / Mission"}</h3>
                    <p>{version.vision}</p>
                    <h3>{thai ? "จุดยืนขององค์กร" : "Brand positioning"}</h3>
                    <p>{version.positioning}</p>
                    <h3>{thai ? "เสาหลักการสื่อสาร" : "Communication pillars"}</h3>
                    <ul>
                      {version.pillars.map((pillar, index) => (
                        <li key={`${version.versionNumber}-${index}`}>{pillar}</li>
                      ))}
                    </ul>
                    <h3>{thai ? "หลักการสนับสนุน" : "Foundation"}</h3>
                    <p>{version.foundation}</p>
                  </section>
                </details>
              ))
          )}
        </details>
      )}
    </>
  );
}
function notificationCategory(title: string): { label: string; tone: string } {
  const upper = title.toUpperCase();
  if (upper.startsWith("[DUE]")) return { label: "Due Soon", tone: "amber" };
  if (upper.startsWith("[OVERDUE]")) return { label: "Overdue", tone: "red" };
  if (upper.startsWith("[MANDATORY]")) return { label: "Mandatory", tone: "red" };
  if (upper.startsWith("[CHANGE]")) return { label: "Changed", tone: "blue" };
  if (upper.startsWith("[ASSIGNMENT]")) return { label: "Assigned", tone: "green" };
  if (upper.startsWith("[STATUS]")) return { label: "Status", tone: "blue" };
  if (upper.startsWith("[COMMENT]")) return { label: "Comment", tone: "blue" };
  if (upper.startsWith("[SYSTEM]")) return { label: "System", tone: "purple" };
  return { label: "", tone: "blue" };
}

function Notifications({
  onNavigate,
  notifications,
  onRead,
  language,
}: {
  onNavigate: (target: string) => void;
  notifications: Notification[];
  onRead: (ids: string[]) => void;
  language: Language;
}) {
  return (
    <>
      <SectionHeading
        eyebrow="ACTIVITY"
        title="Notifications"
        action={
          <button
            onClick={() =>
              onRead(notifications.filter((item) => !item.read).map((item) => item.id))
            }
          >
            Mark all read
          </button>
        }
      />
      <section className={styles.list}>
        {notifications.map(({ id, title, message, target, createdAt, read }) => {
          const cat = notificationCategory(title);
          return (
            <button
              key={id}
              className={styles.notification}
              onClick={() => {
                onRead([id]);
                onNavigate(target);
              }}
            >
              <i aria-label={read ? "Read" : "Unread"} />
              <div>
                <b>{title.replace(/^\[[\w]+\]\s*/, "")}</b>
                {cat.label && (
                  <span
                    className={`${styles.status} ${styles[cat.tone]}`}
                    style={{ fontSize: "0.75rem", marginLeft: 8 }}
                  >
                    {cat.label}
                  </span>
                )}
                <span>{message}</span>
                <small>
                  {new Date(createdAt).toLocaleString(
                    language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
                  )}
                </small>
              </div>
            </button>
          );
        })}
      </section>
    </>
  );
}
function History({
  audit,
  language,
  loading,
  loadingMore,
  hasMore,
  error,
  onRefresh,
  onLoadMore,
}: {
  audit: AuditEntry[];
  language: Language;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
}) {
  return (
    <>
      <SectionHeading
        eyebrow="AUDIT"
        title={language === "th" ? "ประวัติกิจกรรม" : "Activity History"}
        action={
          <button type="button" onClick={onRefresh} disabled={loading}>
            {language === "th" ? "รีเฟรช" : "Refresh"}
          </button>
        }
      />
      <article className={styles.card}>
        <p role="note">
          {language === "th"
            ? "แสดงกิจกรรมในขอบเขตสิทธิ์ของคุณ ตามลำดับที่เลือก"
            : "Activity in your authorized scope, in the selected order."}
        </p>
        {loading && (
          <p role="status">
            {language === "th" ? "กำลังโหลดประวัติ…" : "Loading history…"}
          </p>
        )}
        {error && (
          <p role="alert">
            {language === "th"
              ? "โหลดประวัติไม่สำเร็จ ลองอีกครั้ง"
              : "Unable to load history. Retry or refresh."}
          </p>
        )}
        <Table
          headers={["Time", "Actor", "Action", "Entity"]}
          rows={audit.map((entry) => [
            new Date(entry.createdAt).toLocaleString(
              language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
              { timeZone: "Asia/Bangkok" },
            ),
            entry.actorName ?? getUser(entry.actorId)?.name ?? entry.actorId,
            entry.action,
            entry.entityId,
          ])}
        />
        {hasMore && (
          <button type="button" onClick={onLoadMore} disabled={loading || loadingMore}>
            {loadingMore
              ? language === "th"
                ? "กำลังโหลด…"
                : "Loading…"
              : language === "th"
                ? "โหลดประวัติเพิ่ม"
                : "Load more history"}
          </button>
        )}
      </article>
    </>
  );
}
function Directory({
  actor,
  language,
}: {
  actor: {
    userId: string;
    displayName: string;
    role: string;
    isRootAdministrator?: boolean;
    roleGrants?: Array<{ role: string; departmentId: string | null }>;
  };
  language: Language;
}) {
  const effectiveRoleCodes = new Set(
    actor.roleGrants?.length ? actor.roleGrants.map((grant) => grant.role) : [actor.role],
  );
  const isAdministrator = effectiveRoleCodes.has("RTRDA_ADMIN");
  const isPrOperations = effectiveRoleCodes.has("RTRDA_PR");
  const isBoardRole = effectiveRoleCodes.has("RTRDA_BORD");
  const canGrantBoardOnly = !isAdministrator && isPrOperations;
  const [users, setUsers] = useState<
    Array<{
      id: string;
      displayName: string;
      email: string;
      active: boolean;
      department: { id: string; name: string } | null;
      roles: Array<{ id: string; role: string; departmentId: string | null }>;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantTarget, setGrantTarget] = useState<string | null>(null);
  const [grantRole, setGrantRole] = useState<string>(
    canGrantBoardOnly ? "RTRDA_BORD" : "RTRDA_ALL_USER",
  );
  const [grantDepartmentId, setGrantDepartmentId] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantConfirmation, setGrantConfirmation] = useState("");
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{
    userId: string;
    displayName: string;
    roleId: string;
    role: string;
    departmentId: string | null;
  } | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);
  const [accessReason, setAccessReason] = useState("");
  const isOrganizationAdmin =
    isAdministrator &&
    (actor.roleGrants?.some(
      (grant) => grant.role === "RTRDA_ADMIN" && grant.departmentId === null,
    ) ??
      false);
  const canGrantAdministratorRole = isAdministrator && actor.isRootAdministrator === true;
  const isRootAccount = (user: { email: string }) =>
    isRootPrCenterAdministrator(user.email);
  const hasAdministratorRole = (user: (typeof users)[number]) =>
    user.roles.some((grant) => grant.role === "RTRDA_ADMIN");
  const activeOrganizationAdmins = users.filter(
    (user) =>
      user.active &&
      user.roles.some(
        (grant) => grant.role === "RTRDA_ADMIN" && grant.departmentId === null,
      ),
  ).length;
  const isLastOrganizationAdmin = (user: (typeof users)[number]) =>
    user.active &&
    activeOrganizationAdmins <= 1 &&
    user.roles.some(
      (grant) => grant.role === "RTRDA_ADMIN" && grant.departmentId === null,
    );
  const [notice, setNotice] = useState<string | null>(null);

  const reload = () => {
    setError(null);
    fetch("/api/pr-center/admin/users", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load users");
        setUsers(await r.json());
      })
      .catch(() => setError("Could not load user directory"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pr-center/admin/users", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load users");
        if (!cancelled) setUsers(await r.json());
      })
      .catch(() => {
        if (!cancelled) setError("Could not load user directory");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGrant = async (userId: string) => {
    setNotice(null);
    setError(null);
    const reason = grantReason.trim();
    if (!reason)
      return setError(language === "th" ? "กรุณาระบุเหตุผล" : "A reason is required");
    if (grantConfirmation.trim() !== "ตกลง")
      return setError(
        language === "th" ? 'กรุณาพิมพ์ "ตกลง" เพื่อยืนยัน' : 'Type "ตกลง" to confirm',
      );
    setGrantSubmitting(true);
    try {
      const res = await fetch(`/api/pr-center/admin/users/${userId}/roles`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: canGrantBoardOnly ? "RTRDA_BORD" : grantRole,
          departmentId: grantDepartmentId || null,
          reason,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.message || "Grant failed");
        return;
      }
      setNotice(language === "th" ? "เพิ่ม role สำเร็จ" : "Role granted");
      setGrantTarget(null);
      setGrantReason("");
      setGrantConfirmation("");
      reload();
    } catch {
      setError(
        language === "th"
          ? "เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง"
          : "Could not connect. Please try again.",
      );
    } finally {
      setGrantSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setNotice(null);
    setError(null);
    const reason = revokeReason.trim();
    if (!reason)
      return setError(language === "th" ? "กรุณาระบุเหตุผล" : "A reason is required");
    setRevokeSubmitting(true);
    try {
      const res = await fetch(`/api/pr-center/admin/roles/${revokeTarget.roleId}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(
          err?.message || (language === "th" ? "ถอน role ไม่สำเร็จ" : "Revoke failed"),
        );
        return;
      }
      setNotice(language === "th" ? "ถอน role สำเร็จ" : "Role revoked");
      setRevokeTarget(null);
      setRevokeReason("");
      reload();
    } catch {
      setError(
        language === "th"
          ? "เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง"
          : "Could not connect. Please try again.",
      );
    } finally {
      setRevokeSubmitting(false);
    }
  };

  const handleToggleActive = async (userId: string) => {
    setNotice(null);
    setError(null);
    const reason = accessReason.trim();
    if (!reason)
      return setError(language === "th" ? "กรุณาระบุเหตุผล" : "A reason is required");
    const res = await fetch(`/api/pr-center/admin/users/${userId}/active`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setError(err?.message || "Status toggle failed");
      return;
    }
    setNotice("User status updated");
    setAccessReason("");
    reload();
  };

  return (
    <>
      <SectionHeading eyebrow="ACCESS ADMINISTRATION" title="User Directory" />
      {isAdministrator && !canGrantAdministratorRole && (
        <p role="note" className={styles.libraryNotice}>
          {language === "th"
            ? "การมอบหมาย/ถอน role ผู้ดูแลและการปิดบัญชีผู้ดูแลทำได้โดยผู้ดูแลหลักเท่านั้น"
            : "Only the root administrator can grant or revoke administrator roles or deactivate administrator accounts."}
        </p>
      )}
      {canGrantBoardOnly && (
        <p role="note" className={styles.libraryNotice}>
          {language === "th"
            ? "RTRDA_PR มอบหมายได้เฉพาะ role RTRDA_BORD ให้ผู้ใช้ในแผนกเดียวกัน โดยมีเหตุผลประกอบ"
            : "RTRDA_PR may grant only RTRDA_BORD to users in its department, with a required reason."}
        </p>
      )}
      {isBoardRole && !isAdministrator && !isPrOperations && (
        <p role="note" className={styles.libraryNotice}>
          {language === "th"
            ? "คุณดูรายชื่อผู้ใช้และ role ภายในขอบเขตของ RTRDA_BORD ได้ แต่การจัดการ role ทำได้โดยผู้ดูแลหรือ RTRDA_PR ตามสิทธิ์"
            : "You can view users and roles within your RTRDA_BORD scope. Role management is reserved for administrators and authorized RTRDA_PR users."}
        </p>
      )}
      {isAdministrator && (
        <label style={{ display: "grid", gap: 4, margin: "8px 0 16px" }}>
          <span>
            {language === "th"
              ? "เหตุผลในการเปลี่ยนสิทธิ์ (จำเป็น)"
              : "Reason for access change (required)"}
          </span>
          <textarea
            value={accessReason}
            maxLength={1000}
            onChange={(event) => setAccessReason(event.target.value)}
            aria-required="true"
            rows={2}
          />
          <small>
            {language === "th"
              ? "ไม่ใส่รหัสผ่านหรือข้อมูลส่วนบุคคลที่อ่อนไหว"
              : "Do not include passwords or sensitive personal information."}
          </small>
        </label>
      )}
      {notice && (
        <p style={{ color: "#16a34a", fontSize: 13, margin: "4px 0" }}>{notice}</p>
      )}
      {error && (
        <p style={{ color: "#dc2626", fontSize: 13, margin: "4px 0" }}>{error}</p>
      )}
      {loading && <p>Loading user directory…</p>}
      {!loading &&
        users.map((user) => (
          <Fragment key={user.id}>
            <article className={styles.card} style={{ marginBottom: 12 }}>
              <header>
                <div>
                  <h2>{user.displayName}</h2>
                  <p style={{ fontSize: 13, color: "#6b7280" }}>{user.email}</p>
                  <p style={{ fontSize: 13 }}>
                    {user.department?.name || "No department"} ·{" "}
                    {user.active ? "Active" : "Inactive"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {isAdministrator && (
                    <button
                      onClick={() => handleToggleActive(user.id)}
                      disabled={
                        user.id === actor.userId ||
                        isRootAccount(user) ||
                        (hasAdministratorRole(user) && !canGrantAdministratorRole) ||
                        isLastOrganizationAdmin(user) ||
                        !accessReason.trim()
                      }
                      title={
                        isRootAccount(user)
                          ? language === "th"
                            ? "บัญชีผู้ดูแลหลักถูกป้องกันจากการปิดใช้งาน"
                            : "The root administrator account is protected"
                          : hasAdministratorRole(user) && !canGrantAdministratorRole
                            ? language === "th"
                              ? "เฉพาะผู้ดูแลหลักเท่านั้นที่เปลี่ยนสถานะผู้ดูแลได้"
                              : "Only the root administrator can deactivate administrators"
                            : isLastOrganizationAdmin(user)
                              ? "At least one active organization-wide administrator must remain"
                              : undefined
                      }
                      style={{ fontSize: 12, color: user.active ? "#dc2626" : "#16a34a" }}
                    >
                      {user.active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                  {(isAdministrator || isPrOperations) && (
                    <button
                      onClick={() => {
                        const nextTarget = grantTarget === user.id ? null : user.id;
                        setGrantTarget(nextTarget);
                        setError(null);
                        setGrantReason("");
                        setGrantConfirmation("");
                        if (nextTarget)
                          setGrantDepartmentId(
                            isOrganizationAdmin ? "" : (user.department?.id ?? ""),
                          );
                      }}
                      disabled={user.id === actor.userId}
                      title={
                        user.id === actor.userId
                          ? "You cannot grant roles to your own account"
                          : undefined
                      }
                      style={{ fontSize: 12 }}
                    >
                      + Grant role
                    </button>
                  )}
                </div>
              </header>
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Assigned roles:
                </p>
                {user.roles.length === 0 && (
                  <p style={{ fontSize: 12, color: "#6b7280" }}>No roles assigned</p>
                )}
                {user.roles.map((r) => (
                  <span
                    key={r.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      marginRight: 8,
                      marginBottom: 4,
                      padding: "2px 8px",
                      background: "#f3f4f6",
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  >
                    {r.role} · {r.departmentId ? `dept ${r.departmentId}` : "org-wide"}
                    {isAdministrator && (
                      <button
                        type="button"
                        aria-label={`${language === "th" ? "ถอน role" : "Revoke role"}: ${r.role}`}
                        onClick={() => {
                          setError(null);
                          setGrantTarget(null);
                          setRevokeReason("");
                          setRevokeTarget({
                            userId: user.id,
                            displayName: user.displayName,
                            roleId: r.id,
                            role: r.role,
                            departmentId: r.departmentId,
                          });
                        }}
                        disabled={
                          isRootAccount(user) ||
                          (r.role === "RTRDA_ADMIN" && !canGrantAdministratorRole) ||
                          (user.active &&
                            r.role === "RTRDA_ADMIN" &&
                            r.departmentId === null &&
                            activeOrganizationAdmins <= 1)
                        }
                        title={
                          isRootAccount(user)
                            ? language === "th"
                              ? "บัญชีผู้ดูแลหลักถูกป้องกัน"
                              : "The root administrator account is protected"
                            : r.role === "RTRDA_ADMIN" && !canGrantAdministratorRole
                              ? language === "th"
                                ? "เฉพาะผู้ดูแลหลักเท่านั้นที่ถอน role ผู้ดูแลได้"
                                : "Only the root administrator can revoke administrator roles"
                              : user.active &&
                                  r.role === "RTRDA_ADMIN" &&
                                  r.departmentId === null &&
                                  activeOrganizationAdmins <= 1
                                ? "At least one active organization-wide administrator must remain"
                                : language === "th"
                                  ? "ถอน role"
                                  : "Revoke role"
                        }
                        style={{
                          fontSize: 11,
                          color: "#dc2626",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </article>
            {grantTarget === user.id && (
              <div
                role="presentation"
                onClick={() => setGrantTarget(null)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 1000,
                  display: "grid",
                  placeItems: "center",
                  padding: 16,
                  background: "rgba(15, 23, 42, 0.55)",
                }}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="grant-role-title"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && !grantSubmitting) setGrantTarget(null);
                  }}
                  style={{
                    width: "min(100%, 480px)",
                    display: "grid",
                    gap: 12,
                    padding: 20,
                    borderRadius: 12,
                    background: "white",
                    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
                  }}
                >
                  <h2 id="grant-role-title" style={{ margin: 0 }}>
                    {language === "th" ? "เพิ่ม role ให้ผู้ใช้" : "Grant a role"}
                  </h2>
                  <p style={{ margin: 0, color: "#4b5563" }}>{user.displayName}</p>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>{language === "th" ? "Role" : "Role"}</span>
                    {canGrantBoardOnly ? (
                      <span>RTRDA_BORD</span>
                    ) : (
                      <select
                        aria-label="Role"
                        value={grantRole}
                        onChange={(event) => setGrantRole(event.target.value)}
                      >
                        <option value="RTRDA_ALL_USER">RTRDA_ALL_USER</option>
                        <option value="RTRDA_PR">RTRDA_PR</option>
                        <option value="RTRDA_BORD">RTRDA_BORD</option>
                        <option value="RTRDA_ADMIN" disabled={!canGrantAdministratorRole}>
                          RTRDA_ADMIN
                        </option>
                      </select>
                    )}
                  </label>
                  {isAdministrator && !canGrantAdministratorRole && (
                    <p role="note">
                      {language === "th"
                        ? "เฉพาะผู้ดูแลหลัก admin@apprtrda.onmicrosoft.com เท่านั้นที่มอบหมาย role ผู้ดูแลได้"
                        : "Only the root administrator can grant RTRDA_ADMIN."}
                    </p>
                  )}
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>{language === "th" ? "ขอบเขตสิทธิ์" : "Role scope"}</span>
                    {isOrganizationAdmin ? (
                      <select
                        aria-label="Role scope"
                        value={grantDepartmentId}
                        onChange={(event) => setGrantDepartmentId(event.target.value)}
                      >
                        <option value="">Organization-wide</option>
                        {user.department && (
                          <option value={user.department.id}>
                            Department: {user.department.name}
                          </option>
                        )}
                      </select>
                    ) : (
                      <span>{user.department?.name || "No department"}</span>
                    )}
                  </label>
                  {error && (
                    <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>
                      {error}
                    </p>
                  )}
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>
                      {language === "th" ? "เหตุผล (จำเป็น)" : "Reason (required)"}
                    </span>
                    <textarea
                      value={grantReason}
                      maxLength={1000}
                      rows={3}
                      onChange={(event) => setGrantReason(event.target.value)}
                      aria-required="true"
                    />
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>
                      {language === "th"
                        ? 'พิมพ์ "ตกลง" เพื่อยืนยันการเพิ่มสิทธิ์'
                        : 'Type "ตกลง" to confirm this role grant'}
                    </span>
                    <input
                      value={grantConfirmation}
                      onChange={(event) => setGrantConfirmation(event.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setGrantTarget(null)}
                      disabled={grantSubmitting}
                    >
                      {language === "th" ? "ยกเลิก" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => void handleGrant(user.id)}
                      disabled={
                        grantSubmitting ||
                        !grantReason.trim() ||
                        grantConfirmation.trim() !== "ตกลง"
                      }
                    >
                      {grantSubmitting
                        ? language === "th"
                          ? "กำลังบันทึก…"
                          : "Saving…"
                        : language === "th"
                          ? "ยืนยันเพิ่ม role"
                          : "Confirm grant"}
                    </button>
                  </div>
                </section>
              </div>
            )}
            {revokeTarget?.userId === user.id && (
              <div
                role="presentation"
                onClick={() => {
                  if (!revokeSubmitting) setRevokeTarget(null);
                }}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 1000,
                  display: "grid",
                  placeItems: "center",
                  padding: 16,
                  background: "rgba(15, 23, 42, 0.55)",
                }}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="revoke-role-title"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && !revokeSubmitting)
                      setRevokeTarget(null);
                  }}
                  style={{
                    width: "min(100%, 480px)",
                    display: "grid",
                    gap: 12,
                    padding: 20,
                    borderRadius: 12,
                    background: "white",
                    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
                  }}
                >
                  <h2 id="revoke-role-title" style={{ margin: 0 }}>
                    {language === "th" ? "ยืนยันการถอน role" : "Confirm role revocation"}
                  </h2>
                  <p style={{ margin: 0, color: "#4b5563" }}>
                    {revokeTarget.displayName} · {revokeTarget.role} ·{" "}
                    {revokeTarget.departmentId
                      ? `dept ${revokeTarget.departmentId}`
                      : "org-wide"}
                  </p>
                  {error && (
                    <p role="alert" style={{ color: "#b91c1c", margin: 0 }}>
                      {error}
                    </p>
                  )}
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>
                      {language === "th" ? "เหตุผล (จำเป็น)" : "Reason (required)"}
                    </span>
                    <textarea
                      value={revokeReason}
                      maxLength={1000}
                      rows={3}
                      onChange={(event) => setRevokeReason(event.target.value)}
                      aria-required="true"
                    />
                    <small>
                      {language === "th"
                        ? "กรอกเหตุผลเพื่อเปิดใช้งานปุ่มยืนยันถอน role"
                        : "Enter a reason to enable role revocation."}
                    </small>
                  </label>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(null)}
                      disabled={revokeSubmitting}
                    >
                      {language === "th" ? "ยกเลิก" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => void handleRevoke()}
                      disabled={revokeSubmitting || !revokeReason.trim()}
                    >
                      {revokeSubmitting
                        ? language === "th"
                          ? "กำลังบันทึก…"
                          : "Saving…"
                        : language === "th"
                          ? "ยืนยันถอน role"
                          : "Confirm revoke"}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </Fragment>
        ))}
    </>
  );
}
function MasterDataEditor({
  label: itemLabel,
  values,
  onSave,
}: {
  label: string;
  values: string[];
  onSave: (values: string[]) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values.join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <article className={styles.card}>
      <header>
        <h2>{itemLabel}</h2>
        <button
          onClick={() => {
            setDraft(values.join("\n"));
            setEditing(!editing);
          }}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </header>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={itemLabel}
          />
          <button
            className={styles.primary}
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                const saved = await onSave(
                  draft
                    .split("\n")
                    .map((value) => value.trim())
                    .filter(Boolean),
                );
                if (saved) setEditing(false);
                else setError("Master data save failed");
              } catch {
                setError("Master data save failed");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {error && <p role="alert">{error}</p>}
        </>
      ) : (
        <p>{values.join(" · ")}</p>
      )}
    </article>
  );
}
function Settings({ language }: { language: Language }) {
  const [sort, setSort] = useState(DEFAULT_LIST_SORT);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [reload, setReload] = useState(0);
  const [auditEvents, setAuditEvents] = useState<
    Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      createdAt: string;
      before: unknown;
      after: unknown;
      actor: { displayName: string; email: string } | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/pr-center/admin/access-audit?${new URLSearchParams({ take: "201", sort, offset: String(offset) })}`,
      { credentials: "same-origin", cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load access audit");
        const events = (await r.json()) as typeof auditEvents;
        if (!cancelled) {
          setAuditEvents((previous) =>
            offset === 0
              ? events.slice(0, 200)
              : [
                  ...previous,
                  ...events
                    .slice(0, 200)
                    .filter((event) => !previous.some((item) => item.id === event.id)),
                ],
          );
          setHasMore(events.length > 200);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load access audit events");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sort, offset, reload]);

  const actionLabel: Record<string, string> = {
    "access.role_granted": "Role granted",
    "access.role_revoked": "Role revoked",
    "access.user_activated": "User activated",
    "access.user_deactivated": "User deactivated",
    "auth.oidc_login": "SSO login",
  };

  return (
    <>
      <SectionHeading
        eyebrow="ACCESS ADMINISTRATION"
        title={language === "th" ? "บันทึกการเข้าถึง" : "Access Audit Log"}
      />
      <ListSorting
        kind="audit"
        value={sort}
        language={language}
        onChange={(value) => {
          setLoading(true);
          setError(null);
          setAuditEvents([]);
          setOffset(0);
          setHasMore(false);
          setSort(value);
        }}
      />
      {error && (
        <p role="alert" style={{ color: "#dc2626", fontSize: 13 }}>
          {language === "th" ? "โหลดบันทึกการเข้าถึงไม่สำเร็จ" : error}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setReload((value) => value + 1);
            }}
          >
            {language === "th" ? "ลองอีกครั้ง" : "Retry"}
          </button>
        </p>
      )}
      {loading && (
        <p role="status">
          {language === "th" ? "กำลังโหลดประวัติการเข้าถึง…" : "Loading audit events…"}
        </p>
      )}
      {!loading && auditEvents.length === 0 && (
        <article className={styles.card}>
          <p>No access events recorded yet.</p>
        </article>
      )}
      {!loading && auditEvents.length > 0 && (
        <article className={styles.card}>
          <Table
            headers={["Time", "Action", "Actor", "Entity", "Details"]}
            rows={auditEvents.map((event) => [
              new Date(event.createdAt).toLocaleString(
                language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
              ),
              actionLabel[event.action] || event.action,
              event.actor?.displayName || "system",
              event.entityId,
              JSON.stringify(event.after || event.before || ""),
            ])}
          />
          {hasMore && !error && (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                setOffset((value) => value + 200);
              }}
            >
              {language === "th" ? "โหลดบันทึกเพิ่ม" : "Load more events"}
            </button>
          )}
        </article>
      )}
    </>
  );
}
function SystemData({
  state,
  data,
  onSave,
  language,
}: {
  state: PrCenterState;
  data: MasterData;
  onSave: (data: MasterData) => Promise<boolean>;
  language: Language;
}) {
  const exportData = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    link.download = "rtrda-pr-center-data.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <>
      <SectionHeading
        eyebrow="ADMINISTRATION"
        title="System Data"
        action={
          <button className={styles.primary} onClick={exportData}>
            Export data
          </button>
        }
      />
      <section className={styles.settings}>
        <MasterDataEditor
          label={language === "th" ? "ประเภทเนื้อหา" : "Content types"}
          values={data.contentTypes}
          onSave={(contentTypes) => onSave({ ...data, contentTypes })}
        />
        <MasterDataEditor
          label={language === "th" ? "ช่องทางเผยแพร่" : "Publishing channels"}
          values={data.channels}
          onSave={(channels) => onSave({ ...data, channels })}
        />
        <MasterDataEditor
          label={language === "th" ? "เสาหลักเนื้อหา" : "Content pillars"}
          values={data.contentPillars}
          onSave={(contentPillars) => onSave({ ...data, contentPillars })}
        />
      </section>
      <section className={styles.card}>
        <h2>{language === "th" ? "หน่วยงานในระบบ" : "Departments"}</h2>
        <p>
          {data.departments.join(" · ") ||
            (language === "th" ? "ยังไม่มีหน่วยงาน" : "No departments")}
        </p>
        <h2>{language === "th" ? "ขั้นอนุมัติ" : "Approval stages"}</h2>
        <p>{data.approvalStages.join(" · ")}</p>
      </section>
      <section className={styles.filterBar}>
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          {language === "th"
            ? "ช่องทาง ประเภทเนื้อหา และเสาหลักเนื้อหาบันทึกไว้ในฐานข้อมูลส่วนกลาง"
            : "Channels, content types, and content pillars are saved centrally."}
        </p>
      </section>
    </>
  );
}
function Help({
  role,
  onNavigate,
  language,
}: {
  role: Role;
  onNavigate: (page: Page) => void;
  language: Language;
}) {
  const [guide, setGuide] = useState<string | null>(null);
  const guideTargets: Page[] = ["new-request", "operations", "approvals", "library"];
  return (
    <>
      <SectionHeading
        eyebrow="GETTING STARTED"
        title="How to Use"
        action={
          <span>
            {language === "th" ? "บทบาท" : "Signed in as"} {role}
          </span>
        }
      />
      <article className={styles.card}>
        <h2>
          {language === "th"
            ? "เริ่มใช้งานพื้นที่ทำงาน PR Center"
            : "Start in the PR Center workspace"}
        </h2>
        <p>
          Use the sidebar to move between intake, production, approvals, and reporting.
          Your available actions are determined by your authenticated role and scope.
        </p>
      </article>
      <section className={styles.helpGrid}>
        {[
          [
            "1",
            "Submit a request",
            "Choose PR work or off-site support and provide source information.",
          ],
          [
            "2",
            "Follow production",
            "Track tasks on the board and complete review requirements.",
          ],
          [
            "3",
            "Publish with confidence",
            "Use the publication gate before scheduling content.",
          ],
          [
            "4",
            "Review publication",
            "Review publication evidence. Reach and engagement are shown only when a verified analytics source is available.",
          ],
        ].map(([number, title, description], index) => (
          <article key={number} className={styles.card}>
            <b className={styles.helpNumber}>{number}</b>
            <h2>{title}</h2>
            <p>{description}</p>
            <button onClick={() => setGuide(guide === title ? null : title)}>
              {guide === title ? "Close guide" : "Read guide"}
            </button>
            {guide === title && (
              <p>
                {ROLE_PAGES[role].includes(guideTargets[index]) ? (
                  <button onClick={() => onNavigate(guideTargets[index])}>
                    {index === 0
                      ? "Open request form"
                      : index === 1
                        ? "Open production board"
                        : index === 2
                          ? "Open approval queue"
                          : "Open content library"}
                  </button>
                ) : (
                  "This step is available to the assigned workflow role."
                )}
              </p>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
function FieldLabel({
  required = false,
  children,
}: {
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span>
      {children}
      {required && (
        <span className={styles.requiredMark} aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </span>
  );
}

function RequestModal({
  language,
  requesterName,
  contentTypes,
  draftLoading,
  draftSaving,
  submitting,
  isEditing,
  draft,
  onChange,
  onClose,
  onSubmit,
}: {
  language: Language;
  requesterName: string;
  contentTypes: string[];
  draftLoading: boolean;
  draftSaving: boolean;
  submitting: boolean;
  isEditing: boolean;
  draft: RequestDraft;
  onChange: (draft: RequestDraft) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const thai = language === "th";
  return (
    <div
      className={`${styles.modalBackdrop} ${styles.requestModalBackdrop}`}
      role="presentation"
    >
      <form
        className={`${styles.modal} ${styles.requestModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-title"
        onSubmit={onSubmit}
      >
        <header className={styles.requestModalHeader}>
          <div>
            <h2 id="request-title">
              {isEditing
                ? thai
                  ? "แก้ไขคำขอ"
                  : "Edit work request"
                : thai
                  ? "ส่งคำขอสำหรับงาน"
                  : "Submit a work request"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={thai ? "ปิดหน้าต่าง" : "Close dialog"}
          >
            ×
          </button>
        </header>
        <div className={styles.requestModalBody}>
          <div className={styles.requestFormHint}>
            {thai
              ? "เลือกประเภทงานและกรอกข้อมูลที่จำเป็น ระบบจะแสดงช่องกรอกตามประเภทงาน"
              : "Choose a request type and complete the required fields. The form adapts to your selection."}{" "}
            {draftLoading
              ? thai
                ? "กำลังตรวจสอบร่างที่บันทึกไว้…"
                : "Checking for a saved draft…"
              : draftSaving
                ? thai
                  ? "กำลังบันทึกร่าง…"
                  : "Saving draft…"
                : thai
                  ? "บันทึกร่างอัตโนมัติแล้ว"
                  : "Draft autosaves automatically."}
          </div>
          <div className={styles.typePicker}>
            <button
              type="button"
              className={draft.type === "pr" ? styles.selectedType : ""}
              aria-pressed={draft.type === "pr"}
              onClick={() => onChange({ ...draft, type: "pr" })}
            >
              <b aria-hidden="true">📣</b>
              <span>
                <strong>{thai ? "ประชาสัมพันธ์" : "Public relations"}</strong>
                <small>
                  {thai
                    ? "ขอผลิตและเผยแพร่ Content ผ่านช่องทางขององค์กร"
                    : "Request content production and publication through agency channels."}
                </small>
              </span>
            </button>
            <button
              type="button"
              className={draft.type === "offsite" ? styles.selectedType : ""}
              aria-pressed={draft.type === "offsite"}
              onClick={() => onChange({ ...draft, type: "offsite" })}
            >
              <b aria-hidden="true">🚐</b>
              <span>
                <strong>{thai ? "ออกนอกพื้นที่" : "Off-site"}</strong>
                <small>
                  {thai
                    ? "ขอทีม PR ลงพื้นที่เพื่อเก็บภาพ วิดีโอ หรือปฏิบัติงานร่วมกับคณะทำงาน"
                    : "Request PR support on location for photography, video, or team activities."}
                </small>
              </span>
            </button>
          </div>
          <div className={styles.formGrid}>
            <label>
              <FieldLabel required>
                {thai ? "ชื่อโครงการหรือกิจกรรม" : "Project / activity name"}
              </FieldLabel>
              <input
                value={draft.title}
                placeholder={
                  thai
                    ? "เช่น อัปเดตความคืบหน้าโครงการ AI Camera"
                    : "e.g. AI Camera project update"
                }
                minLength={3}
                maxLength={300}
                onChange={(event) => onChange({ ...draft, title: event.target.value })}
                required
              />
            </label>
            <label>
              <FieldLabel required>{thai ? "ฝ่าย" : "Department"}</FieldLabel>
              <input value={draft.department} readOnly aria-required="true" />
            </label>
            <label>
              <FieldLabel required>{thai ? "ผู้ยื่นคำขอ" : "Requester"}</FieldLabel>
              <input value={requesterName} readOnly aria-required="true" />
            </label>
            <label>
              <FieldLabel required>{thai ? "ผู้มอบหมายงาน" : "Assigner"}</FieldLabel>
              <input
                value={draft.assigner}
                placeholder={
                  thai
                    ? "ชื่อหัวหน้าหรือผู้บริหารที่มอบหมาย"
                    : "Name of assigning manager or executive"
                }
                onChange={(event) => onChange({ ...draft, assigner: event.target.value })}
                required
              />
            </label>
            <label>
              <FieldLabel required>
                {thai ? "เจ้าของโครงการ" : "Project owner"}
              </FieldLabel>
              <input
                value={draft.owner}
                placeholder={thai ? "ชื่อผู้รับผิดชอบโครงการ" : "Project owner name"}
                onChange={(event) => onChange({ ...draft, owner: event.target.value })}
                required
              />
            </label>
            <label>
              <FieldLabel required>
                {draft.type === "pr"
                  ? thai
                    ? "วันที่ต้องการเผยแพร่"
                    : "Requested publish date"
                  : thai
                    ? "วันที่ลงพื้นที่"
                    : "Off-site date"}
              </FieldLabel>
              <input
                type="date"
                value={draft.requestedDate}
                onChange={(event) =>
                  onChange({ ...draft, requestedDate: event.target.value })
                }
                required
              />
            </label>
            <label className={styles.full}>
              {thai
                ? "ลิงก์ข้อมูลต้นทาง / โฟลเดอร์โครงการ (ใส่ได้หลายลิงก์ แยกบรรทัด)"
                : "Source links / project folder (one link per line)"}
              <textarea
                value={draft.source}
                onChange={(event) => onChange({ ...draft, source: event.target.value })}
                required
              />
            </label>
            {draft.type === "pr" ? (
              <>
                <label>
                  {thai ? "วัตถุประสงค์การสื่อสาร" : "Communication objective"}
                  <textarea
                    value={draft.objective}
                    onChange={(event) =>
                      onChange({ ...draft, objective: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  {thai ? "เหตุผลที่ต้องสื่อสารในช่วงนี้" : "Why communicate now?"}
                  <textarea
                    value={draft.whyNow}
                    onChange={(event) =>
                      onChange({ ...draft, whyNow: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  {thai ? "กลุ่มเป้าหมาย" : "Target audience"}
                  <textarea
                    value={draft.audience}
                    onChange={(event) =>
                      onChange({ ...draft, audience: event.target.value })
                    }
                    required
                  />
                </label>
                <fieldset className={`${styles.contentTypeChoices} ${styles.full}`}>
                  <legend>{thai ? "ประเภทเนื้อหาที่ต้องการ" : "Content types"}</legend>
                  <div>
                    {contentTypes.map((contentType) => (
                      <label key={contentType}>
                        <input
                          type="checkbox"
                          checked={draft.contentTypes.includes(contentType)}
                          onChange={(event) =>
                            onChange({
                              ...draft,
                              contentTypes: event.target.checked
                                ? [...draft.contentTypes, contentType]
                                : draft.contentTypes.filter(
                                    (item) => item !== contentType,
                                  ),
                            })
                          }
                        />
                        {contentType}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  {thai ? "ระดับความสำคัญ" : "Priority"}
                  <select
                    value={draft.priority}
                    onChange={(event) =>
                      onChange({ ...draft, priority: event.target.value })
                    }
                    required
                  >
                    <option value="LOW">{thai ? "ปกติ · ต่ำ" : "Low"}</option>
                    <option value="NORMAL">{thai ? "ปกติ" : "Normal"}</option>
                    <option value="HIGH">{thai ? "สูง" : "High"}</option>
                    <option value="URGENT">{thai ? "เร่งด่วน" : "Urgent"}</option>
                  </select>
                </label>
                <label>
                  {thai ? "เหตุผลประกอบความสำคัญ (ถ้ามี)" : "Priority reason (optional)"}
                  <input
                    value={draft.priorityReason}
                    onChange={(event) =>
                      onChange({ ...draft, priorityReason: event.target.value })
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <label className={styles.full}>
                  {thai
                    ? "รายละเอียดและวัตถุประสงค์ หรือความคืบหน้าของโครงการ (ไม่บังคับ)"
                    : "Project details, objective, or progress (optional)"}
                  <textarea
                    value={draft.projectDetails}
                    onChange={(event) =>
                      onChange({ ...draft, projectDetails: event.target.value })
                    }
                  />
                </label>
                <label>
                  {thai ? "เวลาเริ่มต้น" : "Start time"}
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(event) =>
                      onChange({ ...draft, startTime: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  {thai ? "เวลาสิ้นสุด" : "End time"}
                  <input
                    type="time"
                    min={draft.startTime || undefined}
                    value={draft.endTime}
                    onChange={(event) =>
                      onChange({ ...draft, endTime: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  {thai ? "การเดินทาง" : "Travel arrangement"}
                  <select
                    value={draft.travel}
                    onChange={(event) =>
                      onChange({ ...draft, travel: event.target.value })
                    }
                  >
                    <option value="RTRDA transport confirmed">
                      {thai ? "จองรถของ สทร. สำเร็จแล้ว" : "RTRDA transport confirmed"}
                    </option>
                    <option value="Public or private transport">
                      {thai
                        ? "เดินทางโดยรถสาธารณะ / รถส่วนตัว"
                        : "Public transport / private vehicle"}
                    </option>
                    <option value="Rental vehicle with project lead approval">
                      {thai
                        ? "เดินทางร่วมกับคณะเดินทางโดยการเช่ารถ"
                        : "Travel with the team by rental vehicle"}
                    </option>
                  </select>
                  {draft.travel === "Public or private transport" && (
                    <small className={styles.formHint}>
                      {thai ? "สำหรับการเดินทางในกรุงเทพฯ" : "For travel within Bangkok."}
                    </small>
                  )}
                  {draft.travel === "Rental vehicle with project lead approval" && (
                    <small className={styles.formWarning}>
                      {thai
                        ? "สำหรับการเดินทางไปต่างจังหวัด โดยต้องได้รับอนุมัติจากหัวหน้าโครงการก่อน"
                        : "For provincial travel; project-lead approval is required first."}
                    </small>
                  )}
                </label>
              </>
            )}
            <label className={styles.full}>
              {thai
                ? "ไฟล์ตัวอย่าง / เอกสารประกอบ"
                : "Sample files / supporting documents"}
              <input
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                onChange={(event) =>
                  onChange({ ...draft, samples: Array.from(event.target.files || []) })
                }
              />
              {draft.samples.length > 0 && (
                <small>{draft.samples.map((file) => file.name).join(", ")}</small>
              )}
            </label>
            <label className={`${styles.confirmAccuracy} ${styles.full}`}>
              <input
                type="checkbox"
                checked={draft.confirmed}
                onChange={(event) =>
                  onChange({ ...draft, confirmed: event.target.checked })
                }
                required
              />
              {thai
                ? "ขอยืนยันว่าข้อมูลและเอกสารต้นทางถูกต้อง ครบถ้วน และสามารถตรวจสอบได้"
                : "I confirm the source information and documents are accurate, complete, and verifiable."}
            </label>
          </div>
        </div>
        <footer className={styles.requestModalFooter}>
          <button type="button" onClick={onClose} disabled={submitting}>
            {thai ? "ยกเลิก" : "Cancel"}
          </button>
          <button type="submit" value="draft" disabled={draftLoading || submitting}>
            {thai ? "บันทึกฉบับร่าง" : "Save draft"}
          </button>
          <button
            className={styles.primary}
            type="submit"
            value="submit"
            disabled={draftLoading || submitting}
          >
            {submitting
              ? thai
                ? "กำลังบันทึก…"
                : "Saving…"
              : isEditing
                ? thai
                  ? "บันทึกและส่งคำขอ"
                  : "Save and submit request"
                : thai
                  ? "ส่งคำขอ"
                  : "Submit request"}
          </button>
        </footer>
      </form>
    </div>
  );
}
