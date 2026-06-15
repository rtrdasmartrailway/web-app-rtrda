import Link from "next/link";
import { requireUser } from "@/lib/session";
import { allowedResources, isAdmin, RESOURCE_LABELS } from "@/lib/permissions";

export default async function ManageDashboard() {
  const user = await requireUser();
  const resources = allowedResources(user.role);

  return (
    <section className="manage-content">
      <h1 className="manage-title">แดชบอร์ดจัดการเนื้อหา</h1>
      <p className="manage-hint">เลือกประเภทเนื้อหาที่ต้องการจัดการ</p>

      <div className="manage-card-grid">
        {resources.map((r) => (
          <Link key={r} href={`/rtrdaintranet/manage/${r}`} className="manage-card">
            <span className="manage-card-title">{RESOURCE_LABELS[r]}</span>
            <span className="manage-card-cta">จัดการ →</span>
          </Link>
        ))}
        {isAdmin(user.role) && (
          <Link href="/rtrdaintranet/manage/users" className="manage-card">
            <span className="manage-card-title">ผู้ใช้งานและสิทธิ์ (Users &amp; roles)</span>
            <span className="manage-card-cta">จัดการ →</span>
          </Link>
        )}
      </div>
    </section>
  );
}
