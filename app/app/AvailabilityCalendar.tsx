"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

type AvailabilityRule = { weekday: number; start: string; end: string; timezone?: string };

const keyFor = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const dateFor = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day, 12));
const dayLabel = (value: string) => new Intl.DateTimeFormat("en-BS", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const timeLabel = (value: string) => {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return new Intl.DateTimeFormat("en-BS", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 1, hours, minutes)));
};

export function AvailabilityCalendar({ availability }: { availability: AvailabilityRule[]; updatedAt?: string }) {
  const seed = useMemo(() => {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Nassau", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    return new Date(`${day}T12:00:00Z`);
  }, []);
  const todayKey = seed.toISOString().slice(0, 10);
  const [visibleMonth, setVisibleMonth] = useState(() => ({ year: seed.getUTCFullYear(), month: seed.getUTCMonth() }));
  const [selectedDate, setSelectedDate] = useState(() => {
    const seedDay = seed.getUTCDate();
    const days = new Date(Date.UTC(seed.getUTCFullYear(), seed.getUTCMonth() + 1, 0)).getUTCDate();
    for (let day = seedDay; day <= days; day += 1) {
      const key = keyFor(seed.getUTCFullYear(), seed.getUTCMonth(), day);
      if (key >= todayKey && availability.some((rule) => rule.weekday === dateFor(seed.getUTCFullYear(), seed.getUTCMonth(), day).getUTCDay())) return key;
    }
    return "";
  });
  const availableWeekdays = useMemo(() => new Set(availability.map((rule) => rule.weekday)), [availability]);
  const firstWeekday = dateFor(visibleMonth.year, visibleMonth.month, 1).getUTCDay();
  const daysInMonth = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + 1, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("en-BS", { month: "long", year: "numeric", timeZone: "UTC" }).format(dateFor(visibleMonth.year, visibleMonth.month, 1));
  const selectedWeekday = selectedDate ? new Date(`${selectedDate}T12:00:00Z`).getUTCDay() : -1;
  const selectedRules = availability.filter((rule) => rule.weekday === selectedWeekday);

  const atCurrentMonth = visibleMonth.year === seed.getUTCFullYear() && visibleMonth.month === seed.getUTCMonth();
  const moveMonth = (delta: number) => {
    if (delta < 0 && atCurrentMonth) return;
    const next = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + delta, 1));
    const nextYear = next.getUTCFullYear();
    const nextMonth = next.getUTCMonth();
    const nextDays = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
    let nextSelection = "";
    for (let day = 1; day <= nextDays; day += 1) {
      const key = keyFor(nextYear, nextMonth, day);
      if (key >= todayKey && availableWeekdays.has(dateFor(nextYear, nextMonth, day).getUTCDay())) { nextSelection = key; break; }
    }
    setVisibleMonth({ year: nextYear, month: nextMonth });
    setSelectedDate(nextSelection);
  };

  return <div className="care-availability-calendar">
    <header>
      <div><span>Recurring hours by date</span><h3>{monthLabel}</h3></div>
      <nav aria-label="Change availability month"><button type="button" disabled={atCurrentMonth} onClick={() => moveMonth(-1)} aria-label="Previous month"><ChevronLeft /></button><button type="button" onClick={() => moveMonth(1)} aria-label="Next month"><ChevronRight /></button></nav>
    </header>
    <div className="care-calendar-weekdays" aria-hidden="true">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className="care-calendar-grid" role="group" aria-label={`${monthLabel} recurring schedule`}>
      {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
      {Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const key = keyFor(visibleMonth.year, visibleMonth.month, day);
        const recurringAvailable = availableWeekdays.has(dateFor(visibleMonth.year, visibleMonth.month, day).getUTCDay());
        const available = recurringAvailable && key >= todayKey;
        return <button type="button" key={key} disabled={!available} className={`${available ? "available" : ""} ${key === selectedDate ? "selected" : ""} ${key === todayKey ? "today" : ""}`} onClick={() => setSelectedDate(key)} aria-label={`${dayLabel(key)}${available ? ", recurring hours listed" : key < todayKey ? ", past date" : ", no recurring hours listed"}`} aria-pressed={key === selectedDate}>{day}{available && <i />}</button>;
      })}
    </div>
    {selectedDate && selectedRules.length > 0 ? <div className="care-calendar-selection" role="status"><CheckCircle2 /><div><b>Listed hours for {dayLabel(selectedDate)}</b>{selectedRules.map((rule) => <span key={`${rule.start}-${rule.end}`}><Clock3 />{timeLabel(rule.start)} – {timeLabel(rule.end)} · {rule.timezone || "America/Nassau"}</span>)}</div></div> : <div className="care-calendar-selection empty"><Clock3 /><div><b>No recurring hours listed for the remaining dates in this month</b><span>Try another month or ask the provider about your requested schedule.</span></div></div>}
    <p>These are recurring hours, not live booking availability. Existing bookings, time off and date-specific changes are not reflected. Confirm the exact date and time with the provider before booking.</p>
  </div>;
}
