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
import type { CreateContentIdeaInput } from "@/lib/pr-center/idea-input";
import { submitIdeaForm } from "@/lib/pr-center/idea-form";
import { parseIdeaListPage, type IdeaListRecord } from "@/lib/pr-center/idea-view";
import { parseCalendarEntries, type CalendarEntry } from "@/lib/pr-center/calendar-view";
import { canEditOwnRequest } from "@/lib/pr-center/request-edit";
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
type PrCenterRoleCode =
  | "REQUESTER"
  | "PR_OPERATIONS"
  | "APPROVER"
  | "EXECUTIVE_READ_ONLY"
  | "SCOPED_ADMINISTRATOR";
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
  taskIds: string[];
  source?: string;
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
  revisionNumber?: number;
  objective?: string;
  audience?: string;
  startTime?: string;
  travel?: string;
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
  travel: string;
};
type Task = {
  id: string;
  requestId: string;
  type: string;
  title: string;
  status: StatusId;
  ownerId: string;
  ownerName?: string;
  dueDate: string;
  version?: number;
  revisionNumber?: number;
  keyMessage?: string;
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
  target: Page;
  createdAt: string;
  read: boolean;
};
type IdeaStatus =
  | "proposed"
  | "under_review"
  | "accepted"
  | "rejected"
  | "converted"
  | "archived";
const IDEA_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  proposed: ["under_review", "rejected", "archived"],
  under_review: ["accepted", "rejected", "archived"],
  accepted: ["archived"],
  rejected: [],
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
async function fetchIdeaPage(
  offset: number,
  search = "",
  status = "",
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    take: String(IDEAS_PAGE_SIZE),
    offset: String(offset),
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
  id: string;
  title: string;
  type: "PR" | "OFFSITE";
  requestedFor: string | null;
  department: { name: string };
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
  statusHistory: { reason: string | null }[];
  tasks: Array<{
    id: string;
    title: string;
    contentType: string;
    status: string;
    ownerId: string | null;
    owner: { displayName: string } | null;
    dueAt: string | null;
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
  revisions: Array<{
    objective: string | null;
    audience: string | null;
    offsiteDetails: unknown;
  }>;
  sources: Array<{ url: string }>;
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
    taskIds: request.tasks.map((task) => task.id),
    status: request.status,
    version: request.version,
    rejectionReason: request.statusHistory[0]?.reason || undefined,
    revisionNumber: request.revisions[0]?.revisionNumber,
    objective: request.revisions[0]?.objective || undefined,
    audience: request.revisions[0]?.audience || undefined,
    startTime:
      typeof detailRecord?.startTime === "string" ? detailRecord.startTime : undefined,
    travel: typeof detailRecord?.travel === "string" ? detailRecord.travel : undefined,
    source: request.sources[0]?.url,
  };
}

function mapRequestTasks(records: ApiRequestRecord[]): Task[] {
  return records.flatMap((request) =>
    request.tasks.map((task) => ({
      id: task.id,
      requestId: request.id,
      requestStatus: request.status,
      type: task.contentType,
      title: task.title,
      status: task.status.toLowerCase() as StatusId,
      ownerId: task.ownerId || "",
      ownerName: task.owner?.displayName,
      dueDate: task.dueAt?.slice(0, 10) || "",
      version: task.version,
      revisionNumber: task.revisions[0]?.revisionNumber,
      contentBody: task.revisions[0]?.body || undefined,
      keyMessage: task.revisions[0]?.keyMessage || undefined,
      finalAssetId: task.revisions[0]?.finalAssetId,
      sourceUrls: request.sources.map((source) => source.url),
    })),
  );
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
  { id: "settings", th: "Permission Settings", en: "Permission Settings", icon: "⚙️" },
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
  pr: pages.filter(({ id }) => id !== "new-request").map(({ id }) => id),
  executive: ["home", "calendar", "notifications"],
  project_owner: [
    "home",
    "new-request",
    "my-requests",
    "calendar",
    "ideas",
    "notifications",
    "help",
  ],
  approver: ["home", "calendar", "approvals", "notifications"],
  writer: [
    "home",
    "new-request",
    "my-requests",
    "operations",
    "calendar",
    "ideas",
    "notifications",
    "help",
  ],
  designer: ["home", "my-requests", "operations", "calendar", "notifications", "help"],
  video: ["home", "my-requests", "operations", "calendar", "notifications", "help"],
  requester: [
    "home",
    "new-request",
    "my-requests",
    "calendar",
    "ideas",
    "notifications",
    "help",
  ],
};

