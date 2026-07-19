"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createJob, listJobs, restoreIfEmpty, STATUS, updateJob, type Job } from "@/lib/crm/jobs";

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
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [cursor, setCursor] = useState({ y: 0, m: 0 });
  // Den, na který plánujeme (klik do kalendáře otevře okno).
  const [dayModal, setDayModal] = useState<Date | null>(null);

  function refresh() {
    const all = listJobs();
    setAllJobs(all);
    setJobs(all.filter((j) => j.startAt));
  }

  useEffect(() => {
    const now = new Date();
    setCursor({ y: now.getFullYear(), m: now.getMonth() });
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
            <button onClick={today} className="rounded-lg border border-neutral-200 bg-card px-3 py-1.5 text-sm font-medium shadow-soft transition hover:bg-neutral-50">
              Dnes
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => shift(-1)} aria-label="Predošlý mesiac" className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-card shadow-soft transition hover:bg-neutral-50">
                ‹
              </button>
              <span className="w-40 text-center text-sm font-semibold">
                {MONTHS[m]} {y}
              </span>
              <button onClick={() => shift(1)} aria-label="Ďalší mesiac" className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-card shadow-soft transition hover:bg-neutral-50">
                ›
              </button>
            </div>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
          {/* Mřížka měsíce */}
          <section className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-card shadow-soft">
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
                  <div
                    key={i}
                    onClick={() => setDayModal(date)}
                    className="group min-h-24 cursor-pointer border-b border-r border-neutral-50 p-1.5 transition hover:bg-brand-50/40"
                  >
                    <div className={`mb-1 flex items-center justify-between text-xs ${isToday ? "font-bold text-brand-700" : "text-neutral-400"}`}>
                      {/* Tichý „+" na hover — napoví, že sa dá klepnúť a naplánovať. */}
                      <span className="opacity-0 transition group-hover:opacity-100" aria-hidden>
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[11px] leading-none text-white">
                          +
                        </span>
                      </span>
                      {isToday ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                          {date.getDate()}
                        </span>
                      ) : (
                        <span>{date.getDate()}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 3).map(({ job, isStart }, n) => (
                        <Link
                          key={n}
                          href={`/zakazky/${job.id}`}
                          onClick={(e) => e.stopPropagation()}
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
            <section className="rounded-2xl border border-neutral-200/70 bg-card p-5 shadow-soft">
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

      {dayModal && (
        <DayModal
          date={dayModal}
          jobs={allJobs}
          onClose={() => setDayModal(null)}
          onSaved={() => {
            refresh();
            setDayModal(null);
          }}
        />
      )}
    </main>
  );
}

/**
 * Okno pri kliknutí na deň: naplánovať realizáciu na tento dátum.
 * Buď priradí existujúci kontakt, alebo rovno založí nový a naplánuje ho.
 * V oboch prípadoch nastaví termín (startAt) a stav na „realizácia".
 */
function DayModal({
  date,
  jobs,
  onClose,
  onSaved,
}: {
  date: Date;
  jobs: Job[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">(jobs.length > 0 ? "existing" : "new");
  const [pickId, setPickId] = useState<string>(jobs[0]?.id ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [obec, setObec] = useState("");
  const [days, setDays] = useState(1);

  // Poludnie zvoleného dňa — vyhne sa posunom cez časové pásma.
  const iso = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString();
  const pretty = date.toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  function saveExisting() {
    if (!pickId) return;
    const picked = jobs.find((j) => j.id === pickId);
    // Detaily MERGUJEME, ať plánování nesmaže ostatní pole zakázky.
    updateJob(pickId, {
      startAt: iso,
      status: "realizacia",
      details: { ...(picked?.details ?? {}), durationDays: days },
    });
    onSaved();
  }
  function saveNew() {
    const job = createJob({ customer: { name: name || null, obec: obec || null, phone: phone || null, email: null } });
    updateJob(job.id, { startAt: iso, status: "realizacia", details: { durationDays: days } });
    onSaved();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-lift sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Naplánovať realizáciu</h2>
            <p className="mt-0.5 text-sm capitalize text-neutral-500">{pretty}</p>
          </div>
          <button onClick={onClose} aria-label="Zavrieť" className="rounded-lg px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            ✕
          </button>
        </div>

        {/* Prepínač: existujúci vs nový kontakt. */}
        <div className="mt-4 flex gap-1 rounded-xl bg-neutral-100 p-1">
          <button
            onClick={() => setMode("existing")}
            disabled={jobs.length === 0}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition disabled:opacity-40 ${
              mode === "existing" ? "bg-white shadow-soft" : "text-neutral-500"
            }`}
          >
            Existujúci kontakt
          </button>
          <button
            onClick={() => setMode("new")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "new" ? "bg-white shadow-soft" : "text-neutral-500"
            }`}
          >
            Nový kontakt
          </button>
        </div>

        {mode === "existing" ? (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-neutral-500">Koho ideš robiť</span>
              <select
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                className="mt-1 w-full rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-base shadow-soft outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {(j.customer.name ?? "Bez mena") + (j.customer.obec ? " · " + j.customer.obec : "")}
                  </option>
                ))}
              </select>
            </label>
            <DurationField days={days} onChange={setDays} />
            <button
              onClick={saveExisting}
              className="w-full rounded-xl bg-brand-600 py-3 text-base font-medium text-white shadow-soft transition hover:bg-brand-700"
            >
              Naplánovať na {date.getDate()}. {date.getMonth() + 1}.
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meno a priezvisko"
              className="w-full rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-base shadow-soft outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            />
            <div className="flex gap-2">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefón"
                inputMode="tel"
                className="min-w-0 flex-1 rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-base shadow-soft outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />
              <input
                value={obec}
                onChange={(e) => setObec(e.target.value)}
                placeholder="Obec"
                className="min-w-0 flex-1 rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-base shadow-soft outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />
            </div>
            <DurationField days={days} onChange={setDays} />
            <button
              onClick={saveNew}
              disabled={!name && !phone && !obec}
              className="w-full rounded-xl bg-brand-600 py-3 text-base font-medium text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-40"
            >
              Vytvoriť a naplánovať
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DurationField({ days, onChange }: { days: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-600">Koľko dní bude trvať</span>
      <span className="flex items-center gap-1.5">
        <input
          inputMode="numeric"
          value={days}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onChange(Number.isFinite(n) && n > 0 ? n : 1);
          }}
          className="w-20 rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-right text-base tabular-nums shadow-soft outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
        <span className="w-8 text-sm text-neutral-400">dní</span>
      </span>
    </label>
  );
}
