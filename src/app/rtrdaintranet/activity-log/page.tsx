import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActivityAdmin } from "@/lib/analytics/activity-auth";
import ActivityLog from "./activity-log";
import "./activity-log.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "บันทึกการใช้งานเว็บไซต์ | RTRDA",
  robots: { index: false, follow: false },
};
export default async function ActivityLogPage() {
  if (process.env.ACTIVITY_REPORT_ENABLED === "false") notFound();
  const production = process.env.ANALYTICS_ENV === "production";
  const denied = await requireActivityAdmin(await headers());
  if (denied)
    return (
      <section className="activity-log">
        <span className="activity-badge">
          {production ? "RTRDA · ผู้ดูรายงาน" : "TEST · ผู้ดูแลระบบ"}
        </span>
        <h1>บันทึกการใช้งานเว็บไซต์</h1>
        <p>
          {denied.status === 403
            ? production
              ? "บัญชีนี้ไม่มีสิทธิ์ดูรายงานกิจกรรม"
              : "ต้องใช้สิทธิ์ผู้ดูแลระบบส่วนกลาง"
            : production
              ? "กรุณาเข้าสู่ระบบเพื่อดูรายงานกิจกรรม"
              : "กรุณาเข้าสู่ระบบ PR Center ด้วยบัญชีผู้ดูแลระบบ แล้วกลับมาที่หน้านี้"}
        </p>
        <Link
          href={
            production ? "/api/analytics/activity-auth/login" : "/rtrdaintranet/prcenter"
          }
        >
          {production ? "เข้าสู่ระบบรายงานกิจกรรม" : "เข้าสู่ระบบ PR Center"}
        </Link>
      </section>
    );
  return <ActivityLog productionMode={production} />;
}