const DISPLAY_ROLE_BY_PR_ROLE: Record<PrCenterRoleCode, Role> = {
  REQUESTER: "requester",
  PR_OPERATIONS: "pr",
  APPROVER: "approver",
  EXECUTIVE_READ_ONLY: "executive",
  SCOPED_ADMINISTRATOR: "admin",
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
    contentTypes: ["Website News", "Facebook Post", "Short Video", "PR Content"],
    channels: ["Website", "Facebook", "TikTok", "YouTube", "LinkedIn", "Internal"],
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
function taskRows(items: Task[]) {
  return items.map((task) => [
    task.type,
    task.title,
    STATUS_LABELS[task.status],
    getUser(task.ownerId)?.name ?? task.ownerName ?? "Unassigned",
  ]);
}
function requestStatus(request: Request, allTasks: Task[]): StatusId {
  return allTasks.find((task) => request.taskIds.includes(task.id))?.status ?? "draft";
}
function emptyRequestDraft(user: User): RequestDraft {
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
    travel: "RTRDA transport confirmed",
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

export function PrCenterApp({
  actor,
  onSignOut,
}: {
  actor?: {
    userId: string;
    displayName: string;
    departmentName: string;
    role: PrCenterRoleCode;
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
  const [approvalTasks, setApprovalTasks] = useState<Task[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<RequestApprovalItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [requestCursor, setRequestCursor] = useState<string | null>(null);
  const [hasMoreRequests, setHasMoreRequests] = useState(false);
  const [loadingMoreRequests, setLoadingMoreRequests] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsUnavailable, setRequestsUnavailable] = useState(false);
  const [ideaNextOffset, setIdeaNextOffset] = useState<number | null>(null);
  const [ideasOwnerId, setIdeasOwnerId] = useState<string | null>(null);
  const [loadingMoreIdeas, setLoadingMoreIdeas] = useState(false);
  const [ideaListStatus, setIdeaListStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [ideaSearch, setIdeaSearch] = useState("");
  const [ideaStatusFilter, setIdeaStatusFilter] = useState("");
  const latestIdeaFilters = useRef({ search: ideaSearch, status: ideaStatusFilter });
  const changeIdeaFilters = (search: string, status: "all" | IdeaStatus) => {
    const nextStatus = status === "all" ? "" : status.toUpperCase();
    latestIdeaFilters.current = { search, status: nextStatus };
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
  useEffect(() => {
    fetch("/api/pr-center/requests?take=100", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Request list unavailable");
        const records = (await response.json()) as ApiRequestRecord[];
        setRequestsUnavailable(false);
        const pageRecords = records.slice(0, 100);
        setHasMoreRequests(records.length > pageRecords.length);
        setRequestCursor(pageRecords.at(-1)?.id || null);
        startTransition(() =>
          setState((previous) => ({
            ...previous,
            requests: pageRecords.map(mapRequestRecord),
            tasks: mapRequestTasks(pageRecords),
          })),
        );
      })
      .catch(() => {
        setRequestsUnavailable(true);
        setNotice("Unable to load server requests");
      })
      .finally(() => setLoadingRequests(false));
  }, []);
  useEffect(() => {
    const roleGrants = actor?.roles?.length ? actor.roles : actor ? [actor.role] : [];
    if (
      !roleGrants.some((role) =>
        ["APPROVER", "PR_OPERATIONS", "SCOPED_ADMINISTRATOR"].includes(role),
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
    if (!roleGrants.includes("PR_OPERATIONS") || page !== "approvals") return;
    fetch("/api/pr-center/request-approvals", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Request approval queue unavailable");
        const requests = (await response.json()) as RequestApprovalItem[];
        setApprovalRequests(requests);
      })
      .catch(() => setNotice("Unable to load submitted request approvals"));
  }, [actor, page]);
  useEffect(() => {
    latestActorId.current = actor?.userId;
  }, [actor?.userId]);
  useEffect(() => {
    if (!actor?.userId) return;
    const controller = new AbortController();
    fetchIdeaPage(0, ideaSearch, ideaStatusFilter, controller.signal)
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
  }, [actor?.userId, ideaSearch, ideaStatusFilter]);
  useEffect(() => {
    fetch("/api/pr-center/notifications", { credentials: "same-origin" })
      .then(async (response) => {
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
        setState((previous) => ({
          ...previous,
          notifications: notifications.map((notification) => ({
            id: notification.id,
            userId: notification.userId,
            title: notification.title,
            message: notification.body,
            target: isPageEnabled(notification.target as Page)
              ? (notification.target as Page)
              : "home",
            createdAt: notification.createdAt,
            read: Boolean(notification.readAt),
          })),
        }));
      })
      .catch(() => setNotice("Unable to load notifications"));
    fetch("/api/pr-center/audit?take=100", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Audit history unavailable");
        const audit = (await response.json()) as Array<{
          id: string;
          actorId: string | null;
          entityType: string;
          entityId: string;
          action: string;
          createdAt: string;
        }>;
        setState((previous) => ({
          ...previous,
          audit: audit.map((entry) => ({
            id: entry.id,
            actorId: entry.actorId || "system",
            entity: ["request", "task", "notification"].includes(entry.entityType)
              ? (entry.entityType as AuditEntry["entity"])
              : "system",
            entityId: entry.entityId,
            action: entry.action,
            before: "",
            after: "",
            createdAt: entry.createdAt,
          })),
        }));
      })
      .catch(() => setNotice("Unable to load audit history"));
  }, []);

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
  const visibleRolePages = [...new Set(actorUiRoles.flatMap((role) => ROLE_PAGES[role]))];
  const hasUiRole = (...roles: Role[]) =>
    actorUiRoles.some((role) => roles.includes(role));
  const visiblePages = pages.filter(
    (item) => isPageEnabled(item.id) && visibleRolePages.includes(item.id),
  );
  const loadMoreRequests = async () => {
    if (!requestCursor || loadingMoreRequests || loadingRequests) return;
    setLoadingMoreRequests(true);
    try {
      const response = await fetch(
        `/api/pr-center/requests?take=100&cursor=${encodeURIComponent(requestCursor)}`,
        { credentials: "same-origin" },
      );
      if (!response.ok) throw new Error("Unable to load more requests");
      const records = (await response.json()) as ApiRequestRecord[];
      const pageRecords = records.slice(0, 100);
      setRequestCursor(pageRecords.at(-1)?.id || requestCursor);
      setHasMoreRequests(records.length > pageRecords.length);
      setState((previous) => ({
        ...previous,
        requests: [
          ...previous.requests,
          ...pageRecords
            .map(mapRequestRecord)
            .filter(
              (item) => !previous.requests.some((existing) => existing.id === item.id),
            ),
        ],
        tasks: [
          ...previous.tasks,
          ...mapRequestTasks(pageRecords).filter(
            (item) => !previous.tasks.some((existing) => existing.id === item.id),
          ),
        ],
      }));
    } catch {
      setNotice(
        state.language === "th"
          ? "โหลดคำขอเพิ่มเติมไม่สำเร็จ"
          : "Unable to load more requests",
      );
    } finally {
      setLoadingMoreRequests(false);
    }
  };
  const refreshRequests = async () => {
    if (loadingRequests || loadingMoreRequests) return;
    setLoadingRequests(true);
    try {
      const response = await fetch("/api/pr-center/requests?take=100", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to refresh requests");
      const records = (await response.json()) as ApiRequestRecord[];
      setRequestsUnavailable(false);
      const pageRecords = records.slice(0, 100);
      setRequestCursor(pageRecords.at(-1)?.id || null);
      setHasMoreRequests(records.length > pageRecords.length);
      setState((previous) => ({
        ...previous,
        requests: pageRecords.map(mapRequestRecord),
        tasks: mapRequestTasks(pageRecords),
      }));
    } catch {
      setRequestsUnavailable(true);
      setNotice(
        state.language === "th"
          ? "รีเฟรชสถานะคำขอไม่สำเร็จ"
          : "Unable to refresh request status",
      );
    } finally {
      setLoadingRequests(false);
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

  const openRequest = () => {
    setRequestEditId(null);
    setRequestDraft(emptyRequestDraft(currentUser));
    setRequestOpen(true);
  };
  const editRequest = (request: Request) => {
    setRequestEditId(request.id);
    setRequestDraft({
      ...emptyRequestDraft(currentUser),
      type: request.type,
      title: request.title,
      requestedDate: request.requestedDate,
      source: request.source || "",
      objective: request.objective || "",
      audience: request.audience || "",
      startTime: request.startTime || "",
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
        target: PHASE_1_PAGES.has(notification.target as Page)
          ? (notification.target as Page)
          : "home",
        createdAt: notification.createdAt,
        read: Boolean(notification.readAt),
      })),
    }));
  };
  const createRequest = async (draft: RequestDraft, editId = requestEditId) => {
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
                ? { startTime: draft.startTime, travel: draft.travel }
                : undefined,
            requestedFor: draft.requestedDate || undefined,
            sourceUrls: draft.source ? [draft.source] : [],
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
          version: number;
        }>;
      };
      const mappedRequest: Request = {
        id: updated.id,
        title: updated.title,
        type: updated.type.toLowerCase() as RequestType,
        requesterId: updated.requesterId,
        department: updated.department?.name || currentUser.department,
        requestedDate: updated.requestedFor?.slice(0, 10) || "",
        taskIds: updated.tasks.map((task) => task.id),
        source: updated.sources[0]?.url,
        status: updated.status,
        version: updated.version,
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
            travel: typeof fields.travel === "string" ? fields.travel : undefined,
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
            version: task.version,
            revisionNumber: undefined,
          })),
          ...previous.tasks.filter(
            (task) => !updated.tasks.some((nextTask) => nextTask.id === task.id),
          ),
        ],
      }));
      setRequestEditId(null);
      setRequestOpen(false);
      await refreshNotifications().catch(() => undefined);
      announce(
        state.language === "th"
          ? editId
            ? "บันทึกการแก้ไขคำขอแล้ว"
            : "บันทึกคำขอเป็นฉบับร่างแล้ว"
          : editId
            ? "Request changes saved"
            : "Request saved as draft",
      );
      setPage("my-requests");
    } catch (error) {
      announce(error instanceof Error ? error.message : "Request could not be saved");
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
        body: JSON.stringify({ decision, ...(comment ? { comment } : {}) }),
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
  ) => {
    const request = approvalRequests.find((item) => item.id === requestId);
    if (!request) return;
    const reason =
      decision === "REJECTED"
        ? window
            .prompt(
              state.language === "th"
                ? "ระบุเหตุผลในการปฏิเสธคำขอ"
                : "Enter a reason for rejecting this request",
            )
            ?.trim() || ""
        : "";
    if (decision === "REJECTED" && !reason) return;
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
      const updated = (await response.json()) as {
        status: Request["status"];
        version: number;
      };
      setApprovalRequests((previous) => previous.filter((item) => item.id !== requestId));
      setState((previous) => ({
        ...previous,
        requests: previous.requests.map((item) =>
          item.id === requestId
            ? { ...item, status: updated.status, version: updated.version }
            : item,
        ),
        tasks: previous.tasks.map((task) =>
          task.requestId === requestId
            ? { ...task, requestStatus: updated.status }
            : task,
        ),
      }));
      if (decision === "APPROVED") await refreshRequests();
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
    } catch (error) {
      announce(error instanceof Error ? error.message : "Request decision failed");
    }
  };
  const scheduleTask = async (
    taskId: string,
    channel: string,
    scheduledFor: string,
  ): Promise<boolean> => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return false;
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
          scheduledFor,
          idempotencyKey: `schedule:${taskId}:${channel}:${scheduledFor}`,
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
  const assignTask = async (taskId: string, ownerId: string, dueDate: string) => {
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
        body: JSON.stringify({ ownerId: ownerId || null, dueAt: dueDate || null }),
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
  const updateIdeaStatus = async (id: string, status: IdeaStatus) => {
    const idea = state.ideas.find((item) => item.id === id);
    if (!idea?.version) return;
    const requiresReason = status === "accepted" || status === "rejected";
    const reason = requiresReason
      ? window
          .prompt(
            status === "rejected"
              ? state.language === "th"
                ? "ระบุเหตุผลในการปฏิเสธแนวคิด ผู้เสนอจะเห็นเหตุผลนี้"
                : "Enter a rejection reason. The proposer will be able to see it."
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
    const requestedFilters = { search: ideaSearch, status: ideaStatusFilter };
    try {
      const page = await fetchIdeaPage(
        0,
        requestedFilters.search,
        requestedFilters.status,
      );
      if (
        latestActorId.current !== actor.userId ||
        latestIdeaFilters.current.search !== requestedFilters.search ||
        latestIdeaFilters.current.status !== requestedFilters.status
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
        latestIdeaFilters.current.status !== requestedFilters.status
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
    const requestedFilters = { search: ideaSearch, status: ideaStatusFilter };
    try {
      const page = await fetchIdeaPage(
        ideaNextOffset,
        requestedFilters.search,
        requestedFilters.status,
      );
      if (
        latestActorId.current !== actor.userId ||
        latestIdeaFilters.current.search !== requestedFilters.search ||
        latestIdeaFilters.current.status !== requestedFilters.status
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
        latestIdeaFilters.current.status === requestedFilters.status
      )
        setNotice("Unable to load more Content Ideas");
    } finally {
      setLoadingMoreIdeas(false);
    }
  };
  const updateMasterData = (masterData: MasterData) =>
    updateState((previous) =>
      addAudit(
        { ...previous, masterData },
        "system",
        "master-data",
        "master_data_updated",
        "",
        "Master data updated",
      ),
    );
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
              onClick={() => go(item.id)}
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
              <h2>RTRDA PR Center</h2>
              <p>Corporate communications workspace</p>
            </div>
          </div>
          <label className={styles.search}>
            <span>Search</span>
            <input placeholder={t.search} />
          </label>
          <div className={styles.topActions}>
            {hasUiRole("requester", "admin") && (
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
              aria-label="Current PR Center role"
            >
              <span>{currentUser.name.slice(0, 2)}</span>
              <i>{currentUser.role}</i>
            </button>
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
              canCreateRequest={hasUiRole("requester", "admin")}
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
          {page === "new-request" && hasUiRole("requester", "admin") && (
            <NewRequest t={t} onOpenRequest={openRequest} />
          )}
          {page === "my-requests" && (
            <Requests
              t={t}
              onOpenRequest={openRequest}
              onEditRequest={editRequest}
              onSubmitRequest={submitRequest}
              onWithdrawRequest={withdrawRequest}
              mode="mine"
              canCreate={hasUiRole("requester", "admin")}
              requests={state.requests}
              tasks={state.tasks}
              currentUserId={currentUser.id}
              hasMore={hasMoreRequests}
              onRefresh={refreshRequests}
              loadingMore={loadingMoreRequests}
              loading={loadingRequests}
              onLoadMore={loadMoreRequests}
            />
          )}
          {page === "requests" && (
            <Requests
              t={t}
              onOpenRequest={openRequest}
              onEditRequest={editRequest}
              onSubmitRequest={submitRequest}
              onWithdrawRequest={withdrawRequest}
              mode="all"
              canCreate={false}
              requests={state.requests}
              tasks={state.tasks}
              currentUserId={currentUser.id}
              hasMore={hasMoreRequests}
              onRefresh={refreshRequests}
              loadingMore={loadingMoreRequests}
              loading={loadingRequests}
              onLoadMore={loadMoreRequests}
            />
          )}
          {page === "operations" && (
            <Operations
              tasks={state.tasks}
              language={state.language}
              onTransition={transitionTask}
              onAssign={assignTask}
              onSchedule={scheduleTask}
              onPublish={publishTask}
              onCreateRevision={createTaskRevision}
              canManageTasks={hasUiRole("pr", "admin")}
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
              tasks={approvalTasks}
              requests={approvalRequests}
              canDecideRequests={hasUiRole("pr")}
              canDecideTasks={hasUiRole("approver", "pr", "admin")}
              onDecision={recordApproval}
              onRequestDecision={recordRequestDecision}
            />
          )}
          {page === "library" && <Library language={state.language} />}
          {page === "ideas" && (
            <Ideas
              ideas={ideasOwnerId === actor?.userId ? state.ideas : []}
              currentUser={currentUser}
              canReview={hasUiRole("pr", "admin")}
              onCreate={createIdea}
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
              status={messageHouseStatus}
              history={messageHouseHistory}
              historyStatus={messageHouseHistoryStatus}
              onRefresh={loadMessageHouse}
              language={state.language}
            />
          )}
          {page === "notifications" && (
            <Notifications
              onNavigate={go}
              notifications={userNotifications}
              onRead={readNotifications}
              language={state.language}
            />
          )}
          {page === "history" && (
            <History audit={state.audit} language={state.language} />
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
          isEditing={requestEditId !== null}
          draft={requestDraft}
          onChange={setRequestDraft}
          onClose={() => {
            setRequestOpen(false);
            setRequestEditId(null);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            createRequest(requestDraft, requestEditId);
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
        <article className={styles.card}>
          <header>
            <div>
              <p className={styles.eyebrow}>{t.upcoming}</p>
              <h2>{currentMonth}</h2>
            </div>
            <button type="button" onClick={() => onNavigate("calendar")}>
              {thai ? "เปิดปฏิทิน" : "Open calendar"}
            </button>
          </header>
          <p className={styles.dashboardNote}>
            {thai
              ? "เปิดปฏิทินเพื่อดูรายการกำหนดการและสถานะที่โหลดจากระบบ ไม่มีการแสดงรายการตัวอย่าง"
              : "Open the calendar to view schedules and statuses loaded from the system. No sample entries are shown."}
          </p>
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
        <article className={styles.card}>
          <header>
            <div>
              <p className={styles.eyebrow}>{thai ? "ข้อมูลวิเคราะห์" : "ANALYTICS"}</p>
              <h2>{thai ? "ผลการเข้าถึงเนื้อหา" : "Content performance"}</h2>
            </div>
          </header>
          <p className={styles.dashboardNote}>
            {thai
              ? "ยังไม่มีแหล่งข้อมูล analytics จริงที่ยืนยันแล้ว จึงไม่แสดงสัดส่วนช่องทางหรือค่าประมาณ Reach/Engagement"
              : "No verified analytics source is connected. Channel shares and estimated Reach/Engagement are not shown."}
          </p>
        </article>
      </section>
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
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={styles.pageHeading}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
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
}: {
  t: (typeof copy)[Language];
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
}) {
  const title = mode === "mine" ? "My Requests" : "All Requests";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | StatusId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleRequests = (
    mode === "mine"
      ? requestItems.filter((request) => request.requesterId === currentUserId)
      : requestItems
  ).filter(
    (request) =>
      (status === "all" || requestStatus(request, taskItems) === status) &&
      `${request.id} ${request.title} ${request.department}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.search}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "all" | StatusId)}
        >
          <option value="all">All status</option>
          {Object.entries(STATUS_LABELS).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setQuery("");
            setStatus("all");
          }}
        >
          Clear
        </button>
      </section>
      <article className={styles.card}>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Project / activity</th>
                <th>Status</th>
                <th>Requested date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((request) => (
                <tr key={request.id}>
                  <td>{request.id}</td>
                  <td>{request.title}</td>
                  <td>
                    <Status>
                      {request.status === "DRAFT"
                        ? "Draft"
                        : request.status === "SUBMITTED"
                          ? "Pending intake approval"
                          : request.status === "APPROVED"
                            ? "Approved · PR assignment"
                            : request.status === "REJECTED"
                              ? "Rejected"
                              : request.status ||
                                STATUS_LABELS[requestStatus(request, taskItems)]}
                    </Status>
                  </td>
                  <td>{request.requestedDate}</td>
                  <td>
                    <button onClick={() => setSelectedId(request.id)}>Details</button>
                    {canEditOwnRequest(request, currentUserId) && (
                      <>
                        <button onClick={() => onEditRequest(request)}>Edit</button>
                        <button onClick={() => onWithdrawRequest(request)}>
                          Withdraw
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && visibleRequests.length === 0 && <p>Loading requests…</p>}
        {!loading && visibleRequests.length === 0 && <p>No requests found.</p>}
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
            {selected.status === "REJECTED" && selected.rejectionReason && (
              <p>
                <strong>{t.rejectionReason}:</strong> {selected.rejectionReason}
              </p>
            )}
            <p>{selected.objective || "No communication objective provided."}</p>
            <p>
              {selected.source
                ? `Source: ${selected.source}`
                : "No source link provided."}
            </p>
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
                <button onClick={() => onEditRequest(selected)}>Edit request</button>
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
  language,
  onTransition,
  onAssign,
  onSchedule,
  onPublish,
  onCreateRevision,
  canManageTasks,
  onFinalAssetAssigned,
  canViewPublishing,
}: {
  tasks: Task[];
  language: Language;
  onTransition: (taskId: string, status: StatusId) => void;
  onAssign: (taskId: string, ownerId: string, dueDate: string) => Promise<void>;
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
  onFinalAssetAssigned: (taskId: string, fileId: string) => void;
  canViewPublishing: boolean;
}) {
  const [view, setView] = useState<"board" | "table" | "publishing">("board");
  const [status, setStatus] = useState<"all" | StatusId>("all");
  const [ownerId, setOwnerId] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
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
    if (schedules[0])
      setEvidenceChannel((previous) =>
        schedules.some((schedule) => schedule.channel === previous)
          ? previous
          : schedules[0].channel,
      );
  };
  useEffect(() => {
    fetch("/api/pr-center/users/assignable", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.ok) setAssignableUsers(await response.json());
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!selectedId) return;
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
        setScheduleChoices(schedules);
        if (schedules[0])
          setEvidenceChannel((previous) =>
            schedules.some((schedule) => schedule.channel === previous)
              ? previous
              : schedules[0].channel,
          );
      })
      .catch(() => setScheduleChoices([]));
  }, [selectedId]);
  const visibleTasks = taskItems.filter(
    (task) =>
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
  const selected = taskItems.find((task) => task.id === selectedId);
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
                  <article key={`${column}-${task.id}`}>
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
          <h2>Table view</h2>
          <Table
            headers={["Type", "Content", "Status", "Owner"]}
            rows={taskRows(visibleTasks)}
          />
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
          <label>
            Due date{" "}
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
          <button onClick={() => onAssign(selected.id, assigneeId, dueDate)}>
            Save assignment
          </button>
          {STATUS_TRANSITIONS[selected.status].filter(
            (next) => next !== "scheduled" && next !== "published",
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
          {(selected.status === "approved" || selected.status === "scheduled") && (
            <>
              <label>
                Channel{" "}
                <input
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                  required
                />
              </label>
              <label>
                Schedule time{" "}
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
          {(selected.status === "scheduled" || selected.status === "published") &&
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
          <AttachmentPanel
            taskId={selected.id}
            taskVersion={selected.version ?? 0}
            revisionNumber={selected.revisionNumber}
            finalAssetId={selected.finalAssetId}
            onFinalAssetAssigned={(fileId) => onFinalAssetAssigned(selected.id, fileId)}
          />
        </article>
      )}
    </>
  );
}
function PublishingOperations({ language }: { language: Language }) {
  const [range] = useState(() => {
    const from = new Date();
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - 14);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 44);
    return { from: from.toISOString(), to: to.toISOString() };
  });
  const [status, setStatus] = useState<"ALL" | "SCHEDULED" | "PUBLISHED">("ALL");
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{
    key: number;
    entries: CalendarEntry[];
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/pr-center/calendar?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      { credentials: "same-origin", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Publishing records unavailable");
        return parseCalendarEntries(await response.json());
      })
      .then((entries) => {
        if (!controller.signal.aborted)
          setResult({ key: reload, entries, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ key: reload, entries: [], failed: true });
      });
    return () => controller.abort();
  }, [range.from, range.to, reload]);

  const current = result?.key === reload ? result : null;
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
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  });
  const [view, setView] = useState<"month" | "week">("month");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CalendarEntry["status"]>(
    "ALL",
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [result, setResult] = useState<{
    key: string;
    entries: CalendarEntry[];
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
  const from = rangeStart.toISOString();
  const to = rangeEnd.toISOString();
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
    return () => controller.abort();
  }, [from, rangeKey, to]);

  const currentResult = result?.key === rangeKey ? result : null;
  const entries = currentResult?.entries ?? [];
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
      timeZone: "UTC",
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
          </div>
        }
      />
      <p role="note">
        {language === "th"
          ? "เวลาแสดงเป็น UTC จนกว่าจะกำหนดเขตเวลาขององค์กร · วันฉบับร่างคือกำหนดส่ง ไม่ใช่กำหนดเผยแพร่"
          : "Times are shown in UTC until the organization timezone is approved · Draft dates are due dates, not publication commitments."}
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
              (entry) => new Date(entry.date).toISOString().slice(0, 10) === dayKey,
            );
            return (
              <div
                key={dayKey}
                className={
                  day.getUTCMonth() !== anchorDate.getUTCMonth() ? styles.mutedDay : ""
                }
              >
                <b>
                  {day.toLocaleDateString(locale, { day: "numeric", timeZone: "UTC" })}
                </b>
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
    </>
  );
}
function Approvals({
  tasks: taskItems,
  requests,
  canDecideRequests,
  canDecideTasks,
  onDecision,
  onRequestDecision,
}: {
  tasks: Task[];
  requests: RequestApprovalItem[];
  canDecideRequests: boolean;
  canDecideTasks: boolean;
  onDecision: (
    taskId: string,
    decision: "APPROVED" | "REVISION_REQUIRED" | "REJECTED",
  ) => void;
  onRequestDecision: (requestId: string, decision: "APPROVED" | "REJECTED") => void;
}) {
  return (
    <>
      <SectionHeading eyebrow="REVIEW AND APPROVAL" title="Approval Queue" />
      <h2>Submitted Requests · Intake Decision</h2>
      <section className={styles.list}>
        {requests.map((request) => (
          <article key={request.id} className={styles.listItem}>
            <div>
              <p>
                {request.requestNumber} · {request.department.name}
              </p>
              <h2>{request.title}</h2>
              <span>Submitted by {request.requester.displayName}</span>
              <p>
                Type: {request.type} · Requested date:{" "}
                {request.requestedFor?.slice(0, 10) || "—"}
              </p>
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
            </div>
            <div>
              <Status>Awaiting intake approval</Status>
              {canDecideRequests ? (
                <>
                  <button onClick={() => onRequestDecision(request.id, "REJECTED")}>
                    Reject
                  </button>
                  <button
                    className={styles.primary}
                    onClick={() => onRequestDecision(request.id, "APPROVED")}
                  >
                    Approve request
                  </button>
                </>
              ) : (
                <span>View only for your role</span>
              )}
            </div>
          </article>
        ))}
        {requests.length === 0 && <p>No submitted requests awaiting intake decision.</p>}
      </section>
      <h2>Task Stage Approvals</h2>
      <section className={styles.list}>
        {taskItems.map((task) => (
          <article key={task.id} className={styles.listItem}>
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
              <Status>Awaiting approval</Status>
              {canDecideTasks ? (
                <>
                  <button onClick={() => onDecision(task.id, "REVISION_REQUIRED")}>
                    Request revision
                  </button>
                  <button
                    className={styles.primary}
                    onClick={() => onDecision(task.id, "APPROVED")}
                  >
                    Approve
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

function Ideas({
  ideas,
  currentUser,
  canReview,
  onCreate,
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
  canReview: boolean;
  onCreate: (input: CreateContentIdeaInput) => Promise<boolean>;
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
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [audience, setAudience] = useState("");
  const [pillar, setPillar] = useState("");
  const [channel, setChannel] = useState("");
  const [priority, setPriority] = useState("");
  const [campaign, setCampaign] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [saving, setSaving] = useState(false);
  const visible = ideas.filter(
    (idea) =>
      (status === "all" || idea.status === status) &&
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
  const ideaStatusLabel = (value: IdeaStatus) =>
    language === "th" && value === "rejected" ? "ปฏิเสธ" : value.replace("_", " ");
  return (
    <>
      <SectionHeading
        eyebrow="COLLABORATION"
        title="Content Ideas"
        action={
          <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <button
              className={styles.secondaryButton}
              onClick={() => void onRefresh()}
              disabled={listStatus === "loading"}
            >
              {language === "th" ? "รีเฟรช" : "Refresh"}
            </button>
            <button className={styles.primary} onClick={() => setOpen(!open)}>
              + Propose idea
            </button>
          </div>
        }
      />
      {open && (
        <form
          className={styles.card}
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            try {
              const saved = await submitIdeaForm(
                () =>
                  onCreate({
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
                  }),
                () => {
                  setTitle("");
                  setSummary("");
                  setAudience("");
                  setPillar("");
                  setChannel("");
                  setPriority("");
                  setCampaign("");
                  setEvidenceText("");
                  setOpen(false);
                },
              );
              if (!saved) return;
              await onRefresh();
            } finally {
              setSaving(false);
            }
          }}
        >
          <h2>{language === "th" ? "เสนอแนวคิดเนื้อหา" : "Propose an idea"}</h2>
          <label>
            {language === "th" ? "ชื่อแนวคิด" : "Idea title"}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={300}
              required
            />
          </label>
          <label>
            {language === "th" ? "เหตุผลและแนวทาง" : "Rationale and angle"}
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={5000}
              required
            />
          </label>
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
            <input
              value={pillar}
              onChange={(event) => setPillar(event.target.value)}
              maxLength={100}
            />
          </label>
          <label>
            {language === "th" ? "ช่องทาง" : "Channel"}
            <input
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              maxLength={100}
            />
          </label>
          <label>
            {language === "th" ? "ลำดับความสำคัญ" : "Priority"}
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
          <label>
            {language === "th"
              ? "ลิงก์หลักฐาน (HTTPS หนึ่งลิงก์ต่อบรรทัด)"
              : "Evidence links (one HTTPS URL per line)"}
            <textarea
              value={evidenceText}
              onChange={(event) => setEvidenceText(event.target.value)}
              placeholder="https://…"
            />
          </label>
          <button className={styles.primary} type="submit" disabled={saving}>
            {saving
              ? language === "th"
                ? "กำลังบันทึก…"
                : "Saving…"
              : language === "th"
                ? "บันทึกแนวคิด"
                : "Save idea"}
          </button>
        </form>
      )}
      <section className={styles.filterBar}>
        <input
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            onFilters(value, status);
          }}
          maxLength={100}
          placeholder={language === "th" ? "ค้นหาแนวคิด" : "Search ideas"}
        />
        <select
          value={status}
          onChange={(event) => {
            const value = event.target.value as "all" | IdeaStatus;
            setStatus(value);
            onFilters(query, value);
          }}
        >
          <option value="all">All statuses</option>
          {[
            "proposed",
            "under_review",
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
      </section>
      <p>
        {language === "th"
          ? "ระบบค้นหาและกรองตามสิทธิ์ของคุณ กดโหลดเพิ่มเพื่อดูผลลัพธ์หน้าถัดไป"
          : "Search and status filters are applied within your authorized scope; load more for the next page."}
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
      <section className={styles.ideaGrid}>
        {visible.map((idea) => (
          <article key={idea.id} className={styles.card}>
            <p className={styles.eyebrow}>
              {idea.id} · {ideaStatusLabel(idea.status)}
            </p>
            <h2>{idea.title}</h2>
            <p>{idea.summary}</p>
            {(idea.status === "rejected" ||
              idea.status === "accepted" ||
              idea.status === "converted" ||
              idea.status === "archived") &&
              idea.decisionReason && (
                <p role="note">
                  <strong>
                    {language === "th" ? "เหตุผลประกอบการตัดสินใจ" : "Decision rationale"}
                    :
                  </strong>{" "}
                  {idea.decisionReason}
                </p>
              )}
            {[
              idea.audience,
              idea.pillar,
              idea.channel,
              idea.priority,
              idea.campaign,
            ].some(Boolean) && (
              <p>
                {[
                  idea.audience &&
                    `${language === "th" ? "กลุ่มเป้าหมาย" : "Audience"}: ${idea.audience}`,
                  idea.pillar &&
                    `${language === "th" ? "เสาหลักเนื้อหา" : "Pillar"}: ${idea.pillar}`,
                  idea.channel &&
                    `${language === "th" ? "ช่องทาง" : "Channel"}: ${idea.channel}`,
                  idea.priority &&
                    `${language === "th" ? "ลำดับความสำคัญ" : "Priority"}: ${idea.priority}`,
                  idea.campaign &&
                    `${language === "th" ? "แคมเปญ" : "Campaign"}: ${idea.campaign}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {!!idea.evidenceUrls?.length && (
              <ul>
                {idea.evidenceUrls.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <footer>
              <span>{getUser(idea.authorId)?.name ?? "Unknown"}</span>
              {canReview && (
                <select
                  value=""
                  onChange={async (event) => {
                    const nextStatus = event.target.value as IdeaStatus;
                    if (!nextStatus) return;
                    await onStatus(idea.id, nextStatus);
                    await onRefresh();
                  }}
                >
                  <option value="">{ideaStatusLabel(idea.status)}</option>
                  {IDEA_TRANSITIONS[idea.status].map((value) => (
                    <option key={value} value={value}>
                      {ideaStatusLabel(value as IdeaStatus)}
                    </option>
                  ))}
                </select>
              )}
              {idea.status === "accepted" && canReview && (
                <button
                  className={styles.primary}
                  onClick={async () => {
                    await onConvert(idea.id);
                    await onRefresh();
                  }}
                >
                  {language === "th" ? "แปลงเป็นคำขอ" : "Convert to request"}
                </button>
              )}
              {idea.requestId && (
                <span>
                  {language === "th" ? "คำขอ" : "Request"}: {idea.requestId}
                </span>
              )}
            </footer>
            {(canReview || idea.authorId === currentUser.id) && (
              <IdeaComments ideaId={idea.id} language={language} />
            )}
          </article>
        ))}
      </section>
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
function MessageHouse({
  data,
  status,
  history,
  historyStatus,
  onRefresh,
  language,
}: {
  data: MessageHouseData;
  status: "loading" | "empty" | "loaded" | "error";
  history: CurrentMessageHouse[];
  historyStatus: "loading" | "loaded" | "error";
  onRefresh: () => void;
  language: Language;
}) {
  const thai = language === "th";
  return (
    <>
      <SectionHeading
        eyebrow={thai ? "กลยุทธ์การสื่อสาร" : "COMMUNICATION STRATEGY"}
        title="Message House"
        action={
          <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <span>{thai ? "อ่านอย่างเดียว" : "Read only"}</span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={status === "loading" || historyStatus === "loading"}
            >
              {thai ? "รีเฟรช" : "Refresh"}
            </button>
          </div>
        }
      />
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
  onNavigate: (page: Page) => void;
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
function History({ audit, language }: { audit: AuditEntry[]; language: Language }) {
  return (
    <>
      <SectionHeading
        eyebrow="AUDIT"
        title={language === "th" ? "ประวัติกิจกรรม" : "Activity History"}
      />
      <article className={styles.card}>
        <Table
          headers={["Time", "Actor", "Action", "Entity"]}
          rows={audit
            .slice()
            .reverse()
            .map((entry) => [
              new Date(entry.createdAt).toLocaleString(
                language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
              ),
              getUser(entry.actorId)?.name ?? entry.actorId,
              entry.action,
              entry.entityId,
            ])}
        />
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
    roleGrants?: Array<{ role: string; departmentId: string | null }>;
  };
  language: Language;
}) {
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
  const [grantRole, setGrantRole] = useState<string>("REQUESTER");
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
  const [revokeConfirmation, setRevokeConfirmation] = useState("");
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);
  const [accessReason, setAccessReason] = useState("");
  const isOrganizationAdmin =
    actor.roleGrants?.some(
      (grant) => grant.role === "SCOPED_ADMINISTRATOR" && grant.departmentId === null,
    ) ?? false;
  const activeOrganizationAdmins = users.filter(
    (user) =>
      user.active &&
      user.roles.some(
        (grant) => grant.role === "SCOPED_ADMINISTRATOR" && grant.departmentId === null,
      ),
  ).length;
  const isLastOrganizationAdmin = (user: (typeof users)[number]) =>
    user.active &&
    activeOrganizationAdmins <= 1 &&
    user.roles.some(
      (grant) => grant.role === "SCOPED_ADMINISTRATOR" && grant.departmentId === null,
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
          role: grantRole,
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
    if (revokeConfirmation.trim() !== "ตกลง")
      return setError(
        language === "th" ? 'กรุณาพิมพ์ "ตกลง" เพื่อยืนยัน' : 'Type "ตกลง" to confirm',
      );

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
      setRevokeConfirmation("");
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
                  <button
                    onClick={() => handleToggleActive(user.id)}
                    disabled={
                      user.id === actor.userId ||
                      isLastOrganizationAdmin(user) ||
                      !accessReason.trim()
                    }
                    title={
                      isLastOrganizationAdmin(user)
                        ? "At least one active organization-wide administrator must remain"
                        : undefined
                    }
                    style={{ fontSize: 12, color: user.active ? "#dc2626" : "#16a34a" }}
                  >
                    {user.active ? "Deactivate" : "Activate"}
                  </button>
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
                    <button
                      type="button"
                      aria-label={`${language === "th" ? "ถอน role" : "Revoke role"}: ${r.role}`}
                      onClick={() => {
                        setError(null);
                        setGrantTarget(null);
                        setRevokeReason("");
                        setRevokeConfirmation("");
                        setRevokeTarget({
                          userId: user.id,
                          displayName: user.displayName,
                          roleId: r.id,
                          role: r.role,
                          departmentId: r.departmentId,
                        });
                      }}
                      disabled={
                        user.active &&
                        r.role === "SCOPED_ADMINISTRATOR" &&
                        r.departmentId === null &&
                        activeOrganizationAdmins <= 1
                      }
                      title={
                        user.active &&
                        r.role === "SCOPED_ADMINISTRATOR" &&
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
                    <select
                      aria-label="Role"
                      value={grantRole}
                      onChange={(event) => setGrantRole(event.target.value)}
                    >
                      <option value="REQUESTER">REQUESTER</option>
                      <option value="PR_OPERATIONS">PR_OPERATIONS</option>
                      <option value="APPROVER">APPROVER</option>
                      <option value="EXECUTIVE_READ_ONLY">EXECUTIVE_READ_ONLY</option>
                      <option value="SCOPED_ADMINISTRATOR">SCOPED_ADMINISTRATOR</option>
                    </select>
                  </label>
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
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span>
                      {language === "th"
                        ? 'พิมพ์ "ตกลง" เพื่อยืนยันการถอนสิทธิ์'
                        : 'Type "ตกลง" to confirm this role revocation'}
                    </span>
                    <input
                      value={revokeConfirmation}
                      onChange={(event) => setRevokeConfirmation(event.target.value)}
                      autoComplete="off"
                    />
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
                      disabled={
                        revokeSubmitting ||
                        !revokeReason.trim() ||
                        revokeConfirmation.trim() !== "ตกลง"
                      }
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
  onSave: (values: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values.join("\n"));
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
            onClick={() => {
              onSave(
                draft
                  .split("\n")
                  .map((value) => value.trim())
                  .filter(Boolean),
              );
              setEditing(false);
            }}
          >
            Save
          </button>
        </>
      ) : (
        <p>{values.join(" · ")}</p>
      )}
    </article>
  );
}
function Settings({ language }: { language: Language }) {
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
    fetch("/api/pr-center/admin/access-audit?take=200", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load access audit");
        if (!cancelled) setAuditEvents(await r.json());
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
  }, []);

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
      {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
      {loading && <p>Loading audit events…</p>}
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
  onSave: (data: MasterData) => void;
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
          label={language === "th" ? "หน่วยงาน" : "Departments"}
          values={data.departments}
          onSave={(departments) => onSave({ ...data, departments })}
        />
      </section>
      <section className={styles.filterBar}>
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          {language === "th"
            ? "การนำเข้าและการแก้ไขข้อมูลตัวอย่างยังไม่บันทึกไปยังเซิร์ฟเวอร์"
            : "Import and demo-data edits are local only and are not saved to the server."}
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
function RequestModal({
  language,
  isEditing,
  draft,
  onChange,
  onClose,
  onSubmit,
}: {
  language: Language;
  isEditing: boolean;
  draft: RequestDraft;
  onChange: (draft: RequestDraft) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const thai = language === "th";
  return (
    <div className={styles.modalBackdrop} role="presentation">
      <form
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-title"
        onSubmit={onSubmit}
      >
        <header>
          <div>
            <p className={styles.eyebrow}>
              {isEditing ? "EDIT WORK REQUEST" : "NEW WORK REQUEST"}
            </p>
            <h2 id="request-title">
              {isEditing
                ? thai
                  ? "แก้ไขคำขอ"
                  : "Edit work request"
                : thai
                  ? "ส่งคำของาน"
                  : "Submit work request"}
            </h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className={styles.typePicker}>
          <button
            type="button"
            className={draft.type === "pr" ? styles.selectedType : ""}
            onClick={() => onChange({ ...draft, type: "pr" })}
          >
            <b>PR</b>
            <span>
              {thai ? "ผลิตและเผยแพร่เนื้อหา" : "Content production and publication"}
            </span>
          </button>
          <button
            type="button"
            className={draft.type === "offsite" ? styles.selectedType : ""}
            onClick={() => onChange({ ...draft, type: "offsite" })}
          >
            <b>OS</b>
            <span>{thai ? "ลงพื้นที่ / ปฏิบัติงานนอกสถานที่" : "Off-site support"}</span>
          </button>
        </div>
        <div className={styles.formGrid}>
          <label>
            {thai ? "ชื่อโครงการ / กิจกรรม" : "Project / activity"}
            <input
              value={draft.title}
              minLength={3}
              maxLength={300}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              required
            />
          </label>
          <label>
            {thai ? "หน่วยงาน" : "Department"}
            <input
              value={draft.department}
              onChange={(event) => onChange({ ...draft, department: event.target.value })}
              required
            />
          </label>
          <label>
            {thai ? "เจ้าของโครงการ" : "Project owner"}
            <input
              value={draft.owner}
              onChange={(event) => onChange({ ...draft, owner: event.target.value })}
              required
            />
          </label>
          <label>
            {draft.type === "pr"
              ? thai
                ? "วันที่ต้องการเผยแพร่"
                : "Requested publish date"
              : thai
                ? "วันที่ลงพื้นที่"
                : "Off-site date"}
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
              ? "ลิงก์ข้อมูลต้นทาง / โฟลเดอร์โครงการ"
              : "Source links / project folder"}
            <input
              type="url"
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
                {thai ? "กลุ่มเป้าหมาย" : "Target audience"}
                <textarea
                  value={draft.audience}
                  onChange={(event) =>
                    onChange({ ...draft, audience: event.target.value })
                  }
                  required
                />
              </label>
            </>
          ) : (
            <>
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
                {thai ? "การเดินทาง" : "Travel arrangement"}
                <select
                  value={draft.travel}
                  onChange={(event) => onChange({ ...draft, travel: event.target.value })}
                >
                  <option value="RTRDA transport confirmed">
                    {thai ? "จองรถของ สทร. สำเร็จแล้ว" : "RTRDA transport confirmed"}
                  </option>
                  <option value="Requester transport">
                    {thai ? "เดินทางเอง" : "Requester transport"}
                  </option>
                </select>
              </label>
            </>
          )}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className={styles.primary} type="submit">
            {isEditing
              ? thai
                ? "บันทึกการแก้ไข"
                : "Save changes"
              : thai
                ? "บันทึกคำขอ"
                : "Save request"}
          </button>
        </footer>
      </form>
    </div>
  );
}
