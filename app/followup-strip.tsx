"use client";

import { useEffect, useMemo, useState } from "react";
import { updateJob, type Job } from "@/lib/crm/jobs";
import { computeFollowUps, quoteIdFromShareUrl, type FollowUp, type QuoteStatus } from "@/lib/crm/followups";

/**
 * „Postrč nabídku" — automatický follow-up.
 *
 * Pro rozpracované nabídky si zjistí stav (otevřel/neozval se) a navrhne
 * zavolat. Konverze, kterou by řemeslník jinak nechal ležet. Objeví se jen
 * když je co postrčit.
 */
export default function FollowUpStrip({ jobs, onChange }: { jobs: Job[]; onChange: () => void }) {
  const [statuses, setStatuses] = useState<QuoteStatus[]>([]);

  // Kandidáti: nabídkové zakázky s odkazem a bez odložené připomínky.
  const ids = useMemo(() => {
    const now = new Date();
    return jobs
      .filter(
        (j) =>
          j.status === "ponuka" &&
          j.shareUrl &&
          !(j.remindAt && new Date(j.remindAt) > now),
      )
      .map((j) => quoteIdFromShareUrl(j.shareUrl))
      .filter((x): x is string => Boolean(x));
  }, [jobs]);

  useEffect(() => {
    if (ids.length === 0) {
      setStatuses([]);
      return;
    }
    let alive = true;
    void fetch("/api/share/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => (r.ok ? r.json() : { statuses: [] }))
      .then((b) => alive && setStatuses(b.statuses ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ids]);

  const followUps = useMemo(() => computeFollowUps(jobs, statuses), [jobs, statuses]);

  if (followUps.length === 0) return null;

  function snooze(job: Job) {
    const in3days = new Date();
    in3days.setDate(in3days.getDate() + 3);
    updateJob(job.id, { remindAt: in3days.toISOString() });
    onChange();
  }

  return (
    <section className="mt-6 rounded-2xl border-2 border-amber-500 bg-amber-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
        👋 Postrč nabídku ({followUps.length})
      </p>
      <p className="mt-1 text-sm text-amber-800">
        Tieto ponuky visia. Jeden telefonát ich rozhýbe.
      </p>
      <div className="mt-3 space-y-3">
        {followUps.map((f) => (
          <FollowUpCard key={f.job.id} f={f} onSnooze={() => snooze(f.job)} />
        ))}
      </div>
    </section>
  );
}

function FollowUpCard({ f, onSnooze }: { f: FollowUp; onSnooze: () => void }) {
  const { job } = f;
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{job.customer.name ?? "Bez mena"}</p>
          <p className="text-sm text-neutral-500">{f.message}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            f.kind === "opened-silent" ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {f.kind === "opened-silent" ? "pozrel" : "neotvoril"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {job.customer.phone && (
          <a
            href={`tel:${job.customer.phone}`}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white active:opacity-80"
          >
            Zavolať
          </a>
        )}
        {job.shareUrl && (
          <a
            href={job.shareUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium active:bg-neutral-100"
          >
            Otvoriť ponuku
          </a>
        )}
        <button
          onClick={onSnooze}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-500 active:bg-neutral-100"
        >
          Pripomenúť o 3 dni
        </button>
      </div>
    </div>
  );
}
