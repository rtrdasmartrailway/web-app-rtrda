import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginButton } from "@/components/manage/login-button";

export const metadata: Metadata = { title: "เข้าสู่ระบบ — RTRDA INTRANET" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectTo } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(redirectTo || "/rtrdaintranet/manage");

  const safeRedirect =
    redirectTo && redirectTo.startsWith("/rtrdaintranet/") ? redirectTo : undefined;

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <Image
            src="/intranet/icons/Logo_RTRDA-1.png"
            alt="RTRDA"
            width={72}
            height={64}
            className="login-logo"
            priority
          />
          <div className="login-brand-text">
            <span className="login-brand-en">RTRDA Intranet</span>
            <span className="login-brand-th">สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง</span>
          </div>
        </div>

        <div className="login-headings">
          <h1 className="login-title">ระบบจัดการเนื้อหา</h1>
          <p className="login-subtitle">
            เข้าสู่ระบบด้วยบัญชี Microsoft ขององค์กร เพื่อจัดการข่าวสาร ประกาศจัดซื้อจัดจ้าง
            เอกสารเผยแพร่ และผลงานโครงการ
          </p>
        </div>

        <LoginButton redirectTo={safeRedirect} />

        <p className="login-note">
          <svg
            className="login-note-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <path d="M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="7.5" r="1.25" fill="currentColor" />
          </svg>
          สิทธิ์การจัดการเนื้อหากำหนดโดยผู้ดูแลระบบ หากเข้าสู่ระบบครั้งแรก
          กรุณาติดต่อผู้ดูแลเพื่อรับสิทธิ์ตามบทบาทของคุณ
        </p>
      </div>

      <p className="login-footer-note">
        เฉพาะเจ้าหน้าที่ สทร. เท่านั้น · For RTRDA staff only
      </p>
    </div>
  );
}
