import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canManage, isContentResource } from "@/lib/permissions";
import { getContentForm } from "@/lib/content-config";
import { getContentById, getMediaById } from "@/db/queries";
import { updateContentAction } from "@/app/rtrdaintranet/manage/actions";
import { ContentForm } from "@/components/manage/content-form";
import { NoPermission } from "@/components/manage/no-permission";

type Attachment = { name: string; path: string; mimeType: string };

function toDateTimeLocal(value: unknown): string {
  if (!value) return "";
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return "";
  // Render in local time for the datetime-local input.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const { resource, id } = await params;
  if (!isContentResource(resource)) notFound();
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) notFound();

  const user = await requireUser();
  if (!canManage(user.role, resource)) return <NoPermission />;

  const config = getContentForm(resource);
  const row = (await getContentById(resource, numId)) as Record<string, unknown> | null;
  if (!row) notFound();

  // Build string initial values for the generic form fields.
  const initialValues: Record<string, string> = {};
  for (const field of config.fields) {
    if (field.type === "datetime") {
      initialValues[field.name] = toDateTimeLocal(row[field.name]);
    } else {
      const v = row[field.name];
      initialValues[field.name] = v == null ? "" : String(v);
    }
  }

  const featuredImageId = (row.featuredImageId as number | null) ?? null;
  const featuredMedia = featuredImageId ? await getMediaById(featuredImageId) : null;
  const attachments = (row.attachments as Attachment[] | undefined) ?? [];

  return (
    <section className="manage-content">
      <h1 className="manage-title">แก้ไข{config.label}</h1>
      <ContentForm
        resource={resource}
        fields={config.fields}
        hasFeaturedImage={config.hasFeaturedImage}
        action={updateContentAction.bind(null, resource, numId)}
        initialValues={initialValues}
        initialFeaturedImageId={featuredImageId}
        initialFeaturedImagePath={featuredMedia?.filePath ?? null}
        initialAttachments={attachments}
        submitLabel="บันทึก"
      />
    </section>
  );
}
