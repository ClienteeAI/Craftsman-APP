"use client";

import { useState } from "react";

/**
 * Interaktivní vizualizace na ZÁKAZNICKÉ nabídce.
 *
 * Tohle je ten wow, který dřív viděl jen majster při přípravě: posuvník
 * před/po (táhne prstem a jeho barák se mění) a přepínač atmosféry (jak to
 * vyzerá v zime, večer, o 15 rokov). Žádné AI volání — přepíná mezi obrázky,
 * které majster připravil dopředu.
 */

const LABELS: Record<string, string> = {
  leto: "☀️ Leto",
  sneh: "❄️ Sneh",
  vecer: "🌇 Večer",
  starnutie: "⏳ O 15 rokov",
};

export default function OfferVisual({
  before,
  afterDefault,
  variants,
}: {
  before: string | null;
  afterDefault: string;
  variants: { key: string; url: string }[];
}) {
  const [after, setAfter] = useState(afterDefault);
  const [activeKey, setActiveKey] = useState("__base");
  const [split, setSplit] = useState(50);

  const options = [
    { key: "__base", label: "Nová strecha", url: afterDefault },
    ...variants.map((v) => ({ key: v.key, label: LABELS[v.key] ?? v.key, url: v.url })),
  ];

  return (
    <div className="mt-6">
      {before ? (
        <div className="relative select-none overflow-hidden rounded-2xl border border-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt="Pôvodná strecha" className="block w-full" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={after}
            alt="Nová strecha"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 0 0 ${split}%)` }}
          />
          <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/50 px-2 py-1 text-xs font-medium text-white">
            Teraz
          </span>
          <span className="pointer-events-none absolute right-3 top-3 rounded bg-black/50 px-2 py-1 text-xs font-medium text-white">
            Nová
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            aria-label="Posuvník pred a po"
            className="absolute inset-x-0 bottom-3 mx-auto w-[90%] cursor-ew-resize"
          />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={after}
          alt="Vizualizácia vašej strechy"
          className="block w-full rounded-2xl border border-neutral-200"
        />
      )}

      {before && (
        <p className="mt-2 text-center text-xs text-neutral-400">Potiahnite posuvník — vaša strecha sa zmení</p>
      )}

      {options.length > 1 && (
        <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setAfter(o.url);
                setActiveKey(o.key);
              }}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium ${
                activeKey === o.key
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-200 bg-white text-neutral-600"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
