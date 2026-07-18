"use client";

import { useEffect, useState } from "react";

/**
 * Registrace service workeru + výzva k instalaci na plochu.
 *
 * Zadání klienta: "s vytvorením ikony v mobile užívateľa".
 *
 * Na Androidu odchytíme `beforeinstallprompt` a nabídneme vlastní tlačítko.
 * Na iOS tahle událost NEEXISTUJE — Safari nic nenabízí a uživatel musí projít
 * Zdieľať → Pridať na plochu ručně. Proto pro iOS ukazujeme návod, ne tlačítko.
 *
 * Není to kosmetika: na iPhonu bez instalace na plochu nefunguje web push
 * vůbec. Kdo appku nenainstaluje, tomu nikdy nepřijde notifikace.
 */

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function Pwa() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Service worker jen v produkci. V dev režimu umí zdržovat hard refresh
    // starou cache — a při ladění na telefonu je čerstvé načtení k nezaplacení.
    // (Není to on, kdo rozbil klikání — to byl allowedDevOrigins — ale ať
    //  nekomplikuje právě to znovunačtení, kterým se to opravuje.)
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("[pwa] SW:", e));
      } else {
        // Telefon, který si z dřívějška stáhl dev service worker, ho tímhle
        // zahodí — ať nedrží starou verzi.
        navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      }
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS: událost neexistuje, poznáme ho podle UA a podle toho, že ještě neběží
    // v standalone režimu (= není nainstalovaný).
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isIos && !standalone) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!prompt && !showIosHint) return null;

  return (
    <div className="mx-auto mb-4 max-w-2xl px-5">
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
        <span className="text-sm text-neutral-600">
          {prompt
            ? "Pridaj si appku na plochu — otvorí sa na jedno ťuknutie."
            : "Pridaj si appku na plochu: Zdieľať → Pridať na plochu."}
        </span>
        {prompt && (
          <button
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice;
              setPrompt(null);
            }}
            className="ml-auto shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Pridať
          </button>
        )}
      </div>
    </div>
  );
}
