"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listJobs, restoreIfEmpty, STATUS, type Job } from "@/lib/crm/jobs";

/**
 * Zákazníci — dlaždicový prehľad kontaktov.
 *
 * Cihlička = zákazník. Defaultne vidno len meno; po nabehnutí myšou sa rozbalí
 * a ukáže e-mail, telefón, adresu; po kliknutí ide na plnohodnotnú kartu.
 * Hore vyhľadávanie podľa mena (aj telefónu/mailu).
 */

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Zakaznici() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    function refresh() {
      setJobs(listJobs());
    }
    refresh();
    void restoreIfEmpty().then((r) => r.length > 0 && refresh());
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return jobs;
    return jobs.filter((j) => {
      const c = j.customer;
      return [c.name, c.phone, c.email, c.obec].some((v) => v?.toLowerCase().includes(s));
    });
  }, [jobs, q]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        {/* Horní lišta */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/prehlad" className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900">
              ← Prehľad
            </Link>
            <h1 className="text-xl font-semibold tracking-tight">Zákazníci</h1>
            <span className="text-sm text-neutral-400">{jobs.length}</span>
          </div>

          {/* Vyhľadávanie */}
          <div className="relative w-full sm:w-72">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Hľadať meno, telefón, e-mail…"
              className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-soft outline-none focus:border-brand-500"
            />
          </div>
        </header>

        {shown.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-neutral-400">
              {jobs.length === 0 ? "Zatiaľ žiadni zákazníci." : "Nič nenájdené."}
            </p>
            {jobs.length === 0 && (
              <Link
                href="/zakazky/novy"
                className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-3 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
              >
                + Nový kontakt
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((j, i) => (
              <ClientTile key={j.id} job={j} index={i} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ClientTile({ job, index }: { job: Job; index: number }) {
  const c = job.customer;
  const address = (job.details?.constructionAddress as string) || c.obec || null;
  const s = STATUS[job.status];

  return (
    <Link
      href={`/zakazky/${job.id}`}
      style={{ animation: "fadeInUp 0.35s ease both", animationDelay: `${Math.min(index, 20) * 35}ms` }}
      className="group block rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-soft transition hover:border-brand-300 hover:shadow-lift"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
          {initials(c.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            <Typewriter text={c.name ?? "Bez mena"} delay={Math.min(index, 12) * 140} />
          </p>
          <p className="truncate text-xs text-neutral-400">
            {s.dot} {s.label}
          </p>
        </div>
      </div>

      {/* Rozbalí sa po nabehnutí myšou (desktop). Na mobile sa dá kliknúť rovno. */}
      <div className="grid grid-cols-1 overflow-hidden opacity-0 transition-all duration-200 [grid-template-rows:0fr] group-hover:mt-3 group-hover:opacity-100 group-hover:[grid-template-rows:1fr]">
        <div className="min-h-0 space-y-1.5 border-t border-neutral-100 pt-3 text-sm text-neutral-600">
          <Row icon="📞" value={c.phone} />
          <Row icon="✉️" value={c.email} />
          <Row icon="📍" value={address} />
          {!c.phone && !c.email && !address && (
            <p className="text-xs text-neutral-400">Žiadne kontaktné údaje — doplň v karte.</p>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Vypisuje text po písmenkách, jako když se píše na klávesnici. */
function Typewriter({ text, delay = 0 }: { text: string; delay?: number }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setShown(text.slice(0, i));
        if (i >= text.length && interval) clearInterval(interval);
      }, 45);
    }, delay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, delay]);
  // nezalomený mezerník drží výšku řádku, než se začne psát
  return <>{shown || " "}</>;
}

function Row({ icon, value }: { icon: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="flex items-center gap-2 truncate">
      <span className="text-neutral-400">{icon}</span>
      <span className="truncate">{value}</span>
    </p>
  );
}
