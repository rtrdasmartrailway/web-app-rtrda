import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import {
  allowedResources,
  isAdmin,
  RESOURCE_LABELS,
  ROLE_LABELS,
} from "@/lib/permissions";
import { SignOutButton } from "@/components/manage/sign-out-button";

export const metadata: Metadata = { title: "จัดการเนื้อหา — RTRDA INTRANET" };

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const resources = allowedResources(user.role);

  return (
    <div className="manage-shell">
      <div className="manage-topbar">
        <div className="manage-topbar-user">
          <strong>จัดการเนื้อหา</strong>
          <span className="manage-hint">
            {user.name} · {ROLE_LABELS[user.role]}
          </span>
        </div>
        <SignOutButton />
      </div>

      {user.role === "none" ? (
        <div className="manage-content">
          <div className="manage-noaccess">
            <h2>บัญชีของคุณยังไม่ได้รับสิทธิ์</h2>
            <p>
              บัญชี {user.email} เข้าสู่ระบบสำเร็จแล้ว แต่ยังไม่ได้รับสิทธิ์ในการจัดการเนื้อหา
              กรุณาติดต่อผู้ดูแลระบบ (admin) เพื่อขอกำหนดบทบาท
            </p>
          </div>
        </div>
      ) : (
        <div className="manage-body">
          <nav className="manage-nav" aria-label="Manage navigation">
            <Link href="/rtrdaintranet/manage" className="manage-nav-link">
              หน้าหลัก
            </Link>
            {resources.map((r) => (
              <Link key={r} href={`/rtrdaintranet/manage/${r}`} className="manage-nav-link">
                {RESOURCE_LABELS[r]}
              </Link>
            ))}
            {isAdmin(user.role) && (
              <Link href="/rtrdaintranet/manage/users" className="manage-nav-link">
                ผู้ใช้งาน (Users)
              </Link>
            )}
          </nav>
          <main className="manage-main">{children}</main>
        </div>
      )}
    </div>
  );
}
