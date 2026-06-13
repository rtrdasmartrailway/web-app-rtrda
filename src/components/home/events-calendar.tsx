"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CalendarDay } from "@/lib/db/queries";
import type { WpLanguage } from "@/lib/wp/types";

const MONTHS: Record<WpLanguage, string[]> = {
  th: [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

// Week starts on Monday, matching the original WordPress calendar.
const WEEKDAYS: Record<WpLanguage, string[]> = {
  th: ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

function mondayFirstIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function EventsCalendar({
  days,
  language,
}: {
  days: CalendarDay[];
  language: WpLanguage;
}) {
  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of days) {
      map.set(day.day, day);
    }
    return map;
  }, [days]);

  // Start on the most recent month that has posts so the calendar opens on
  // content; fall back to today if there are none.
  const latest = days[0]?.day ?? new Date().toISOString().slice(0, 10);
  const [year, setYear] = useState(() => Number(latest.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(latest.slice(5, 7)) - 1);

  const todayKey = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = mondayFirstIndex(firstOfMonth);

  const cells: Array<number | null> = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  const labels =
    language === "th"
      ? { prev: "เดือนก่อนหน้า", next: "เดือนถัดไป" }
      : { prev: "Previous month", next: "Next month" };

  return (
    <div className="events-calendar">
      <div className="calendar-head">
        <button type="button" onClick={() => shift(-1)} aria-label={labels.prev}>
          <span className="cal-arrow cal-arrow-left" aria-hidden="true" />
        </button>
        <strong>
          {MONTHS[language][month]} {year}
        </strong>
        <button type="button" onClick={() => shift(1)} aria-label={labels.next}>
          <span className="cal-arrow cal-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <div className="calendar-grid calendar-weekdays">
        {WEEKDAYS[language].map((label) => (
          <span key={label} className="calendar-weekday">
            {label}
          </span>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((d, index) => {
          if (d === null) {
            return <span key={`empty-${index}`} className="calendar-cell is-empty" />;
          }
          const key = `${year}-${pad(month + 1)}-${pad(d)}`;
          const entry = dayMap.get(key);
          const isToday = key === todayKey;
          const className = `calendar-cell${entry ? " has-posts" : ""}${
            isToday ? " is-today" : ""
          }`;
          if (entry) {
            return (
              <Link key={key} href={entry.path} className={className} title={key}>
                {d}
                {entry.count > 1 ? (
                  <span className="calendar-count">{entry.count}</span>
                ) : null}
              </Link>
            );
          }
          return (
            <span key={key} className={className}>
              {d}
            </span>
          );
        })}
      </div>
    </div>
  );
}
