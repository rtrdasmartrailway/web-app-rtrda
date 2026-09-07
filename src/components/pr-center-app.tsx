"use client";

import { startTransition, useEffect, useState } from "react";
import Image from "next/image";
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
  dueDate: string;
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
type IdeaStatus = "proposed" | "under_review" | "accepted" | "converted" | "archived";
const IDEA_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  proposed: ["under_review", "archived"],
  under_review: ["accepted", "archived"],
  accepted: ["archived"],
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
  requestId?: string;
};
type MessageHouseData = {
  vision: string;
  positioning: string;
  pillars: string[];
  foundation: string;
  pillarByTask: Record<string, string>;
};
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

const copy = {
  th: {
    greeting: "สวัสดี, ทีมสื่อสารองค์กร",
    subheading: "ภาพรวมงานประชาสัมพันธ์และการสื่อสารของ สทร.",
    newRequest: "ส่งคำขอใหม่",
    search: "ค้นหางาน คำขอ หรือเนื้อหา",
    prototype: "Prototype UI only · ข้อมูลในหน้านี้เป็นข้อมูลจำลอง",
    published: "เผยแพร่แล้ว",
    reach: "จำนวนการเข้าถึง",
    engagement: "การมีส่วนร่วม",
    pending: "รออนุมัติ",
    upcoming: "กำหนดเผยแพร่เร็ว ๆ นี้",
    workflow: "สถานะงาน",
    recentRequests: "คำขอล่าสุด",
    viewAll: "ดูทั้งหมด",
    role: "บทบาทตัวอย่าง",
  },
  en: {
    greeting: "Welcome, Communications Team",
    subheading: "RTRDA public relations and communications overview.",
    newRequest: "New request",
    search: "Search work, requests, or content",
    prototype: "Prototype UI only · all data on this page is simulated",
    published: "Published",
    reach: "Total reach",
    engagement: "Engagement",
    pending: "Awaiting approval",
    upcoming: "Upcoming publications",
    workflow: "Workflow health",
    recentRequests: "Recent requests",
    viewAll: "View all",
    role: "Demo role",
  },
};

const STORAGE_KEY = "rtrda-pr-center-state-v1";

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
const STATUS_LABELS_TH: Record<StatusId, string> = {
  draft: "ฉบับร่าง",
  waiting_for_information: "รอข้อมูลเพิ่มเติม",
  communication_planning: "วางแผนการสื่อสาร",
  in_production: "กำลังผลิต",
  source_fact_check: "ตรวจสอบข้อมูลต้นทาง",
  technical_review: "ตรวจสอบด้านเทคนิค",
  pr_editorial_review: "ตรวจทานโดย PR",
  management_approval: "รออนุมัติ",
  revision_required: "ขอแก้ไข",
  approved: "อนุมัติแล้ว",
  scheduled: "กำหนดเผยแพร่แล้ว",
  published: "เผยแพร่แล้ว",
  closed: "ปิดงาน",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};
