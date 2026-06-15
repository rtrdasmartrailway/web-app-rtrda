import { requireUser } from "@/lib/session";
import { asRole, ROLE_LABELS } from "@/lib/permissions";
import { listUsers } from "@/db/queries";
import { RoleSelectForm } from "@/components/manage/role-select-form";
import { NoPermission } from "@/components/manage/no-permission";

export default async function UsersPage() {
  const me = await requireUser();
  if (me.role !== "admin") return <NoPermission />;

  const users = await listUsers();

  return (
    <section className="manage-content">
      <h1 className="manage-title">ผู้ใช้งานและสิทธิ์ (Users &amp; roles)</h1>
      <p className="manage-hint">
        กำหนดบทบาทให้ผู้ใช้แต่ละคน ผู้ใช้ใหม่จะมีสถานะ &quot;ยังไม่ได้รับสิทธิ์&quot; จนกว่าจะได้รับการกำหนดบทบาท
      </p>

      {users.length === 0 ? (
        <p className="manage-hint">ยังไม่มีผู้ใช้ — ผู้ใช้จะถูกสร้างเมื่อเข้าสู่ระบบด้วย Microsoft ครั้งแรก</p>
      ) : (
        <table className="manage-table">
          <thead>
            <tr>
              <th>อีเมล</th>
              <th>ชื่อ</th>
              <th>บทบาทปัจจุบัน</th>
              <th>กำหนดบทบาท</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const role = asRole(u.role);
              return (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.name}</td>
                  <td>{ROLE_LABELS[role]}</td>
                  <td>
                    <RoleSelectForm userId={u.id} currentRole={role} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
