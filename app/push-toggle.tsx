"use client";

import { useEffect, useState } from "react";
import { isSubscribed, pushSupported, subscribeToPush } from "@/lib/push/subscribe";

/**
 * Zapnutí push upozornění. #38 do kapsy.
 *
 * Ukáže se jen dokud řemeslník upozornění nemá — pak zmizí, ať nezavazí.
 * Když prohlížeč push neumí (typicky iPhone v Safari bez „Pridať na plochu"),
 * řekne pravdu místo mrtvého tlačítka.
 */
export default function PushToggle() {
  const [state, setState] = useState<"loading" | "off" | "on" | "unsupported">("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) {
      setState("unsupported");
      return;
    }
    void isSubscribed().then((yes) => setState(yes ? "on" : "off"));
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    const res = await subscribeToPush();
    setBusy(false);
    if (res.ok) {
      setState("on");
      return;
    }
    setMsg(
      res.reason === "denied"
        ? "Upozornenia si zamietol. Povoľ ich v nastaveniach prehliadača."
        : res.reason === "no-sw"
          ? "Upozornenia fungujú na nainštalovanej appke (Pridať na plochu)."
          : res.reason === "no-vapid"
            ? "Upozornenia zatiaľ nie sú nastavené."
            : "Upozornenia sa nepodarilo zapnúť.",
    );
  }

  if (state === "loading" || state === "on") return null;

  if (state === "unsupported") {
    // Na iPhonu v Safari: navedeme na plochu, jinak push nikdy nepřijde.
    return (
      <p className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-relaxed text-neutral-500">
        💡 Pre upozornenia „zákazník má záujem" pridaj appku na plochu (Zdieľať →
        Pridať na plochu). Potom sa tu objaví zapnutie.
      </p>
    );
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border-2 border-brand-600 bg-brand-600 px-4 py-3 text-white">
      <div className="min-w-0">
        <p className="text-sm font-medium">Zapni si upozornenia</p>
        <p className="text-xs text-neutral-300">
          {msg ?? "Keď zákazník otvorí ponuku alebo má záujem, dáme ti vedieť."}
        </p>
      </div>
      <button
        onClick={enable}
        disabled={busy}
        className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-900 active:opacity-80 disabled:opacity-50"
      >
        {busy ? "Moment…" : "Zapnúť"}
      </button>
    </div>
  );
}
