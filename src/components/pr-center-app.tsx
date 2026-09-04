"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./pr-center-app.module.css";

type Page =
  | "home"
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
  | "help";

type Language = "th" | "en";

const pages: { id: Page; th: string; en: string; short: string }[] = [
  { id: "home", th: "ภาพรวม", en: "Dashboard", short: "DB" },
  { id: "requests", th: "คำขอ", en: "Requests", short: "RQ" },
  { id: "operations", th: "การดำเนินงานเนื้อหา", en: "Content Operations", short: "OP" },
  { id: "calendar", th: "ปฏิทิน", en: "Calendar", short: "CA" },
  { id: "approvals", th: "รออนุมัติ", en: "Approval Queue", short: "AP" },
  { id: "library", th: "คลังเนื้อหา", en: "Content Library", short: "LB" },
  { id: "ideas", th: "แนวคิดเนื้อหา", en: "Content Ideas", short: "ID" },
  { id: "message-house", th: "Message House", en: "Message House", short: "MH" },
  { id: "notifications", th: "การแจ้งเตือน", en: "Notifications", short: "NT" },
  { id: "history", th: "ประวัติ", en: "History", short: "HI" },
  { id: "directory", th: "รายชื่อผู้ใช้", en: "User Directory", short: "UD" },
  { id: "settings", th: "การตั้งค่า", en: "Settings", short: "ST" },
  { id: "help", th: "คู่มือการใช้งาน", en: "How to Use", short: "?" },
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

const requests = [
  ["REQ-026", "งานเปิดตัวมาตรฐานระบบราง", "กำลังผลิต", "12 ก.ย. 2569"],
  ["REQ-025", "ประชาสัมพันธ์โครงการ AI Camera", "รอตรวจสอบข้อเท็จจริง", "10 ก.ย. 2569"],
  ["REQ-024", "ลงพื้นที่จังหวัดขอนแก่น", "รออนุมัติ", "08 ก.ย. 2569"],
];

const tasks = [
  ["Facebook Post", "ความก้าวหน้าโครงการมาตรฐาน", "กำลังผลิต", "N. Suthida"],
  ["Short Video", "เบื้องหลังการทดสอบระบบราง", "ตรวจทานบรรณาธิการ", "P. Thanawat"],
  ["Website News", "สทร. ร่วมประชุมภาคีเครือข่าย", "กำหนดเผยแพร่", "K. Narin"],
];

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
  const [language, setLanguage] = useState<Language>("th");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestType, setRequestType] = useState<"pr" | "offsite">("pr");
  const [notice, setNotice] = useState<string | null>(null);
  const t = copy[language];
  const go = (next: Page) => {
    setPage(next);
    setSidebarOpen(false);
  };

  const announce = (message: string) => setNotice(message);

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
          {pages.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? styles.navActive : ""}
              onClick={() => go(item.id)}
            >
              <span>{item.short}</span>
              {label(item, language)}
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
            <button className={styles.topRequest} onClick={() => setRequestOpen(true)}>
              + {t.newRequest}
            </button>
            <button
              className={styles.bell}
              onClick={() => go("notifications")}
              aria-label="Open notifications"
            >
              <span>3</span>
            </button>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
              aria-label="Language"
            >
              <option value="th">ไทย</option>
              <option value="en">EN</option>
            </select>
            <button
              className={styles.profile}
              onClick={() =>
                announce(
                  language === "th"
                    ? "สลับบทบาทตัวอย่างได้ใน Phase 1"
                    : "Demo role switching will be available in Phase 1",
                )
              }
            >
              <span>PR</span>
              <i>PR Lead</i>
            </button>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.prototype}>{t.prototype}</div>
          {page === "home" && (
            <Dashboard t={t} onNavigate={go} onOpenRequest={() => setRequestOpen(true)} />
          )}
          {page === "requests" && (
            <Requests t={t} onOpenRequest={() => setRequestOpen(true)} />
          )}
          {page === "operations" && <Operations />}
          {page === "calendar" && <Calendar />}
          {page === "approvals" && (
            <Approvals
              onApprove={() =>
                announce(
                  language === "th"
                    ? "บันทึกการอนุมัติแบบจำลองแล้ว"
                    : "Demo approval recorded",
                )
              }
            />
          )}
          {page === "library" && <Library />}
          {page === "ideas" && (
            <Ideas
              onSubmit={() =>
                announce(
                  language === "th" ? "ส่งแนวคิดแบบจำลองแล้ว" : "Demo idea submitted",
                )
              }
            />
          )}
          {page === "message-house" && <MessageHouse />}
          {page === "notifications" && <Notifications onNavigate={go} />}
          {page === "history" && <History />}
          {page === "directory" && <Directory />}
          {page === "settings" && <Settings />}
          {page === "help" && <Help />}
        </main>
      </section>

      {requestOpen && (
        <RequestModal
          language={language}
          requestType={requestType}
          setRequestType={setRequestType}
          onClose={() => setRequestOpen(false)}
          onSubmit={() => {
            setRequestOpen(false);
            announce(language === "th" ? "บันทึกคำขอจำลองแล้ว" : "Demo request saved");
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
}: {
  t: (typeof copy)[Language];
  onNavigate: (page: Page) => void;
  onOpenRequest: () => void;
}) {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p>{t.role}: PR Lead</p>
          <h1>{t.greeting}</h1>
          <span>{t.subheading}</span>
          <div className={styles.heroChips}>
            <b>September 2569</b>
            <b>28 published items</b>
            <b>6 approvals pending</b>
          </div>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.heroSecondary}>View calendar</button>
          <button className={styles.primary} onClick={onOpenRequest}>
            + {t.newRequest}
          </button>
        </div>
      </section>
      <section className={styles.metrics}>
        <Metric value="28" label={t.published} trend="+12% from last month" tone="blue" />
        <Metric
          value="186.4K"
          label={t.reach}
          trend="+18.6% from last month"
          tone="green"
        />
        <Metric
          value="14.2K"
          label={t.engagement}
          trend="7.6% engagement rate"
          tone="purple"
        />
        <Metric value="6" label={t.pending} trend="Review within 2 days" tone="gold" />
      </section>
      <section className={styles.workflowStrip} aria-label="Workflow health">
        {[
          ["Planning", "4", styles.workflowPlan],
          ["Waiting for information", "3", styles.workflowWait],
          ["In production", "9", styles.workflowDoing],
          ["Awaiting approval", "6", styles.workflowApproval],
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
              ["New request", 4],
              ["In production", 9],
              ["Review", 6],
              ["Scheduled", 5],
              ["Published", 28],
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
          <Table rows={requests} headers={["ID", "Project", "Status", "Target date"]} />
        </article>
        <article className={styles.card}>
          <header>
            <div>
              <p className={styles.eyebrow}>CHANNEL MIX</p>
              <h2>Published content</h2>
            </div>
          </header>
          <div className={styles.donut}>
            <b>28</b>
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
function Requests({
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
        title={t.recentRequests}
        action={
          <button className={styles.primary} onClick={onOpenRequest}>
            + {t.newRequest}
          </button>
        }
      />
      <section className={styles.filterBar}>
        <input placeholder={t.search} />
        <select defaultValue="all">
          <option value="all">All status</option>
          <option>Draft</option>
          <option>In production</option>
        </select>
        <button>Filter</button>
      </section>
      <article className={styles.card}>
        <Table
          headers={["Request", "Project / activity", "Status", "Requested date"]}
          rows={requests}
        />
      </article>
    </>
  );
}
function Operations() {
  return (
    <>
      <SectionHeading
        eyebrow="CONTENT OPERATIONS"
        title="Production board"
        action={<button className={styles.primary}>+ Create task</button>}
      />
      <div className={styles.board}>
        {["New request", "Planning", "In production", "Review", "Scheduled"].map(
          (column, index) => (
            <section key={column}>
              <header>
                <b>{column}</b>
                <span>{index + 2}</span>
              </header>
              {tasks.slice(index % 2, (index % 2) + 2).map((task) => (
                <article key={`${column}-${task[0]}`}>
                  <small>{task[0]}</small>
                  <b>{task[1]}</b>
                  <Status>{task[2]}</Status>
                  <footer>
                    {task[3]}
                    <span>Sep {10 + index}</span>
                  </footer>
                </article>
              ))}
            </section>
          ),
        )}
      </div>
      <article className={styles.card}>
        <h2>Table view</h2>
        <Table headers={["Type", "Content", "Status", "Owner"]} rows={tasks} />
      </article>
    </>
  );
}
function Calendar() {
  const days = Array.from({ length: 35 }, (_, index) => index + 1);
  return (
    <>
      <SectionHeading
        eyebrow="CONTENT CALENDAR"
        title="September 2569"
        action={
          <div className={styles.segmented}>
            <button>Month</button>
            <button>Week</button>
          </div>
        }
      />
      <article className={styles.card}>
        <div className={styles.calendarWeek}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <b key={day}>{day}</b>
          ))}
        </div>
        <div className={styles.calendar}>
          {days.map((day) => (
            <div key={day} className={day > 30 ? styles.mutedDay : ""}>
              <b>{day > 30 ? day - 30 : day}</b>
              {[8, 11, 16, 23].includes(day) && (
                <span className={styles.event}>Facebook: project update</span>
              )}
              {[10, 18].includes(day) && (
                <span className={`${styles.event} ${styles.videoEvent}`}>
                  Video publication
                </span>
              )}
            </div>
          ))}
        </div>
      </article>
    </>
  );
}
function Approvals({ onApprove }: { onApprove: () => void }) {
  return (
    <>
      <SectionHeading eyebrow="REVIEW AND APPROVAL" title="Approval Queue" />
      <section className={styles.list}>
        {tasks.map((task, index) => (
          <article key={task[1]} className={styles.listItem}>
            <div>
              <p>{index % 2 === 0 ? "PR editorial review" : "Technical review"}</p>
              <h2>{task[1]}</h2>
              <span>Submitted by {task[3]} · 2 hours ago</span>
            </div>
            <div>
              <Status>Awaiting approval</Status>
              <button className={styles.primary} onClick={onApprove}>
                Review
              </button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
function Library() {
  return (
    <>
      <SectionHeading
        eyebrow="PUBLISHED CONTENT"
        title="Content Library"
        action={<button className={styles.primary}>+ Add publication</button>}
      />
      <section className={styles.library}>
        {[
          "National rail technology strategy",
          "AI Camera field study",
          "Rail safety standards",
          "Human(s) of RTRDA",
        ].map((title, index) => (
          <article key={title}>
            <div
              className={`${styles.libraryImage} ${index % 2 ? styles.libraryImageAlt : ""}`}
            >
              RTRDA
            </div>
            <small>{["Website News", "Facebook", "YouTube", "LinkedIn"][index]}</small>
            <h2>{title}</h2>
            <p>Published 0{index + 2} Sep 2569</p>
            <span>{(12 + index * 4).toFixed(1)}K reach</span>
          </article>
        ))}
      </section>
    </>
  );
}
function Ideas({ onSubmit }: { onSubmit: () => void }) {
  return (
    <>
      <SectionHeading
        eyebrow="COLLABORATION"
        title="Content Ideas"
        action={
          <button className={styles.primary} onClick={onSubmit}>
            + Propose idea
          </button>
        }
      />
      <section className={styles.ideaGrid}>
        {[
          "Behind Every Safe Journey",
          "Rail Explained: What is ETCS?",
          "RTRDA research in action",
        ].map((idea, index) => (
          <article key={idea} className={styles.card}>
            <p className={styles.eyebrow}>
              P0{index + 2} · {index === 1 ? "Under review" : "Proposed"}
            </p>
            <h2>{idea}</h2>
            <p>
              Suggested by communications team. Align this idea to an audience and channel
              before conversion to a task.
            </p>
            <footer>
              <span>3 contributors</span>
              <button>Open idea</button>
            </footer>
          </article>
        ))}
      </section>
    </>
  );
}
function MessageHouse() {
  return (
    <>
      <SectionHeading
        eyebrow="COMMUNICATION STRATEGY"
        title="Message House"
        action={<button className={styles.primary}>Edit message house</button>}
      />
      <article className={`${styles.card} ${styles.messageHouse}`}>
        <div className={styles.roof}>
          <b>Vision / Mission</b>
          <span>Rail technology for a safer, sustainable Thailand</span>
        </div>
        <div className={styles.positioning}>
          <b>Brand positioning</b>
          <span>Trusted national rail technology partner</span>
        </div>
        <div className={styles.pillars}>
          {["Safety and standards", "Research to reality", "National impact"].map(
            (pillar) => (
              <div key={pillar}>
                <b>{pillar}</b>
                <span>Proof points and messages for daily content</span>
              </div>
            ),
          )}
        </div>
        <div className={styles.foundation}>
          Evidence · People · Partnership · Public value
        </div>
      </article>
    </>
  );
}
function Notifications({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return (
    <>
      <SectionHeading eyebrow="ACTIVITY" title="Notifications" />
      <section className={styles.list}>
        {[
          [
            "Approval needed",
            "Technical review is ready for AI Camera project",
            "approvals",
          ],
          ["New request", "REQ-026 was submitted by Strategy Division", "requests"],
          [
            "Publication due",
            "Rail standard announcement publishes tomorrow",
            "operations",
          ],
        ].map(([title, description, target]) => (
          <button
            key={title}
            className={styles.notification}
            onClick={() => onNavigate(target as Page)}
          >
            <i />
            <div>
              <b>{title}</b>
              <span>{description}</span>
              <small>Today, 09:30</small>
            </div>
          </button>
        ))}
      </section>
    </>
  );
}
function History() {
  return (
    <>
      <SectionHeading eyebrow="AUDIT AND RECOVERY" title="Activity History" />
      <article className={styles.card}>
        <Table
          headers={["Time", "Actor", "Action", "Entity"]}
          rows={[
            ["Today 09:30", "PR Lead", "Updated task status", "TASK-042"],
            ["Yesterday 16:10", "N. Suthida", "Submitted request", "REQ-026"],
            ["Yesterday 10:05", "Approver", "Approved editorial review", "TASK-041"],
          ]}
        />
      </article>
    </>
  );
}
function Directory() {
  return (
    <>
      <SectionHeading
        eyebrow="PEOPLE"
        title="User Directory"
        action={<button className={styles.primary}>+ Add user</button>}
      />
      <section className={styles.directory}>
        {[
          ["PR", "PR Lead", "Communications Office"],
          ["NS", "N. Suthida", "Writer"],
          ["PT", "P. Thanawat", "Video Producer"],
          ["KN", "K. Narin", "Approver"],
        ].map(([initials, name, role]) => (
          <article key={name}>
            <b>{initials}</b>
            <div>
              <h2>{name}</h2>
              <span>{role}</span>
            </div>
            <Status>Active</Status>
          </article>
        ))}
      </section>
    </>
  );
}
function Settings() {
  return (
    <>
      <SectionHeading eyebrow="ADMINISTRATION" title="Permission Settings" />
      <section className={styles.settings}>
        {[
          ["Roles and permissions", "Manage access to each module and workflow action"],
          [
            "Approval stages",
            "Configure source, technical, editorial and management approvals",
          ],
          [
            "Channel master data",
            "Website, Facebook, TikTok, YouTube, X, LinkedIn and Internal",
          ],
          ["System data", "Content types, pillars and departments"],
        ].map(([title, description]) => (
          <button key={title}>
            <b>{title}</b>
            <span>{description}</span>
            <i>Open</i>
          </button>
        ))}
      </section>
    </>
  );
}
function Help() {
  return (
    <>
      <SectionHeading eyebrow="GETTING STARTED" title="How to Use" />
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
        ].map(([number, title, description]) => (
          <article key={number} className={styles.card}>
            <b className={styles.helpNumber}>{number}</b>
            <h2>{title}</h2>
            <p>{description}</p>
            <button>Read guide</button>
          </article>
        ))}
      </section>
    </>
  );
}
function RequestModal({
  language,
  requestType,
  setRequestType,
  onClose,
  onSubmit,
}: {
  language: Language;
  requestType: "pr" | "offsite";
  setRequestType: (type: "pr" | "offsite") => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const thai = language === "th";
  return (
    <div className={styles.modalBackdrop} role="presentation">
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-title"
      >
        <header>
          <div>
            <p className={styles.eyebrow}>NEW WORK REQUEST</p>
            <h2 id="request-title">{thai ? "ส่งคำของาน" : "Submit work request"}</h2>
          </div>
          <button onClick={onClose}>Close</button>
        </header>
        <div className={styles.typePicker}>
          <button
            className={requestType === "pr" ? styles.selectedType : ""}
            onClick={() => setRequestType("pr")}
          >
            <b>PR</b>
            <span>
              {thai ? "ผลิตและเผยแพร่เนื้อหา" : "Content production and publication"}
            </span>
          </button>
          <button
            className={requestType === "offsite" ? styles.selectedType : ""}
            onClick={() => setRequestType("offsite")}
          >
            <b>OS</b>
            <span>{thai ? "ลงพื้นที่ / ปฏิบัติงานนอกสถานที่" : "Off-site support"}</span>
          </button>
        </div>
        <div className={styles.formGrid}>
          <label>
            {thai ? "ชื่อโครงการ / กิจกรรม" : "Project / activity"}
            <input />
          </label>
          <label>
            {thai ? "หน่วยงาน" : "Department"}
            <select>
              <option>Communications Office</option>
            </select>
          </label>
          <label>
            {thai ? "เจ้าของโครงการ" : "Project owner"}
            <input defaultValue="PR Lead" />
          </label>
          <label>
            {requestType === "pr"
              ? thai
                ? "วันที่ต้องการเผยแพร่"
                : "Requested publish date"
              : thai
                ? "วันที่ลงพื้นที่"
                : "Off-site date"}
            <input type="date" />
          </label>
          <label className={styles.full}>
            {thai
              ? "ลิงก์ข้อมูลต้นทาง / โฟลเดอร์โครงการ"
              : "Source links / project folder"}
            <input />
          </label>
          {requestType === "pr" ? (
            <>
              <label>
                {thai ? "วัตถุประสงค์การสื่อสาร" : "Communication objective"}
                <textarea />
              </label>
              <label>
                {thai ? "กลุ่มเป้าหมาย" : "Target audience"}
                <textarea />
              </label>
            </>
          ) : (
            <>
              <label>
                {thai ? "เวลาเริ่มต้น" : "Start time"}
                <input type="time" />
              </label>
              <label>
                {thai ? "การเดินทาง" : "Travel arrangement"}
                <select>
                  <option>
                    {thai ? "จองรถของ สทร. สำเร็จแล้ว" : "RTRDA transport confirmed"}
                  </option>
                </select>
              </label>
            </>
          )}
        </div>
        <footer>
          <button onClick={onClose}>Cancel</button>
          <button className={styles.primary} onClick={onSubmit}>
            {thai ? "บันทึกคำขอ" : "Save request"}
          </button>
        </footer>
      </section>
    </div>
  );
}
