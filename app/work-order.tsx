"use client";

import { useState } from "react";
import type { PricedItem } from "@/lib/quote/pricing";

/**
 * Zákazkový list pro partu v jejím jazyce.
 *
 * Nabídka jde slovensky zákazníkovi; parta ale potřebuje příkaz v jazyce,
 * kterým reálně mluví. Z materiálu nabídky a parametrů udělá jasný pracovní
 * příkaz — pošle se přes WhatsApp.
 */

const LANGS: [string, string][] = [
  ["uk", "🇺🇦 Ukrajinsky"],
  ["pl", "🇵🇱 Poľsky"],
  ["ro", "🇷🇴 Rumunsky"],
  ["hu", "🇭🇺 Maďarsky"],
];

export default function WorkOrder({
  items,
  obec,
  summary,
  warnings,
}: {
  items: PricedItem[];
  obec: string | null;
  summary: string | null;
  warnings: string[];
}) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("uk");
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const materials = items
        .filter((i) => i.kind === "material")
        .map((i) => ({ label: i.label, qty: i.qty, unit: i.unit }));
      const res = await fetch("/api/workorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, obec, summary, materials, warnings }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Nepodarilo sa.");
      setText(body.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodarilo sa vygenerovať.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blokovaný */
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <span>
          <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Zákazkový list pre partu
          </span>
          <span className="mt-0.5 block text-sm text-neutral-500">
            Pracovný príkaz v jazyku party
          </span>
        </span>
        <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-neutral-100 p-5">
          <div className="flex flex-wrap gap-2">
            {LANGS.map(([code, label]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`rounded-full px-3.5 py-2 text-sm font-medium ${
                  lang === code
                    ? "bg-brand-600 text-white"
                    : "border border-neutral-200 bg-white text-neutral-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={generate}
            disabled={busy}
            className="mt-3 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white active:opacity-80 disabled:opacity-40"
          >
            {busy ? "Píšem…" : text ? "Vytvoriť znova" : "Vytvoriť príkaz"}
          </button>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {text && (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">{text}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={copy}
                  className="flex-1 rounded-xl bg-brand-600 py-2.5 text-center text-sm font-medium text-white active:opacity-80"
                >
                  {copied ? "Skopírované ✓" : "Kopírovať"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium active:bg-neutral-100"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