function statusLabel(status: StatusId, language: Language) {
  return language === "th" ? STATUS_LABELS_TH[status] : STATUS_LABELS[status];
}
function formatDate(
  value: string,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(language === "th" ? "th-TH-u-ca-buddhist" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  });
}

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
  pr: pages.filter(({ id }) => id !== "system-data").map(({ id }) => id),
  executive: ["home", "executive", "approvals", "library", "notifications", "help"],
  project_owner: [
    "home",
    "new-request",
    "my-requests",
    "calendar",
    "library",
    "ideas",
    "notifications",
    "help",
  ],
  approver: ["home", "approvals", "calendar", "library", "notifications", "help"],
  writer: [
    "home",
    "new-request",
    "my-requests",
    "operations",
    "calendar",
    "library",
    "ideas",
    "notifications",
    "help",
  ],
  designer: [
    "home",
    "my-requests",
    "operations",
    "calendar",
    "library",
    "notifications",
    "help",
  ],
  video: [
    "home",
    "my-requests",
    "operations",
    "calendar",
    "library",
    "notifications",
    "help",
  ],
  requester: [
    "home",
    "new-request",
    "my-requests",
    "calendar",
    "library",
    "ideas",
    "notifications",
    "help",
  ],
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
  messageHouse: {
    vision: "Rail technology for a safer, sustainable Thailand",
    positioning: "Trusted national rail technology partner",
    pillars: ["Safety and standards", "Research to reality", "National impact"],
    foundation: "Evidence · People · Partnership · Public value",
    pillarByTask: {
      "TASK-040": "Safety and standards",
      "TASK-041": "Research to reality",
      "TASK-042": "National impact",
    },
  },
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
function getUser(userId: string) {
  return users.find((user) => user.id === userId);
}
function taskRows(items: Task[]) {
  return items.map((task) => [
    task.type,
    task.title,
    STATUS_LABELS[task.status],
    getUser(task.ownerId)?.name ?? "Unassigned",
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
function isPrCenterState(value: unknown): value is PrCenterState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<PrCenterState>;
  return (
    state.version === 1 &&
    (state.language === "th" || state.language === "en") &&
    typeof state.currentUserId === "string" &&
    Array.isArray(state.requests) &&
    Array.isArray(state.tasks) &&
    Array.isArray(state.notifications) &&
    Array.isArray(state.audit)
  );
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

export function PrCenterApp() {
  const [page, setPage] = useState<Page>("home");
  const [state, setState] = useState<PrCenterState>(cloneDefaultState);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState<RequestDraft>(() =>
    emptyRequestDraft(users[0]),
  );
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let restored = cloneDefaultState();
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isPrCenterState(parsed)) {
          restored = {
            ...cloneDefaultState(),
            ...parsed,
            ideas: Array.isArray((parsed as Partial<PrCenterState>).ideas)
              ? (parsed as PrCenterState).ideas
              : cloneDefaultState().ideas,
            messageHouse: {
              ...cloneDefaultState().messageHouse,
              ...(parsed as Partial<PrCenterState>).messageHouse,
              pillarByTask: {
                ...cloneDefaultState().messageHouse.pillarByTask,
                ...(parsed as Partial<PrCenterState>).messageHouse?.pillarByTask,
              },
            },
            masterData:
              (parsed as Partial<PrCenterState>).masterData ??
              cloneDefaultState().masterData,
            snapshots: Array.isArray((parsed as Partial<PrCenterState>).snapshots)
              ? (parsed as PrCenterState).snapshots
              : [],
          };
        }
      }
    } catch {
      // Invalid browser data should not prevent the demo workspace from loading.
    }
    startTransition(() => {
      setState(restored);
      setHydrated(true);
    });
    // Browser storage is read only after hydration, so server and client markup match.
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Continue in-memory when browser storage is unavailable.
    }
  }, [hydrated, state]);

  const currentUser = getUser(state.currentUserId) ?? users[0];
  const visiblePages = pages.filter((item) =>
    ROLE_PAGES[currentUser.role].includes(item.id),
  );
  const t = copy[state.language];
  const userNotifications = state.notifications.filter(
    (item) => item.userId === currentUser.id,
  );
  const unreadCount = userNotifications.filter((item) => !item.read).length;
  const go = (next: Page) => {
    if (!ROLE_PAGES[currentUser.role].includes(next)) return;
    setPage(next);
    setSidebarOpen(false);
  };

  const openRequest = () => {
    setRequestDraft(emptyRequestDraft(currentUser));
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
  const createRequest = (draft: RequestDraft) => {
    updateState((previous) => {
      const id = `REQ-${String(previous.requests.length + 24).padStart(3, "0")}`;
      const taskId = `TASK-${String(previous.tasks.length + 40).padStart(3, "0")}`;
      const request: Request = {
        id,
        title: draft.title.trim(),
        type: draft.type,
        requesterId: currentUser.id,
        department: draft.department.trim(),
        requestedDate: draft.requestedDate,
        taskIds: [taskId],
        source: draft.source.trim(),
        objective: draft.objective.trim(),
        audience: draft.audience.trim(),
        startTime: draft.startTime,
        travel: draft.travel,
      };
      const task: Task = {
        id: taskId,
        requestId: id,
        type: draft.type === "pr" ? "PR Content" : "Off-site Support",
        title: request.title,
        status: "draft",
        ownerId: users.find((user) => user.name === draft.owner)?.id ?? currentUser.id,
        dueDate: request.requestedDate,
      };
      const notification: Notification = {
        id: `N-${previous.notifications.length + 1}`,
        userId: "u-pr",
        title: "New request",
        message: `${id} was submitted by ${currentUser.name}`,
        target: "requests",
        createdAt: new Date().toISOString(),
        read: false,
      };
      return addAudit(
        {
          ...previous,
          requests: [request, ...previous.requests],
          tasks: [task, ...previous.tasks],
          notifications: [notification, ...previous.notifications],
        },
        "request",
        id,
        "created",
        "",
        request.title,
      );
    });
    announce(state.language === "th" ? "บันทึกคำขอแล้ว" : "Request saved");
  };
  const transitionTask = (taskId: string, nextStatus: StatusId) => {
    updateState((previous) => {
      const task = previous.tasks.find((item) => item.id === taskId);
      if (!task || !STATUS_TRANSITIONS[task.status].includes(nextStatus)) return previous;
      return addAudit(
        {
          ...previous,
          tasks: previous.tasks.map((item) =>
            item.id === taskId ? { ...item, status: nextStatus } : item,
          ),
        },
        "task",
        taskId,
        "status_changed",
        STATUS_LABELS[task.status],
        STATUS_LABELS[nextStatus],
      );
    });
  };
  const createIdea = (title: string, summary: string) => {
    updateState((previous) => {
      const idea: Idea = {
        id: `IDEA-${String(previous.ideas.length + 1).padStart(3, "0")}`,
        title,
        summary,
        authorId: currentUser.id,
        status: "proposed",
        createdAt: new Date().toISOString(),
      };
      return addAudit(
        { ...previous, ideas: [idea, ...previous.ideas] },
        "system",
        idea.id,
        "idea_created",
        "",
        title,
      );
    });
  };
  const updateIdeaStatus = (id: string, status: IdeaStatus) =>
    updateState((previous) => {
      const idea = previous.ideas.find((item) => item.id === id);
      if (!idea) return previous;
      return addAudit(
        {
          ...previous,
          ideas: previous.ideas.map((item) =>
            item.id === id ? { ...item, status } : item,
          ),
        },
        "system",
        id,
        "idea_status_changed",
        idea.status,
        status,
      );
    });
  const convertIdea = (id: string) => {
    updateState((previous) => {
      const idea = previous.ideas.find((item) => item.id === id);
      if (!idea || idea.status !== "accepted") return previous;
      const requestId = `REQ-${String(previous.requests.length + 24).padStart(3, "0")}`;
      const taskId = `TASK-${String(previous.tasks.length + 40).padStart(3, "0")}`;
      const request: Request = {
        id: requestId,
        title: idea.title,
        type: "pr",
        requesterId: idea.authorId,
        department: getUser(idea.authorId)?.department ?? "Communications Office",
        requestedDate: new Date().toISOString().slice(0, 10),
        taskIds: [taskId],
        objective: idea.summary,
        audience: "To be defined during communication planning",
      };
      const task: Task = {
        id: taskId,
        requestId,
        type: "PR Content",
        title: idea.title,
        status: "communication_planning",
        ownerId: "u-pr",
        dueDate: request.requestedDate,
      };
      return addAudit(
        {
          ...previous,
          requests: [request, ...previous.requests],
          tasks: [task, ...previous.tasks],
          ideas: previous.ideas.map((item) =>
            item.id === id ? { ...item, status: "converted", requestId } : item,
          ),
        },
        "request",
        requestId,
        "idea_converted",
        idea.id,
        idea.title,
      );
    });
    announce(
      state.language === "th" ? "แปลงแนวคิดเป็นคำขอแล้ว" : "Idea converted to request",
    );
  };
  const saveMessageHouse = (messageHouse: MessageHouseData) =>
    updateState((previous) =>
      addAudit(
        { ...previous, messageHouse },
        "system",
        "message-house",
        "message_house_updated",
        previous.messageHouse.vision,
        messageHouse.vision,
      ),
    );
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
  const saveSnapshot = (name: string) =>
    updateState((previous) => ({
      ...previous,
      snapshots: [
        {
          id: `SNAP-${previous.snapshots.length + 1}`,
          name,
          createdAt: new Date().toISOString(),
          state: structuredClone({ ...previous, snapshots: [] }),
        },
        ...previous.snapshots,
      ],
    }));
  const recoverSnapshot = (snapshot: Snapshot) => {
    if (
      !window.confirm(
        `Recover “${snapshot.name}”? Current demo changes will be replaced.`,
      )
    )
      return;
    setState({ ...structuredClone(snapshot.state), snapshots: state.snapshots });
    announce("Snapshot recovered");
  };
  const readNotifications = (ids: string[]) =>
    updateState((previous) =>
      addAudit(
        {
          ...previous,
          notifications: previous.notifications.map((item) =>
            ids.includes(item.id) ? { ...item, read: true } : item,
          ),
        },
        "notification",
        ids.join(","),
        "marked_read",
        "unread",
        "read",
      ),
    );
  const switchUser = (userId: string) => {
    const next = getUser(userId);
    if (!next) return;
    updateState((previous) => ({ ...previous, currentUserId: userId }));
    if (!ROLE_PAGES[next.role].includes(page)) setPage("home");
  };
  const resetData = () => {
    if (!window.confirm("Reset all PR Center demo data?")) return;
    setState(cloneDefaultState());
    setPage("home");
    announce("System data reset");
  };
  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isPrCenterState(parsed)) throw new Error("invalid");
        setState({
          ...cloneDefaultState(),
          ...parsed,
          ideas: (parsed as PrCenterState).ideas ?? cloneDefaultState().ideas,
          messageHouse: {
            ...cloneDefaultState().messageHouse,
            ...(parsed as Partial<PrCenterState>).messageHouse,
            pillarByTask: {
              ...cloneDefaultState().messageHouse.pillarByTask,
              ...(parsed as Partial<PrCenterState>).messageHouse?.pillarByTask,
            },
          },
          masterData:
            (parsed as PrCenterState).masterData ?? cloneDefaultState().masterData,
          snapshots: (parsed as PrCenterState).snapshots ?? [],
        });
        announce("System data imported");
      } catch {
        announce("Import file is not valid PR Center data");
      }
    };
    reader.readAsText(file);
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
          <b>Prototype workspace</b>
          <br />
          V25.1 UI only
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
            <button className={styles.topRequest} onClick={openRequest}>
              + {t.newRequest}
            </button>
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
            <button className={styles.profile} onClick={() => go("directory")}>
              <span>{currentUser.name.slice(0, 2)}</span>
              <i>{currentUser.role}</i>
            </button>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.prototype}>{t.prototype}</div>
          {page === "home" && (
            <Dashboard
              t={t}
              onNavigate={go}
              onOpenRequest={openRequest}
              requests={state.requests}
              tasks={state.tasks}
            />
          )}
          {page === "executive" && (
            <ExecutiveDashboard
              t={t}
              onNavigate={go}
              tasks={state.tasks}
              requests={state.requests}
            />
          )}
          {page === "new-request" && <NewRequest t={t} onOpenRequest={openRequest} />}
          {page === "my-requests" && (
            <Requests
              t={t}
              onOpenRequest={openRequest}
              mode="mine"
              requests={state.requests}
              tasks={state.tasks}
              currentUserId={currentUser.id}
            />
          )}
          {page === "requests" && (
            <Requests
              t={t}
              onOpenRequest={openRequest}
              mode="all"
              requests={state.requests}
              tasks={state.tasks}
              currentUserId={currentUser.id}
            />
          )}
          {page === "operations" && (
            <Operations tasks={state.tasks} onTransition={transitionTask} />
          )}
          {page === "calendar" && (
            <Calendar tasks={state.tasks} language={state.language} onNavigate={go} />
          )}
          {page === "approvals" && (
            <Approvals
              tasks={state.tasks}
              role={currentUser.role}
              onTransition={transitionTask}
            />
          )}
          {page === "library" && (
            <Library tasks={state.tasks} language={state.language} onNavigate={go} />
          )}
          {page === "ideas" && (
            <Ideas
              ideas={state.ideas}
              currentUser={currentUser}
              onCreate={createIdea}
              onStatus={updateIdeaStatus}
              onConvert={convertIdea}
              language={state.language}
            />
          )}
          {page === "message-house" && (
            <MessageHouse
              data={state.messageHouse}
              editable={currentUser.role === "pr" || currentUser.role === "admin"}
              onSave={saveMessageHouse}
              tasks={state.tasks}
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
            <History
              audit={state.audit}
              snapshots={state.snapshots}
              language={state.language}
              onSaveSnapshot={saveSnapshot}
              onRecoverSnapshot={recoverSnapshot}
            />
          )}
          {page === "directory" && (
            <Directory
              users={users}
              currentUserId={currentUser.id}
              onSwitch={switchUser}
            />
          )}
          {page === "settings" && (
            <Settings
              data={state.masterData}
              onSave={updateMasterData}
              language={state.language}
            />
          )}
          {page === "system-data" && (
            <SystemData
              state={state}
              data={state.masterData}
              onSave={updateMasterData}
              onReset={resetData}
              onImport={importData}
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
          draft={requestDraft}
          onChange={setRequestDraft}
          onClose={() => setRequestOpen(false)}
          onSubmit={(event) => {
            event.preventDefault();
            setRequestOpen(false);
            createRequest(requestDraft);
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
  onNavigate,
  onOpenRequest,
  requests: requestItems,
  tasks: taskItems,
}: {
  t: (typeof copy)[Language];
  onNavigate: (page: Page) => void;
  onOpenRequest: () => void;
  requests: Request[];
  tasks: Task[];
}) {
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
  const reach = published * 6700;
  const engagement = Math.round(reach * 0.076);
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
          <p>{t.role}: PR Lead</p>
          <h1>{t.greeting}</h1>
          <span>{t.subheading}</span>
          <div className={styles.heroChips}>
            <b>September 2569</b>
            <b>{published} published items</b>
            <b>{pending} approvals pending</b>
          </div>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.heroSecondary} onClick={() => onNavigate("calendar")}>
            View calendar
          </button>
          <button className={styles.primary} onClick={onOpenRequest}>
            + {t.newRequest}
          </button>
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
          value={`${(reach / 1000).toFixed(1)}K`}
          label={t.reach}
          trend="Estimated from published items"
          tone="green"
        />
        <Metric
          value={`${(engagement / 1000).toFixed(1)}K`}
          label={t.engagement}
          trend="7.6% engagement rate"
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
              <h2>September 2569</h2>
            </div>
          </header>
          <ol className={styles.timeline}>
            <li>
              <b>08 Sep</b>
              <span>Rail standard announcement</span>
              <Status>Scheduled</Status>
            </li>
            <li>
              <b>11 Sep</b>
              <span>AI Camera project update</span>
              <Status>In review</Status>
            </li>
            <li>
              <b>16 Sep</b>
              <span>Safety journey video</span>
              <Status>In production</Status>
            </li>
          </ol>
        </article>
        <article className={`${styles.card} ${styles.wideCard}`}>
          <header>
            <div>
              <p className={styles.eyebrow}>{t.recentRequests}</p>
              <h2>Latest work requests</h2>
            </div>
            <button onClick={() => onNavigate("requests")}>{t.viewAll}</button>
          </header>
          <Table
            rows={requestRows}
            headers={["ID", "Project", "Status", "Target date"]}
          />
        </article>
        <article className={styles.card}>
          <header>
            <div>
              <p className={styles.eyebrow}>CHANNEL MIX</p>
              <h2>Published content</h2>
            </div>
          </header>
          <div className={styles.donut}>
            <b>{published}</b>
            <span>items</span>
          </div>
          <div className={styles.legend}>
            <span>
              <i className={styles.blueDot} />
              Facebook 39%
            </span>
            <span>
              <i className={styles.tealDot} />
              Website 27%
            </span>
            <span>
              <i className={styles.amberDot} />
              Video 18%
            </span>
          </div>
        </article>
      </section>
    </>
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
  onNavigate,
  tasks,
  requests,
}: {
  t: (typeof copy)[Language];
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
  const reach = published * 6700;
  const engagement = Math.round(reach * 0.076);
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
          value={`${(reach / 1000).toFixed(1)}K`}
          label={t.reach}
          trend="Estimated from published items"
          tone="green"
        />
        <Metric
          value={`${(engagement / 1000).toFixed(1)}K`}
          label={t.engagement}
          trend="7.6% engagement rate"
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
  mode,
  requests: requestItems,
  tasks: taskItems,
  currentUserId,
}: {
  t: (typeof copy)[Language];
  onOpenRequest: () => void;
  mode: "all" | "mine";
  requests: Request[];
  tasks: Task[];
  currentUserId: string;
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
          <button className={styles.primary} onClick={onOpenRequest}>
            + {t.newRequest}
          </button>
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
                    <Status>{STATUS_LABELS[requestStatus(request, taskItems)]}</Status>
                  </td>
                  <td>{request.requestedDate}</td>
                  <td>
                    <button onClick={() => setSelectedId(request.id)}>Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <section className={styles.card} style={{ marginTop: 16 }}>
            <p className={styles.eyebrow}>
              {selected.id} · {selected.department}
            </p>
            <h2>{selected.title}</h2>
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
          </section>
        )}
      </article>
    </>
  );
}
function Operations({
  tasks: taskItems,
  onTransition,
}: {
  tasks: Task[];
  onTransition: (taskId: string, status: StatusId) => void;
}) {
  const [view, setView] = useState<"board" | "table">("board");
  const [status, setStatus] = useState<"all" | StatusId>("all");
  const [ownerId, setOwnerId] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  return (
    <>
      <SectionHeading
        eyebrow="CONTENT OPERATIONS"
        title="Production board"
        action={
          <div className={styles.segmented}>
            <button onClick={() => setView("board")}>Board</button>
            <button onClick={() => setView("table")}>Table</button>
          </div>
        }
      />
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
          {users
            .filter((user) => user.active)
            .map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
        </select>
      </section>
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
                      {getUser(task.ownerId)?.name ?? "Unassigned"}
                      <span>{task.dueDate}</span>
                    </footer>
                    <button onClick={() => setSelectedId(task.id)}>Details</button>
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
      {selected && (
        <article className={styles.card}>
          <p className={styles.eyebrow}>
            {selected.id} · due {selected.dueDate}
          </p>
          <h2>{selected.title}</h2>
          <p>Owner: {getUser(selected.ownerId)?.name ?? "Unassigned"}</p>
          {STATUS_TRANSITIONS[selected.status].length > 0 && (
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
                {STATUS_TRANSITIONS[selected.status].map((next) => (
                  <option key={next} value={next}>
                    {STATUS_LABELS[next]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </article>
      )}
    </>
  );
}
function Calendar({
  tasks,
  language,
  onNavigate,
}: {
  tasks: Task[];
  language: Language;
  onNavigate: (page: Page) => void;
}) {
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const [view, setView] = useState<"month" | "week">("month");
  const [status, setStatus] = useState<"all" | StatusId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visibleTasks = tasks.filter((task) => status === "all" || task.status === status);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(1 - ((firstDay.getDay() + 6) % 7));
  const days = Array.from(
    { length: view === "month" ? 35 : 7 },
    (_, index) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
  const monthLabel = month.toLocaleDateString(
    language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
    { month: "long", year: "numeric" },
  );
  const selected = tasks.find((task) => task.id === selectedId);
  return (
    <>
      <SectionHeading
        eyebrow="CONTENT CALENDAR"
        title={monthLabel}
        action={
          <div className={styles.segmented}>
            <button
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              Previous
            </button>
            <button onClick={() => setView("month")}>Month</button>
            <button onClick={() => setView("week")}>Week</button>
            <button
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              Next
            </button>
          </div>
        }
      />
      <section className={styles.filterBar}>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "all" | StatusId)}
        >
          <option value="all">All task statuses</option>
          {Object.entries(STATUS_LABELS).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </section>
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
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={day.getMonth() !== month.getMonth() ? styles.mutedDay : ""}
            >
              <b>{day.getDate()}</b>
              {visibleTasks
                .filter((task) => task.dueDate === day.toISOString().slice(0, 10))
                .map((task) => (
                  <button
                    key={task.id}
                    className={`${styles.event} ${task.type.includes("Video") ? styles.videoEvent : ""}`}
                    onClick={() => setSelectedId(task.id)}
                  >
                    {task.type}: {task.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </article>
      {selected && (
        <article className={styles.card}>
          <p className={styles.eyebrow}>{selected.id}</p>
          <h2>{selected.title}</h2>
          <p>
            {selected.type} · {statusLabel(selected.status, language)} ·{" "}
            {formatDate(selected.dueDate, language)}
          </p>
          <p>Owner: {getUser(selected.ownerId)?.name ?? "Unassigned"}</p>
          <button className={styles.primary} onClick={() => onNavigate("operations")}>
            {language === "th" ? "เปิดงานในกระดานผลิต" : "Open in production board"}
          </button>
        </article>
      )}
    </>
  );
}
function Approvals({
  tasks: taskItems,
  role,
  onTransition,
}: {
  tasks: Task[];
  role: Role;
  onTransition: (taskId: string, status: StatusId) => void;
}) {
  const reviewStatuses: StatusId[] =
    role === "executive"
      ? ["management_approval"]
      : ["pr_editorial_review", "management_approval"];
  const pendingTasks = taskItems.filter((task) => reviewStatuses.includes(task.status));
  return (
    <>
      <SectionHeading eyebrow="REVIEW AND APPROVAL" title="Approval Queue" />
      <section className={styles.list}>
        {pendingTasks.map((task) => (
          <article key={task.id} className={styles.listItem}>
            <div>
              <p>{STATUS_LABELS[task.status]}</p>
              <h2>{task.title}</h2>
              <span>
                Submitted by {getUser(task.ownerId)?.name ?? "Unassigned"} · 2 hours ago
              </span>
            </div>
            <div>
              <Status>Awaiting approval</Status>
              {(role === "admin" &&
                ["pr_editorial_review", "management_approval"].includes(task.status)) ||
              (role === "executive" && task.status === "management_approval") ||
              (role === "pr" && task.status === "pr_editorial_review") ? (
                <>
                  <button onClick={() => onTransition(task.id, "revision_required")}>
                    Request revision
                  </button>
                  <button
                    className={styles.primary}
                    onClick={() => onTransition(task.id, "approved")}
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
      </section>
    </>
  );
}
function Library({
  tasks,
  language,
  onNavigate,
}: {
  tasks: Task[];
  language: Language;
  onNavigate: (page: Page) => void;
}) {
  const published = tasks.filter((task) => ["published", "closed"].includes(task.status));
  const totalReach = published.reduce(
    (total, _, index) => total + 6700 + index * 1200,
    0,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = published.find((task) => task.id === selectedId);
  return (
    <>
      <SectionHeading
        eyebrow="PUBLISHED CONTENT"
        title="Content Library"
        action={<span>{published.length} published or closed items</span>}
      />
      <section className={styles.metrics}>
        <Metric
          value={String(published.length)}
          label={language === "th" ? "เนื้อหาที่เผยแพร่" : "Published items"}
          trend={language === "th" ? "จากข้อมูลเดโม" : "From demo data"}
          tone="blue"
        />
        <Metric
          value={`${(totalReach / 1000).toFixed(1)}K`}
          label={language === "th" ? "จำนวนการเข้าถึงโดยประมาณ" : "Estimated reach"}
          trend={language === "th" ? "อ้างอิงตามประเภทเนื้อหา" : "Based on content type"}
          tone="green"
        />
      </section>
      <section className={styles.library}>
        {published.map((task, index) => (
          <article key={task.id}>
            <div
              className={`${styles.libraryImage} ${index % 2 ? styles.libraryImageAlt : ""}`}
            >
              RTRDA
            </div>
            <small>{task.type}</small>
            <h2>{task.title}</h2>
            <p>
              {statusLabel(task.status, language)} {formatDate(task.dueDate, language)}
            </p>
            <span>Owner: {getUser(task.ownerId)?.name ?? "Unassigned"}</span>
            <button onClick={() => setSelectedId(task.id)}>
              {language === "th" ? "ดูรายละเอียด" : "View details"}
            </button>
          </article>
        ))}
      </section>
      {published.length === 0 && (
        <article className={styles.card}>
          <p>
            {language === "th"
              ? "ยังไม่มีเนื้อหาที่เผยแพร่"
              : "No published content yet."}
          </p>
        </article>
      )}
      {selected && (
        <article className={styles.card}>
          <p className={styles.eyebrow}>{selected.id}</p>
          <h2>{selected.title}</h2>
          <p>
            {selected.type} · {formatDate(selected.dueDate, language)}
          </p>
          <button className={styles.primary} onClick={() => onNavigate("operations")}>
            {language === "th" ? "เปิดงานต้นทาง" : "Open source task"}
          </button>
        </article>
      )}
    </>
  );
}
function Ideas({
  ideas,
  currentUser,
  onCreate,
  onStatus,
  onConvert,
  language,
}: {
  ideas: Idea[];
  currentUser: User;
  onCreate: (title: string, summary: string) => void;
  onStatus: (id: string, status: IdeaStatus) => void;
  onConvert: (id: string) => void;
  language: Language;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | IdeaStatus>("all");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const visible = ideas.filter(
    (idea) =>
      (status === "all" || idea.status === status) &&
      `${idea.title} ${idea.summary}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <SectionHeading
        eyebrow="COLLABORATION"
        title="Content Ideas"
        action={
          <button className={styles.primary} onClick={() => setOpen(!open)}>
            + Propose idea
          </button>
        }
      />
      {open && (
        <form
          className={styles.card}
          onSubmit={(event) => {
            event.preventDefault();
            onCreate(title.trim(), summary.trim());
            setTitle("");
            setSummary("");
            setOpen(false);
          }}
        >
          <h2>Propose an idea</h2>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Idea title"
            required
          />{" "}
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Audience, channel, and angle"
            required
          />{" "}
          <button className={styles.primary} type="submit">
            Save idea
          </button>
        </form>
      )}
      <section className={styles.filterBar}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter ideas"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "all" | IdeaStatus)}
        >
          <option value="all">All statuses</option>
          {["proposed", "under_review", "accepted", "converted", "archived"].map(
            (value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ),
          )}
        </select>
      </section>
      <section className={styles.ideaGrid}>
        {visible.map((idea) => (
          <article key={idea.id} className={styles.card}>
            <p className={styles.eyebrow}>
              {idea.id} · {idea.status.replace("_", " ")}
            </p>
            <h2>{idea.title}</h2>
            <p>{idea.summary}</p>
            <footer>
              <span>{getUser(idea.authorId)?.name ?? "Unknown"}</span>
              {(currentUser.role === "pr" || currentUser.role === "admin") && (
                <select
                  value=""
                  onChange={(event) =>
                    event.target.value &&
                    onStatus(idea.id, event.target.value as IdeaStatus)
                  }
                >
                  <option value="">{idea.status.replace("_", " ")}</option>
                  {IDEA_TRANSITIONS[idea.status].map((value) => (
                    <option key={value} value={value}>
                      {value.replace("_", " ")}
                    </option>
                  ))}
                </select>
              )}
              {idea.status === "accepted" &&
                (currentUser.role === "pr" || currentUser.role === "admin") && (
                  <button className={styles.primary} onClick={() => onConvert(idea.id)}>
                    {language === "th" ? "แปลงเป็นคำขอ" : "Convert to request"}
                  </button>
                )}
              {idea.requestId && (
                <span>
                  {language === "th" ? "คำขอ" : "Request"}: {idea.requestId}
                </span>
              )}
            </footer>
          </article>
        ))}
      </section>
    </>
  );
}
function MessageHouse({
  data,
  editable,
  onSave,
  tasks,
  language,
}: {
  data: MessageHouseData;
  editable: boolean;
  onSave: (data: MessageHouseData) => void;
  tasks: Task[];
  language: Language;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data);
  return (
    <>
      <SectionHeading
        eyebrow="COMMUNICATION STRATEGY"
        title="Message House"
        action={
          editable ? (
            <button
              className={styles.primary}
              onClick={() => {
                setDraft(data);
                setEditing(!editing);
              }}
            >
              {editing ? "Cancel" : "Edit message house"}
            </button>
          ) : (
            <span>View only</span>
          )
        }
      />
      {editing && (
        <section className={styles.card}>
          <label>
            Vision
            <input
              value={draft.vision}
              onChange={(event) => setDraft({ ...draft, vision: event.target.value })}
            />
          </label>
          <label>
            Positioning
            <input
              value={draft.positioning}
              onChange={(event) =>
                setDraft({ ...draft, positioning: event.target.value })
              }
            />
          </label>
          {draft.pillars.map((pillar, index) => (
            <label key={index}>
              Pillar {index + 1}
              <input
                value={pillar}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    pillars: draft.pillars.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  })
                }
              />
            </label>
          ))}
          <label>
            Foundation
            <input
              value={draft.foundation}
              onChange={(event) => setDraft({ ...draft, foundation: event.target.value })}
            />
          </label>
          <button
            className={styles.primary}
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
          >
            Save message house
          </button>
          <h2>{language === "th" ? "จัดกลุ่มงานตามเสาหลัก" : "Map work to pillars"}</h2>
          {tasks.map((task) => (
            <label key={task.id}>
              {task.title}
              <select
                value={draft.pillarByTask[task.id] ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    pillarByTask: {
                      ...draft.pillarByTask,
                      [task.id]: event.target.value,
                    },
                  })
                }
              >
                <option value="">Unmapped</option>
                {draft.pillars.map((pillar) => (
                  <option key={pillar} value={pillar}>
                    {pillar}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
      )}
      <article className={`${styles.card} ${styles.messageHouse}`}>
        <div className={styles.roof}>
          <b>Vision / Mission</b>
          <span>{data.vision}</span>
        </div>
        <div className={styles.positioning}>
          <b>Brand positioning</b>
          <span>{data.positioning}</span>
        </div>
        <div className={styles.pillars}>
          {data.pillars.map((pillar) => (
            <div key={pillar}>
              <b>{pillar}</b>
              <span>
                {tasks.filter((task) => data.pillarByTask[task.id] === pillar).length}{" "}
                {language === "th" ? "งานที่เชื่อมโยง" : "mapped work items"}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.foundation}>{data.foundation}</div>
      </article>
    </>
  );
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
        {notifications.map(({ id, title, message, target, createdAt, read }) => (
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
              <b>{title}</b>
              <span>{message}</span>
              <small>
                {new Date(createdAt).toLocaleString(
                  language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
                )}
              </small>
            </div>
          </button>
        ))}
      </section>
    </>
  );
}
function History({
  audit,
  snapshots,
  language,
  onSaveSnapshot,
  onRecoverSnapshot,
}: {
  audit: AuditEntry[];
  snapshots: Snapshot[];
  language: Language;
  onSaveSnapshot: (name: string) => void;
  onRecoverSnapshot: (snapshot: Snapshot) => void;
}) {
  const [name, setName] = useState("");
  return (
    <>
      <SectionHeading
        eyebrow="AUDIT AND RECOVERY"
        title={language === "th" ? "ประวัติและการกู้คืน" : "Activity History"}
        action={
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSaveSnapshot(name.trim() || "Manual snapshot");
              setName("");
            }}
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={language === "th" ? "ชื่อจุดคืนค่า" : "Snapshot name"}
            />
            <button className={styles.primary} type="submit">
              {language === "th" ? "บันทึกจุดคืนค่า" : "Save snapshot"}
            </button>
          </form>
        }
      />
      <section className={styles.list}>
        {snapshots.map((snapshot) => (
          <article key={snapshot.id} className={styles.listItem}>
            <div>
              <h2>{snapshot.name}</h2>
              <span>
                {new Date(snapshot.createdAt).toLocaleString(
                  language === "th" ? "th-TH-u-ca-buddhist" : "en-GB",
                )}
              </span>
            </div>
            <button onClick={() => onRecoverSnapshot(snapshot)}>
              {language === "th" ? "กู้คืน" : "Recover"}
            </button>
          </article>
        ))}
        {snapshots.length === 0 && (
          <article className={styles.card}>
            <p>
              {language === "th"
                ? "ยังไม่มีจุดคืนค่าที่บันทึกไว้"
                : "No saved snapshots yet."}
            </p>
          </article>
        )}
      </section>
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
  users: directoryUsers,
  currentUserId,
  onSwitch,
}: {
  users: User[];
  currentUserId: string;
  onSwitch: (userId: string) => void;
}) {
  return (
    <>
      <SectionHeading
        eyebrow="PEOPLE"
        title="User Directory"
        action={
          <select
            value={currentUserId}
            onChange={(event) => onSwitch(event.target.value)}
            aria-label="Demo role switcher"
          >
            {directoryUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        }
      />
      <section className={styles.directory}>
        {directoryUsers.map((user) => (
          <article key={user.id}>
            <b>{user.name.slice(0, 2)}</b>
            <div>
              <h2>{user.name}</h2>
              <span>{user.role}</span>
            </div>
            <Status>{user.active ? "Active" : "Inactive"}</Status>
          </article>
        ))}
      </section>
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
function Settings({
  data,
  onSave,
  language,
}: {
  data: MasterData;
  onSave: (data: MasterData) => void;
  language: Language;
}) {
  return (
    <>
      <SectionHeading
        eyebrow="ADMINISTRATION"
        title={language === "th" ? "การตั้งค่าสิทธิ์และขั้นตอน" : "Permission Settings"}
      />
      <section className={styles.settings}>
        <MasterDataEditor
          label={language === "th" ? "ขั้นตอนอนุมัติ" : "Approval stages"}
          values={data.approvalStages}
          onSave={(approvalStages) => onSave({ ...data, approvalStages })}
        />
        <MasterDataEditor
          label={language === "th" ? "ช่องทางเผยแพร่" : "Channels"}
          values={data.channels}
          onSave={(channels) => onSave({ ...data, channels })}
        />
        <article className={styles.card}>
          <h2>{language === "th" ? "บทบาทในเดโม" : "Demo roles"}</h2>
          <p>
            Admin · PR Lead · Executive · Project owner · Approver · Writer · Designer ·
            Video producer · Requester
          </p>
        </article>
      </section>
    </>
  );
}
function SystemData({
  state,
  data,
  onSave,
  onReset,
  onImport,
  language,
}: {
  state: PrCenterState;
  data: MasterData;
  onSave: (data: MasterData) => void;
  onReset: () => void;
  onImport: (file: File) => void;
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
        <label>
          Import data{" "}
          <input
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <button onClick={onReset}>Reset demo data</button>
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
          Your available actions follow the selected demo role.
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
            "Review impact",
            "See published content and its performance in the dashboard.",
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
  draft,
  onChange,
  onClose,
  onSubmit,
}: {
  language: Language;
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
            <p className={styles.eyebrow}>NEW WORK REQUEST</p>
            <h2 id="request-title">{thai ? "ส่งคำของาน" : "Submit work request"}</h2>
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
            {thai ? "บันทึกคำขอ" : "Save request"}
          </button>
        </footer>
      </form>
    </div>
  );
}
