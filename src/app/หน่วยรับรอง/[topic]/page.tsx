import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { buildShellData } from "@/lib/db/page-data";
import { CERTIFICATION_LABEL, certificationPages } from "@/lib/wp/certification";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ topic: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { topic } = await params;
  const page = certificationPages.find((item) => item.slug === topic);
  if (!page) notFound();
  return { title: `${page.label} | RTRDA`, robots: { index: false } };
}

export default async function CertificationPage({ params }: Params) {
  const { topic } = await params;
  const page = certificationPages.find((item) => item.slug === topic);
  if (!page) notFound();
  const path = `/${CERTIFICATION_LABEL}/${page.slug}`;
  const shell = await buildShellData(path);

  return (
    <SiteShell shell={shell}>
      <article className="content-page content-page-certification">
        <section className="page-hero">
          <div className="site-container hero-inner">
            <p className="breadcrumb">
              <Link href="/">หน้าแรก</Link>
              <span>
                {" "}
                / {CERTIFICATION_LABEL} / {page.label}
              </span>
            </p>
            <h1>{page.label}</h1>
          </div>
        </section>
        <div className="site-container content-layout" id="main-content">
          <div className="content-main wp-content">
            <p>อยู่ระหว่างจัดเตรียมข้อมูล</p>
          </div>
        </div>
      </article>
    </SiteShell>
  );
}
