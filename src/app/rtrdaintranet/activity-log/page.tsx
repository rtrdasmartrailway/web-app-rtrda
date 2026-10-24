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
        <span className="activity-badge">RTRDA · ผู้ดูแลระบบ</span>
        <h1>บันทึกการใช้งานเว็บไซต์</h1>
        <p>
          {denied.status === 403
            ? "ต้องใช้สิทธิ์ผู้ดูแลระบบส่วนกลาง"
            : "กรุณาเข้าสู่ระบบ PR Center ด้วยบัญชีผู้ดูแลระบบ แล้วกลับมาที่หน้านี้"}
        </p>
        <Link href="/rtrdaintranet/prcenter">เข้าสู่ระบบ PR Center</Link>
      </section>
    );
  return <ActivityLog />;
}
