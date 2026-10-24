import { headers } from "next/headers";
import Link from "next/link";
import { requireActivityAdmin } from "@/lib/analytics/activity-auth";
import ActivityLog from "./activity-log";
import "./activity-log.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "บันทึกการใช้งานเว็บไซต์ | RTRDA",
  robots: { index: false, follow: false },
};
export default async function ActivityLogPage() {
  const denied = await requireActivityAdmin(await headers());
  if (denied)
    return (
      <section className="activity-log">
        <span className="activity-badge">RTRDA · ผู้ดูรายงาน</span>
        <h1>บันทึกการใช้งานเว็บไซต์</h1>
        <p>
          {denied.status === 403
            ? "บัญชีนี้ไม่มีสิทธิ์ดูรายงานกิจกรรม"
            : "กรุณาเข้าสู่ระบบเพื่อดูรายงานกิจกรรม"}
        </p>
        <Link href="/api/analytics/activity-auth/login">เข้าสู่ระบบรายงานกิจกรรม</Link>
      </section>
    );
  return <ActivityLog />;
}
