import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canManage, isContentResource } from "@/lib/permissions";
import { getContentForm } from "@/lib/content-config";
import { listContentForAdmin, type ContentRow } from "@/db/queries";
import { deleteContentAction } from "@/app/rtrdaintranet/manage/actions";
import { DeleteButton } from "@/components/manage/delete-button";
import { NoPermission } from "@/components/manage/no-permission";

function fmtDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("th-TH");
}

// All content rows are bilingual; show the Thai title, falling back to English.
function rowTitle(row: { titleTh?: string; titleEn?: string }): string {
  return row.titleTh || row.titleEn || "—";
}

export default async function ResourceListPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  if (!isContentResource(resource)) notFound();

  const user = await requireUser();
  if (!canManage(user.role, resource)) return <NoPermission />;

  const config = getContentForm(resource);
  const rows = (await listContentForAdmin(resource)) as Array<
    ContentRow & { category?: string; publishedAt?: unknown; updatedAt?: unknown }
  >;

  return (
    <section className="manage-content">
      <div className="manage-list-header">
        <h1 className="manage-title">{config.label}</h1>
        <Link
          href={`/rtrdaintranet/manage/${resource}/new`}
          className="manage-btn manage-btn-primary"
        >
          + เพิ่มใหม่
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="manage-hint">ยังไม่มีรายการ</p>
      ) : (
        <table className="manage-table">
          <thead>
            <tr>
              <th>หัวข้อ</th>
              <th>หมวดหมู่</th>
              <th>เผยแพร่</th>
              <th>แก้ไขล่าสุด</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className="manage-row-title">{rowTitle(row)}</span>
                  <span className="manage-row-slug">/{row.slug}</span>
                </td>
                <td>{row.category || "—"}</td>
                <td>{fmtDate(row.publishedAt)}</td>
                <td>{fmtDate(row.updatedAt)}</td>
                <td className="manage-row-actions">
                  <Link
                    href={`/rtrdaintranet/manage/${resource}/${row.id}/edit`}
                    className="manage-btn manage-btn-ghost"
                  >
                    แก้ไข
                  </Link>
                  <DeleteButton
                    label={rowTitle(row)}
                    action={deleteContentAction.bind(null, resource, row.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
