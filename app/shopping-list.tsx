"use client";

import { useState } from "react";
import type { PricedItem } from "@/lib/quote/pricing";

/**
 * Nákupní seznam do velkoobchodu. „Jedním klikem."
 *
 * Z materiálových položek nabídky udělá čistý seznam množství, který majster
 * zkopíruje nebo pošle do velkoobchodu. Bez cen — velkoobchod má svoje; tohle
 * je „čoho koľko". Práce se sem nedává, jen materiál.
 */
export default function ShoppingList({
  items,
  companyName,
}: {
  items: PricedItem[];
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const material = items.filter((i) => i.kind === "material" && i.qty != null);
  if (material.length === 0) return null;

  const lines = material.map((i) => `- ${i.label}: ${i.qty} ${i.unit}`);
  const text = `Objednávka materiálu — ${companyName}\n\n${lines.join("\n")}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blokovaný — text je vidět, dá se označit ručně */
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
            Nákupný zoznam
          </span>
          <span className="mt-0.5 block text-sm text-neutral-500">
            {material.length} položiek materiálu do veľkoobchodu
          </span>
        </span>
        <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-neutral-100 p-5">
          <div className="space-y-2">
            {material.map((i, n) => (
              <div key={n} className="flex items-baseline justify-between gap-3 text-[15px]">
                <span className="min-w-0 flex-1">{i.label}</span>
                <span className="shrink-0 whitespace-nowrap font-medium tabular-nums">
                  {i.qty} {i.unit}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={copy}
              className="flex-1 rounded-xl bg-neutral-900 py-3 text-center text-sm font-medium text-white active:opacity-80"
            >
              {copied ? "Skopírované ✓" : "Kopírovať zoznam"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-neutral-300 px-4 py-3 text-center text-sm font-medium active:bg-neutral-100"
            >
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
