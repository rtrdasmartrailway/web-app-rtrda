"use client";

import { useMemo, useState } from "react";
import {
  buildSurveyHeatmap,
  SURVEY_AREAS,
  type SurveyScope,
} from "@/lib/survey/survey-overlap";

type Response = { sheetRow: number; cells: string[] };
const roleLabels: Record<number, string> = {
  0: "ไม่มีบทบาท",
  1: "ผู้ใช้/ผู้รับประโยชน์",
  2: "สนับสนุน/ร่วมดำเนินการ",
  3: "ดำเนินการโดยตรง",
  4: "ภารกิจหลัก/บทบาทนำ",
};
const scopes: { value: SurveyScope; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "mohe", label: "เกี่ยวข้อง อว." },
  { value: "nonmohe", label: "ไม่เกี่ยวข้อง อว." },
];

export default function SurveyHeatmap({
  headers,
  responses,
  onOpenResponse,
}: {
  headers: string[];
  responses: Response[];
  onOpenResponse: (sheetRow: number) => void;
}) {
  const [scope, setScope] = useState<SurveyScope>("all");
  const [selected, setSelected] = useState<{
    sheetRow: number;
    areaIndex: number;
  } | null>(null);
  const data = useMemo(
    () => buildSurveyHeatmap(headers, responses, scope),
    [headers, responses, scope],
  );
  const selectedRow = data.rows.find((row) => row.sheetRow === selected?.sheetRow);
  const selectedArea = selectedRow?.areas[selected?.areaIndex ?? -1];

  return (
    <section className="survey-heatmap" aria-labelledby="survey-heatmap-title">
      <div className="survey-heatmap-heading">
        <div>
          <span className="survey-heatmap-kicker">RTRDA / FUNCTIONAL SIMILARITY</span>
          <h2 id="survey-heatmap-title">Heat map กิจกรรมร่วม</h2>
          <p>
            แถวคือหน่วยงาน · คอลัมน์คือ 5 ประเภทกิจกรรมของ สทร. · แต่ละช่องรวมคะแนนบทบาท 6
            กิจกรรม (กิจกรรมละ 0–4 คะแนน) · เต็ม 24 คะแนนต่อประเภท
          </p>
        </div>
        <div className="survey-heatmap-counter">
          <strong>{data.rows.length}</strong>
          <span>หน่วยงานที่แสดง</span>
        </div>
      </div>
      <div
        className="survey-heatmap-filters"
        role="group"
        aria-label="กรองหน่วยงานตามความเกี่ยวข้องกับ อว."
      >
        {scopes.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={scope === option.value}
            onClick={() => {
              setScope(option.value);
              setSelected(null);
            }}
          >
            {option.label}
            <span>
              {option.value === "all"
                ? data.scopeCounts.mohe +
                  data.scopeCounts.nonmohe +
                  data.scopeCounts.unknown
                : data.scopeCounts[option.value]}
            </span>
          </button>
        ))}
      </div>
      <div className="survey-heatmap-legend" aria-label="คำอธิบายสี">
        <span>
          <i className="survey-heat-level-0" /> 0 / 24
        </span>
        <span>
          <i className="survey-heat-level-1" /> 1–8 / 24
        </span>
        <span>
          <i className="survey-heat-level-2" /> 9–16 / 24
        </span>
        <span>
          <i className="survey-heat-level-3" /> 17–24 / 24
        </span>
        <span>
          <i className="survey-heat-level-missing" /> ไม่มีคำตอบ
        </span>
      </div>
      <div
        className="survey-heatmap-scroll"
        role="region"
        aria-label="ตาราง heat map หน่วยงานตามประเภทกิจกรรม"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">หน่วยงาน</th>
              {SURVEY_AREAS.map((area, index) => (
                <th scope="col" key={area.label}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {area.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.sheetRow}>
                <th scope="row">
                  <span>{row.name}</span>
                  {row.affiliation === "unknown" && <small>รอตรวจสังกัด</small>}
                </th>
                {row.areas.map((area, index) => {
                  const level =
                    area.answered === 0
                      ? "missing"
                      : area.scoreSum === 0
                        ? "0"
                        : area.scoreSum <= 8
                          ? "1"
                          : area.scoreSum <= 16
                            ? "2"
                            : "3";
                  return (
                    <td key={area.label}>
                      <button
                        type="button"
                        className={`survey-heat-cell survey-heat-level-${level}${selected?.sheetRow === row.sheetRow && selected.areaIndex === index ? " survey-heat-selected" : ""}`}
                        aria-label={`${row.name} — ${area.label}: คะแนนรวม ${area.scoreSum} จาก 24, ตอบ ${area.answered} จาก 6 กิจกรรม`}
                        aria-pressed={
                          selected?.sheetRow === row.sheetRow &&
                          selected.areaIndex === index
                        }
                        onClick={() =>
                          setSelected({ sheetRow: row.sheetRow, areaIndex: index })
                        }
                      >
                        <strong>{area.answered === 0 ? "—" : area.scoreSum}</strong>
                        <span>/ 24</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.rows.length && (
          <p className="survey-heatmap-empty">ยังไม่มีหน่วยงานในตัวกรองนี้</p>
        )}
      </div>
      {selectedRow && selectedArea && (
        <div
          className="survey-heatmap-detail"
          role="region"
          aria-label={`รายละเอียด ${selectedRow.name} ด้าน${selectedArea.label}`}
        >
          <div className="survey-heatmap-detail-head">
            <div>
              <span>รายละเอียดช่องที่เลือก</span>
              <h3>{selectedRow.name}</h3>
              <p>
                {selectedArea.label} · คะแนนรวม {selectedArea.scoreSum} / 24 · ตอบ{" "}
                {selectedArea.answered} จาก 6 กิจกรรม
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="ปิดรายละเอียด heat map"
            >
              ✕
            </button>
          </div>
          <ul>
            {selectedArea.activities.map((activity) => (
              <li
                key={activity.column}
                className={
                  activity.score !== null && activity.score >= 3
                    ? "survey-heatmap-direct"
                    : ""
                }
              >
                <span>{activity.title}</span>
                <strong>
                  {activity.score === null
                    ? "ไม่ตอบ"
                    : `${activity.score} · ${roleLabels[activity.score]}`}
                </strong>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="survey-heatmap-open"
            onClick={() => onOpenResponse(selectedRow.sheetRow)}
          >
            ดูคำตอบและข้อเสนอแนะทั้งหมด ↗
          </button>
        </div>
      )}
      <p className="survey-heatmap-footnote">
        คะแนนรวมเป็นผลบวกบทบาทที่ผู้ตอบประเมินตนเอง 6 กิจกรรม (0–4 คะแนนต่อกิจกรรม)
        ไม่ใช่ข้อสรุปว่าโครงการหรืองบประมาณซ้ำซ้อน · ใช้คำตอบล่าสุดต่อชื่อหน่วยงาน ·
        จัดกลุ่ม อว./ไม่ใช่ อว. ตามช่องต้นสังกัดที่ระบุชัดเจนเท่านั้น
        {data.scopeCounts.unknown
          ? ` · สังกัดไม่ชัดเจน ${data.scopeCounts.unknown} หน่วยงาน แสดงเฉพาะใน “ทั้งหมด”`
          : ""}
      </p>
    </section>
  );
}
