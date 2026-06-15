export function NoPermission() {
  return (
    <div className="manage-noaccess">
      <h2>ไม่มีสิทธิ์เข้าถึง</h2>
      <p>บทบาทของคุณไม่ได้รับอนุญาตให้จัดการเนื้อหาส่วนนี้ (insufficient permission)</p>
    </div>
  );
}
