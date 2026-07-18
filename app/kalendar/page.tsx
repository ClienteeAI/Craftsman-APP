"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listJobs, restoreIfEmpty, STATUS, type Job } from "@/lib/crm/jobs";

/**
 * Kalendár zákaziek. „Kedy kam idem."
 *
 * Mesačný pohľad — každá zákazka s termínom realizácie (startAt) sedí na svojom
 * dni; ak má vyplnenú dĺžku (details.durationDays), zaberá aj nasledujúce dni.
 * Majster hneď vidí, čo ho kedy čaká.
 */

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];
const MONTHS = [
  "Január", "Február", "Marec", "Apríl", "Máj", "Jún",
  "Júl", "August", "September", "Október", "November", "December",
];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function Kalendar() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cursor, setCursor] = useState({ y: 0, m: 0 });

  useEffect(() => {
    const now = new Date();
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
    function refresh() {
      setJobs(listJobs().filter((j) => j.startAt));
    }
    refresh();
    void restoreIfEmpty().then((r) => r.length > 0 && refresh());
  }, []);

  // Rozvrhne zákazky na jednotlivé dni (start + trvanie).
  const byDay = useMemo(() => {
    const map = new Map<number, { job: Job; isStart: boolean }[]>();
    for (const j of jobs) {
      if (!j.startAt) continue;
      const start = startOfDay(new Date(j.startAt));
      const dur = Math.max(1, Number(j.details?.durationDays) || 1);
      for (let k = 0; k < dur; k++) {
        const day = new Date(start.getTime() + k * DAY_MS).getTime();
        const arr = map.get(day) ?? [];
        arr.push({ job: j, isStart: k === 0 });
        map.set(day, arr);
      }
    }
    return map;
  }, [jobs]);

  const { y, m } = cursor;
  const first = new Date(y, m, 1);
  const startWeekday = (first.getDay() + 6) % 7; // pondelok = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayKey = startOfDay(new Date()).getTime();

  // Buňky mřížky (vč. úvodních prázdných).
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const d = new Date(y, m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }
  function today() {
    const n = new Date();
    setCursor({ y: n.getFullYear(), m: n.getMonth() });
  }

  const upcoming = jobs
    .filter((j) => new Date(j.startAt!).getTime() >= todayKey)
    .sort((a, b) => a.startAt!.localeCompare(b.startAt!))
    .slice(0, 5);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        {/* Horní lišta */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/prehlad" className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900">
              ← Prehľad
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">Kalendár realizácií</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={today} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium shadow-soft transition hover:bg-neutral-50">
              Dnes
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => shift(-1)} aria-label="Predošlý mesiac" className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white shadow-soft transition hover:bg-neutral-50">
                ‹
              </button>
              <span className="w-40 text-center text-sm font-semibold">
                {MONTHS[m]} {y}
              </span>
              <button onClick={() => shift(1)} aria-label="Ďalší mesiac" className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white shadow-soft transition hover:bg-neutral-50">
                ›
              </button>
            </div>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
          {/* Mřížka měsíce */}
          <section className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-soft">
            <div className="grid grid-cols-7 border-b border-neutral-100 text-center text-xs font-medium uppercase tracking-wider text-neutral-400">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-2.5">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((date, i) => {
                if (!date) return <div key={i} className="min-h-24 border-b border-r border-neutral-50 bg-neutral-50/40" />;
                const key = date.getTime();
                const items = byDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <div key={i} className="min-h-24 border-b border-r border-neutral-50 p-1.5">
                    <div className={`mb-1 text-right text-xs ${isToday ? "font-bold text-brand-700" : "text-neutral-400"}`}>
                      {isToday ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                          {date.getDate()}
                        </span>
                      ) : (
                        date.getDate()
                      )}
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 3).map(({ job, isStart }, n) => (
                        <Link
                          key={n}
                          href={`/zakazky/${job.id}`}
                          className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            isStart ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-800"
                          }`}
                          title={`${job.customer.name ?? "Bez mena"}${job.customer.obec ? " · " + job.customer.obec : ""}`}
                        >
                          {isStart ? "▸ " : ""}
                          {job.customer.name ?? job.customer.obec ?? "Zákazka"}
                        </Link>
                      ))}
                      {items.length > 3 && (
                        <span className="block px-1.5 text-[10px] text-neutral-400">+{items.length - 3} ďalšie</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Nadchádzajúce */}
          <aside className="space-y-4">
            <section className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-soft">
              <h2 className="text-sm font-semibold">Nadchádzajúce realizácie</h2>
              {upcoming.length === 0 ? (
                <p className="mt-3 text-sm text-neutral-400">
                  Zatiaľ nič naplánované. Termín nastavíš v detaile zákazky.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {upcoming.map((j) => (
                    <Link key={j.id} href={`/zakazky/${j.id}`} className="block">
                      <p className="truncate text-sm font-medium">{j.customer.name ?? "Bez mena"}</p>
                      <p className="text-xs text-neutral-500">
                        {new Date(j.startAt!).toLocaleDateString("sk-SK", { day: "numeric", month: "long" })}
                        {j.details?.durationDays ? ` · ${j.details.durationDays} dní` : ""}
                        {j.customer.obec ? ` · ${j.customer.obec}` : ""}
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium">
                        {STATUS[j.status].dot} {STATUS[j.status].label}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
