"use client";

import { useState } from "react";

/**
 * „Pošlite blízkym" — zákazník sa často rozhoduje s partnerkou/partnerom.
 * Toto mu dá poslať ponuku ďalej jedným ťuknutím: natívny share sheet telefónu
 * (WhatsApp, správy, mail…), na počítači skopíruje odkaz.
 */
export default function ShareOffer({ name }: { name: string | null }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `${name ? name + ", p" : "P"}ozri túto ponuku na strechu:`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Ponuka na strechu", text, url });
        return;
      } catch {
        /* zavrel share sheet — nič sa nedeje */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* bez schránky nič nerobíme */
    }
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-neutral-200/70 bg-card p-5 shadow-soft">
      <div className="min-w-0">
        <p className="text-[15px] font-medium">Rozhodujete sa spolu?</p>
        <p className="text-sm text-neutral-500">Pošlite ponuku manželke/manželovi.</p>
      </div>
      <button
        onClick={share}
        className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition active:opacity-80"
      >
        {copied ? "Odkaz skopírovaný ✓" : "📤 Poslať"}
      </button>
    </div>
  );
}
