"use client";

import { useState } from "react";
import type { Job } from "@/lib/crm/jobs";
import { loadProfile } from "@/lib/quote/profile-store";
import type { MarketingAssets } from "@/lib/quote/marketing";

/**
 * Auto-marketing z hotové zakázky.
 *
 * Řemeslník nemá marketing a nikdy mít nebude — tak mu ho appka udělá. Z údajů
 * o zakázce vygeneruje hotový FB příspěvek, prosbu o Google recenzi a popisek
 * do portfolia. Stačí zkopírovat / poslat.
 */
export default function MarketingSection({ job }: { job: Job }) {
  const [assets, setAssets] = useState<MarketingAssets | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const profile = loadProfile();
      const res = await fetch("/api/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: profile.company.name || "Naša firma",
          obec: job.customer.obec,
          customerName: job.customer.name,
          summary: job.summary,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Nepodarilo sa.");
      setAssets(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodarilo sa vygenerovať.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">
        Marketing zo zákazky
      </h2>
      <p className="mb-3 text-sm text-neutral-500">
        Hotový príspevok, prosba o recenziu a popis do portfólia — na jeden klik.
      </p>

      {!assets ? (
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white active:opacity-80 disabled:opacity-40"
        >
          {busy ? "Píšem…" : "✨ Vytvoriť marketing"}
        </button>
      ) : (
        <div className="space-y-3">
          <Asset title="Facebook / Instagram" text={assets.fbPost} />
          <Asset
            title="Prosba o Google recenziu"
            text={assets.reviewRequest}
            sharePhone={job.customer.phone}
          />
          <Asset title="Popis do portfólia" text={assets.portfolioCaption} />
          <button
            onClick={generate}
            disabled={busy}
            className="text-sm text-neutral-500 underline underline-offset-4 disabled:opacity-40"
          >
            {busy ? "Píšem…" : "Vytvoriť znova (iná verzia)"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function Asset({
  title,
  text,
  sharePhone,
}: {
  title: string;
  text: string;
  sharePhone?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blokovaný — text je stejně vidět, dá se označit ručně */
    }
  }

  const wa = sharePhone
    ? `https://wa.me/${sharePhone.replace(/[^\d]/g, "").replace(/^0/, "421")}?text=${encodeURIComponent(text)}`
    : null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">{title}</span>
        <div className="flex items-center gap-3">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="text-sm font-medium text-green-700">
              Poslať
            </a>
          )}
          <button onClick={copy} className="text-sm font-medium text-neutral-700">
            {copied ? "Skopírované ✓" : "Kopírovať"}
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">{text}</p>
    </div>
  );
}
