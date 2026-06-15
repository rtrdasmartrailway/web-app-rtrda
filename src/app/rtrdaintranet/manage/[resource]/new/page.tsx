import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canManage, isContentResource } from "@/lib/permissions";
import { getContentForm } from "@/lib/content-config";
import { createContentAction } from "@/app/rtrdaintranet/manage/actions";
import { ContentForm } from "@/components/manage/content-form";
import { NoPermission } from "@/components/manage/no-permission";

export default async function NewContentPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  if (!isContentResource(resource)) notFound();

  const user = await requireUser();
  if (!canManage(user.role, resource)) return <NoPermission />;

  const config = getContentForm(resource);

  return (
    <section className="manage-content">
      <h1 className="manage-title">เพิ่ม{config.label}</h1>
      <ContentForm
        resource={resource}
        fields={config.fields}
        hasFeaturedImage={config.hasFeaturedImage}
        action={createContentAction.bind(null, resource)}
        submitLabel="สร้าง"
      />
    </section>
  );
}
