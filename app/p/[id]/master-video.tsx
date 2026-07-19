"use client";

import { useState } from "react";

/**
 * Videopozdrav majstra. Natívny prehrávač s ovládaniami — najspoľahlivejšie
 * naprieč zariadeniami (iOS Safari vrátane). Keď sa nedá prehrať, ukáže
 * konkrétnu chybu (nie nemé preškrtnuté play), nech vidno, čo je zle.
 */
export default function MasterVideo({ src }: { src: string }) {
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mt-6" style={{ animation: "fadeInUp 0.5s ease both" }}>
      <p className="mb-2 text-center text-sm font-medium text-neutral-500">🎥 Odkaz od majstra</p>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        onError={(e) => {
          const v = e.currentTarget;
          const code = v.error?.code;
          const map: Record<number, string> = {
            1: "prerušené",
            2: "chyba siete",
            3: "video sa nedá dekódovať",
            4: "formát/odkaz nepodporovaný",
          };
          setErr(`Video sa nepodarilo prehrať (${code ? map[code] ?? "kód " + code : "neznáme"}).`);
        }}
        className="mx-auto block w-full max-w-sm rounded-3xl border-4 border-white bg-black shadow-lift"
      />
      {err && <p className="mx-auto mt-2 max-w-sm text-center text-xs text-red-600">{err}</p>}
    </div>
  );
}
