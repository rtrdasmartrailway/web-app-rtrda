"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";

const DEV_AUTH_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";

export function IntranetAuthNav() {
  const { data: session, isPending } = useSession();

  // Avoid a login→manage flip: render an empty slot until the session is known.
  if (!DEV_AUTH_BYPASS && isPending) {
    return <span className="intranet-auth-slot" aria-hidden="true" />;
  }

  if (DEV_AUTH_BYPASS || session?.user) {
    return (
      <Link
        href="/rtrdaintranet/manage"
        className="intranet-auth-btn intranet-auth-btn-primary"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 5h16M4 12h16M4 19h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        จัดการเนื้อหา
      </Link>
    );
  }

  return (
    <Link
      href="/rtrdaintranet/login"
      className="intranet-auth-btn intranet-auth-btn-outline"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M10 17l5-5-5-5M15 12H3M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      เข้าสู่ระบบ
    </Link>
  );
}
