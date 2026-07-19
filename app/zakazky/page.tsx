"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { dueReminders, effectiveStatus, listJobs, loadVisibleJobs, restoreIfEmpty, STATUS, type Job, type JobStatus } from "@/lib/crm/jobs";
import { winStats, type WinStats } from "@/lib/crm/stats";
import PushToggle from "../push-toggle";
import FollowUpStrip from "../followup-strip";

/**
 * Modul 1 — seznam zakázek. Domovská obrazovka CRM.
 *
 * Mobil first: každá zakázka je karta, stav je barevná pilulka, a přímo z
 * karty jde volat a navigovat — to jsou dvě věci, které majster v terénu dělá
 * nejčastěji, tak ať k nim nemusí nikam proklikávat.
 */
export default function Zakazky() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [due, setDue] = useState<Job[]>([]);
  const [stats, setStats] = useState<WinStats | null>(null);
  const [filter, setFilter] = useState<JobStatus | "vsetky">("vsetky");

  // Sdílený refresh — volá ho i follow-up po odložení připomínky.
  const refresh = useCallback(async () => {
    const local = listJobs(); // okamžité lokální
    setJobs(local);
    setDue(dueReminders());
    setStats(winStats(local));
    const vis = await loadVisibleJobs(); // vlastné + party/firma podľa role
    setJobs(vis);
    setStats(winStats(vis));
  }, []);

  useEffect(() => {
    void (async () => {
      await restoreIfEmpty();
      void refresh();
    })();
  }, [refresh]);

  const shown = filter === "vsetky" ? jobs : jobs.filter((j) => effectiveStatus(j) === filter);
  const live = jobs.filter((j) => j.status !== "hotovo" && j.status !== "straceny").length;

  return (
    <main className="min-h-screen text-neutral-900">
      <div className="mx-auto max-w-2xl px-5 py-8 pb-28">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Zákazky</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {live} {live === 1 ? "aktívna" : live >= 2 && live <= 4 ? "aktívne" : "aktívnych"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/prehlad"
              aria-label="Prehľad"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-card hover:text-neutral-900 hover:shadow-soft"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </Link>
            <Link
              href="/profil"
              aria-label="Moja firma"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-card hover:text-neutral-900 hover:shadow-soft"
            >
              <GearIcon />
            </Link>
          </div>
        </div>

        {/* Upozornění do kapsy — zmizí, jakmile si je řemeslník zapne. */}
        {filter === "vsetky" && <PushToggle />}

        {/* Úspešnosť — začátek datového pokladu. Ukáže se, až je co ukázat. */}
        {stats && stats.closed > 0 && filter === "vsetky" && <StatsStrip s={stats} />}

        {/* Na dnes — koho obvolat. Nahoře, protože ráno je to první, co majster řeší. */}
        {due.length > 0 && filter === "vsetky" && (
          <section className="mt-6 rounded-2xl border-2 border-neutral-900 bg-neutral-900 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              ⏰ Dnes zavolať ({due.length})
            </p>
            <div className="mt-3 space-y-2">
              {due.map((j) => (
                <div key={j.id} className="flex items-center justify-between gap-3">
                  <Link href={`/zakazky/${j.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{j.customer.name ?? "Bez mena"}</p>
                    <p className="truncate text-xs text-neutral-400">{j.customer.obec ?? ""}</p>
                  </Link>
                  {j.customer.phone && (
                    <a
                      href={`tel:${j.customer.phone}`}
                      className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 active:opacity-80"
                    >
                      Zavolať
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Postrč nabídku — automatický follow-up. Ukáže se jen když je co. */}
        {filter === "vsetky" && <FollowUpStrip jobs={jobs} onChange={refresh} />}

        {/* Filtr stavů — vodorovný scroll, ať se vejde na úzký displej. */}
        <div className="mt-5 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          <Chip active={filter === "vsetky"} onClick={() => setFilter("vsetky")}>
            Všetky
          </Chip>
          {(Object.keys(STATUS) as JobStatus[]).map((s) => (
            <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
              {STATUS[s].dot} {STATUS[s].label}
            </Chip>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-neutral-400">
              {jobs.length === 0 ? "Zatiaľ žiadne zákazky." : "V tomto stave nič nie je."}
            </p>
            {jobs.length === 0 && (
              <div className="mt-4 flex justify-center gap-3">
                <Link
                  href="/zakazky/novy"
                  className="inline-block rounded-xl border border-neutral-300 bg-white px-5 py-3 text-base font-medium active:bg-neutral-100"
                >
                  + Nový kontakt
                </Link>
                <Link
                  href="/"
                  className="inline-block rounded-xl bg-brand-600 px-5 py-3 text-base font-medium text-white shadow-soft transition hover:bg-brand-700"
                >
                  Vytvoriť ponuku
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {shown.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </div>

      {/* Pod palcem. Nový kontakt (rychlý zápis) vlevo, plná nabídka vpravo. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Link
            href="/zakazky/novy"
            className="flex-1 rounded-xl border border-neutral-300 bg-white py-3.5 text-center text-base font-medium active:bg-neutral-100"
          >
            + Nový kontakt
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-xl bg-brand-600 py-3.5 text-center text-base font-medium text-white shadow-soft transition hover:bg-brand-700 active:opacity-90"
          >
            + Nová ponuka
          </Link>
        </div>
      </div>
    </main>
  );
}

function JobCard({ job }: { job: Job }) {
  const s = STATUS[effectiveStatus(job)];
  const eur = (n: number | null) =>
    n == null ? null : new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  const overdue = job.remindAt && new Date(job.remindAt) <= new Date();

  return (
    <Link
      href={`/zakazky/${job.id}`}
      className="block rounded-2xl border border-neutral-200/70 bg-card shadow-soft p-4 active:bg-neutral-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{job.customer.name ?? "Bez mena"}</p>
          <p className="truncate text-sm text-neutral-500">
            {job.customer.obec ?? ""}
            {job.summary ? ` · ${job.summary}` : ""}
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium">
          {s.dot} {s.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {job.customer.phone && (
          <button
            onClick={(e) => {
              e.preventDefault();
              window.location.href = `tel:${job.customer.phone}`;
            }}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm active:bg-neutral-100"
          >
            Zavolať
          </button>
        )}
        {job.customer.obec && (
          <button
            onClick={(e) => {
              e.preventDefault();
              window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.customer.obec!)}`,
                "_blank",
              );
            }}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm active:bg-neutral-100"
          >
            Navigovať
          </button>
        )}
        {eur(job.priceExVat) && (
          <span className="ml-auto text-sm font-medium tabular-nums">{eur(job.priceExVat)}</span>
        )}
      </div>

      {overdue && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          ⏰ Pripomienka: {new Date(job.remindAt!).toLocaleDateString("sk-SK")}
        </p>
      )}
      {job.startAt && (
        <p className="mt-1 text-xs font-medium text-neutral-600">
          🔨 Realizácia: {new Date(job.startAt).toLocaleDateString("sk-SK")}
        </p>
      )}
    </Link>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium ${
        active ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600"
      }`}
    >
      {children}
    </button>
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

/**
 * Pruh úspešnosti. #33/#34 v osobnej verzii.
 *
 * Do ~5 uzavretých zákaziek je to šum, nie signál — vtedy to poctivo povie,
 * že treba viac dát, namiesto toho aby predstieralo presnosť z troch čísel.
 * Keď dát je dosť a je vidno hranicu ("nad X vyhrávaš menej"), povie to.
 */
function StatsStrip({ s }: { s: WinStats }) {
  const eur = (n: number | null) =>
    n == null ? "—" : new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  const enough = s.closed >= 5;

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200/70 bg-card shadow-soft p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Tvoja úspešnosť</h2>
        <span className="text-sm text-neutral-400">{s.closed} uzavretých</span>
      </div>

      <div className="mt-3 flex items-end gap-6">
        <div>
          <p className="text-3xl font-semibold tabular-nums">{s.winRate}%</p>
          <p className="text-xs text-neutral-400">vyhraných</p>
        </div>
        <div className="text-sm text-neutral-500">
          <p>✅ {s.won} vyhraných</p>
          <p>❌ {s.lost} stratených</p>
        </div>
      </div>

      {enough && s.avgWonPrice && s.avgLostPrice ? (
        <p className="mt-4 border-t border-neutral-100 pt-3 text-sm leading-relaxed text-neutral-600">
          Vyhrané ponuky máš v priemere za <span className="font-medium">{eur(s.avgWonPrice)}</span>,
          stratené za <span className="font-medium">{eur(s.avgLostPrice)}</span>.
          {s.avgLostPrice > s.avgWonPrice
            ? " Drahšie ponuky strácaš častejšie — možno máš priestor byť pri väčších zákazkách odvážnejší v cene, alebo naopak opatrnejší."
            : ""}
        </p>
      ) : (
        <p className="mt-4 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-400">
          Po pár uzavretých zákazkách ti tu ukážeme, na akých cenách vyhrávaš a na
          akých strácaš.
        </p>
      )}
    </section>
  );
}
