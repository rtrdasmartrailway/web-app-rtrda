import type { Metadata } from "next";
import SurveyDashboard from "./survey-dashboard";
import "./survey-dashboard.css";

export const metadata: Metadata = {
  title: "ภาพรวมผลสำรวจ | RTRDA INTRANET",
  description: "ภาพรวมผลสำรวจความคิดเห็นด้านเทคโนโลยีระบบรางในรูปแบบข้อมูลสรุป",
};

export default function SurveyDashboardPage() {
  return <SurveyDashboard />;
}
