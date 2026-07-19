"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { dueReminders, effectiveStatus, listJobs, restoreIfEmpty, STATUS, type Job, type JobStatus } from "@/lib/crm/jobs";
import { winStats } from "@/lib/crm/stats";

/**
 * Prehľad — desktopový dashboard. Domovská obrazovka na počítači.
 *
 * Rozloženie podľa referencie: hore KPI karty, vľavo graf + tabuľka zákaziek,
 * vpravo „na dnes" (čo treba spraviť) + rýchle akcie. Mobil sa zatiaľ len
 * naskladá pod seba; poriadny mobilný layout dorobíme podľa tohto.
 */

const eur = (n: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [due, setDue] = useState<Job[]>([]);
  const [filter, setFilter] = useState<JobStatus | "vsetky">("vsetky");

  useEffect(() => {
    function refresh() {
      setJobs(listJobs());
      setDue(dueReminders());
    }
    refresh();
    void restoreIfEmpty().then((r) => r.length > 0 && refresh());
  }, []);

  const stats = useMemo(() => winStats(jobs), [jobs]);

  // ── KPI ────────────────────────────────────────────────────────────────
  const clients = jobs.length;
  const active = jobs.filter((j) => j.status !== "hotovo" && j.status !== "straceny").length;
  const revenue = jobs.reduce((a, j) => a + (j.priceExVat ?? 0), 0);

  // Delta oproti minulému mesiacu (počet nových zákaziek).
  const now = new Date();
  const inMonth = (j: Job, back: number) => {
    const d = new Date(j.createdAt);
    const m = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
  };
  const newThis = jobs.filter((j) => inMonth(j, 0)).length;
  const newPrev = jobs.filter((j) => inMonth(j, 1)).length;
  const clientsDelta = newThis - newPrev;

  // Realizované zákazky (v realizácii) + súhrnná cena.
  const realizacia = jobs.filter((j) => j.status === "realizacia");
  const realizaciaSum = realizacia.reduce((a, j) => a + (j.priceExVat ?? 0), 0);
  // Kontakty bez ponuky — komu ešte nikto neposlal ponuku (príležitosť).
  const bezPonuky = jobs.filter((j) => !j.shareUrl && j.status !== "straceny").length;

  // ── Graf tržieb za 6 mesiacov ──────────────────────────────────────────
  const chart = useMemo(() => {
    const buckets: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = jobs
        .filter((j) => {
          const c = new Date(j.createdAt);
          return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
        })
        .reduce((a, j) => a + (j.priceExVat ?? 0), 0);
      buckets.push({ label: d.toLocaleDateString("sk-SK", { month: "short" }), value });
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);
  const chartMax = Math.max(1, ...chart.map((b) => b.value));

  const shown = filter === "vsetky" ? jobs : jobs.filter((j) => effectiveStatus(j) === filter);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        {/* ── Horní lišta ─────────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11.5 12 4l9 7.5" />
                <path d="M5 10.5V20h14v-9.5" />
              </svg>
            </div>
            <span className="hidden text-sm font-semibold sm:block">Rýchla ponuka</span>
          </div>

          <nav className="flex items-center gap-1 rounded-full border border-neutral-200/70 bg-card p-1 shadow-soft">
            <span className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white">Prehľad</span>
            <Link href="/" className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-900">
              Nová ponuka
            </Link>
            <Link href="/zakaznici" className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-900">
              Zákazníci
            </Link>
            <Link href="/zakazky" className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-900">
              Zákazky
            </Link>
            <Link href="/kalendar" className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-900">
              Kalendár
            </Link>
            <Link href="/firma" className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-900">
              Firma
            </Link>
          </nav>

          <Link
            href="/profil"
            aria-label="Moja firma"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-card hover:text-neutral-900 hover:shadow-soft"
          >
            <GearIcon />
          </Link>
        </header>

        {/* ── KPI karty ───────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <Kpi
            label="Zákazníci"
            value={String(clients)}
            sub={`${active} aktívnych`}
            delta={clientsDelta}
            href="/zakaznici"
          />
          <Kpi label="Tržby (odoslané ponuky)" value={eur(revenue)} sub="spolu bez DPH" />
          <Kpi
            label="V realizácii"
            value={realizacia.length ? eur(realizaciaSum) : "—"}
            sub={`${realizacia.length} ${realizacia.length === 1 ? "zákazka" : "zákaziek"}`}
          />
          <Kpi
            label="Kontakty bez ponuky"
            value={String(bezPonuky)}
            sub={bezPonuky > 0 ? "príležitosť naceniť" : "všetci majú ponuku"}
            href="/zakaznici"
          />
          <Kpi
            label="Úspešnosť"
            value={stats.closed >= 3 ? `${stats.winRate} %` : "—"}
            sub={stats.closed >= 3 ? `${stats.won} vyhraných · ${stats.lost} stratených` : "málo dát"}
          />
        </div>

        {/* ── Hlavní mřížka: vlevo graf+tabulka, vpravo panely ─────────── */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Levý sloupec (2/3) */}
          <div className="space-y-4 lg:col-span-2">
            {/* Graf tržeb */}
            <section className="rounded-2xl border border-neutral-200/70 bg-card p-6 shadow-soft">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Tržby v čase</h2>
                <span className="text-xs text-neutral-400">posledných 6 mesiacov</span>
              </div>
              <div className="mt-5 flex h-40 items-end gap-2 sm:gap-3">
                {chart.map((b, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-brand-500/80 transition-all hover:bg-brand-600"
                        style={{ height: `${Math.max(2, (b.value / chartMax) * 100)}%` }}
                        title={eur(b.value)}
                      />
                    </div>
                    <span className="text-xs text-neutral-400">{b.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Tabulka zakázek */}
            <section className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-card shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-5">
                <h2 className="text-sm font-semibold">Zákazky</h2>
                <div className="flex flex-wrap gap-1">
                  <Tab active={filter === "vsetky"} onClick={() => setFilter("vsetky")}>
                    Všetky
                  </Tab>
                  {(Object.keys(STATUS) as JobStatus[]).map((s) => (
                    <Tab key={s} active={filter === s} onClick={() => setFilter(s)}>
                      {STATUS[s].label}
                    </Tab>
                  ))}
                </div>
              </div>

              {shown.length === 0 ? (
                <p className="p-8 text-center text-sm text-neutral-400">
                  {jobs.length === 0 ? "Zatiaľ žiadne zákazky." : "V tomto stave nič nie je."}
                </p>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {/* Hlavička tabulky — jen na desktopu. */}
                  <div className="hidden px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-neutral-400 sm:grid sm:grid-cols-[1.4fr_1fr_0.8fr_0.9fr]">
                    <span>Zákazník</span>
                    <span>Zákazka</span>
                    <span className="text-right">Cena</span>
                    <span className="text-right">Stav</span>
                  </div>
                  {shown.slice(0, 12).map((j) => (
                    <Link
                      key={j.id}
                      href={`/zakazky/${j.id}`}
                      className="grid grid-cols-1 gap-1 px-5 py-3.5 transition hover:bg-neutral-50 sm:grid-cols-[1.4fr_1fr_0.8fr_0.9fr] sm:items-center sm:gap-3"
                    >
                      <span className="min-w-0 truncate font-medium">{j.customer.name ?? "Bez mena"}</span>
                      <span className="min-w-0 truncate text-sm text-neutral-500">
                        {j.customer.obec ?? j.summary ?? "—"}
                      </span>
                      <span className="text-sm font-medium tabular-nums sm:text-right">
                        {j.priceExVat != null ? eur(j.priceExVat) : "—"}
                      </span>
                      <span className="sm:text-right">
                        <StatusPill status={effectiveStatus(j)} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Pravý sloupec (1/3) */}
          <div className="space-y-4">
            {/* Na dnes — akční */}
            <section className="rounded-2xl border border-neutral-200/70 bg-card p-6 shadow-soft">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Na dnes</h2>
                <Link href="/zakazky" className="text-xs font-medium text-brand-700 hover:underline">
                  Všetko
                </Link>
              </div>
              {due.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-400">Dnes nič nečaká. 👌</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {due.slice(0, 5).map((j) => (
                    <div key={j.id} className="flex items-center justify-between gap-3">
                      <Link href={`/zakazky/${j.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{j.customer.name ?? "Bez mena"}</p>
                        <p className="truncate text-xs text-neutral-400">
                          Pripomienka · {j.customer.obec ?? ""}
                        </p>
                      </Link>
                      {j.customer.phone && (
                        <a
                          href={`tel:${j.customer.phone}`}
                          className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                        >
                          Zavolať
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Rýchle akcie */}
            <section className="rounded-2xl border border-neutral-200/70 bg-card p-6 shadow-soft">
              <h2 className="text-sm font-semibold">Rýchle akcie</h2>
              <div className="mt-4 space-y-2">
                <Link
                  href="/"
                  className="flex items-center justify-center rounded-xl bg-brand-600 py-3 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
                >
                  + Nová ponuka
                </Link>
                <Link
                  href="/zakazky/novy"
                  className="flex items-center justify-center rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium transition hover:bg-neutral-50"
                >
                  + Nový kontakt
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Kpi({
  label,
  value,
  sub,
  delta,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  delta?: number;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">{label}</p>
        {delta != null && delta !== 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              delta > 0 ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">
        {sub}
        {href && <span className="text-brand-700"> · zobraziť →</span>}
      </p>
    </>
  );
  const cls = "block rounded-2xl border border-neutral-200/70 bg-card p-5 shadow-soft";
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-brand-300 hover:shadow-lift`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: JobStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      {s.dot} {s.label}
    </span>
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
