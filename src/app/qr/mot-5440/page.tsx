import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QR แบบฟอร์ม MOT 5440 | RTRDA",
  description: "QR Code สำหรับเข้าถึงแบบฟอร์มพร้อมบันทึกสถิติการเข้าชมแบบไม่ระบุตัวบุคคล",
};

const trackingUrl = "/r/mot-5440?src=web_qr";
const formTitle = "แบบฟอร์ม MOT 5440";

export default function Mot5440QrPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", padding: "48px 20px" }}>
      <section
        style={{
          margin: "0 auto",
          maxWidth: 760,
          borderRadius: 24,
          background: "#ffffff",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.12)",
          padding: "40px 28px",
          textAlign: "center",
          color: "#0f172a",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#2563eb",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          RTRDA
        </p>
        <h1
          style={{
            margin: "12px 0 8px",
            fontSize: "clamp(28px, 5vw, 44px)",
            lineHeight: 1.15,
          }}
        >
          {formTitle}
        </h1>
        <p
          style={{
            margin: "0 auto 28px",
            maxWidth: 560,
            color: "#475569",
            fontSize: 18,
            lineHeight: 1.7,
          }}
        >
          สแกน QR Code หรือกดปุ่มด้านล่างเพื่อไปยัง Google Form
          ระบบจะบันทึกเฉพาะสถิติการเข้าชมแบบไม่ระบุตัวบุคคลก่อนส่งต่อไปยังแบบฟอร์ม
        </p>

        <div
          style={{
            display: "inline-flex",
            borderRadius: 28,
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            padding: 18,
          }}
        >
          <img
            src="/qr/mot-5440.png"
            alt="QR Code สำหรับเข้าสู่แบบฟอร์ม MOT 5440"
            width={280}
            height={280}
            style={{ borderRadius: 16, background: "white" }}
          />
        </div>

        <div style={{ marginTop: 28 }}>
          <a
            href={trackingUrl}
            style={{
              display: "inline-block",
              borderRadius: 999,
              background: "#1d4ed8",
              color: "white",
              padding: "14px 24px",
              fontSize: 18,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            เปิดแบบฟอร์ม
          </a>
        </div>

        <p
          style={{
            margin: "24px auto 0",
            maxWidth: 560,
            color: "#64748b",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          ข้อมูลที่บันทึก: วันเวลา, แหล่งที่มา, ประเภทอุปกรณ์, user agent, referrer และ IP
          แบบ hash เพื่อใช้วิเคราะห์จำนวนการเข้าชมเท่านั้น
        </p>
      </section>
    </main>
  );
}
