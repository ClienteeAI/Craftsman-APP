"use client";

import { listJobs, type Job } from "./jobs";

/**
 * Úspešnosť majstra. #33 + #34.
 *
 * Dáta už zbierame — stav "hotovo" je vyhraná zákazka, "stratený" prehraná,
 * a cenu pri každej zákazke máme. Toto ich len ukáže.
 *
 * Za rok povie majstrovi to, čo o sebe nevie a nikto mu nepovie: na akých
 * cenách vyhráva a na akých prehráva. To je tá vec, za ktorú sa platí — nie
 * ušetrený čas, ale poznanie o vlastnom biznise.
 *
 * Zámerne LOKÁLNE a osobné. Krajský benchmark ("u vás sa robí za 5-7 tisíc")
 * potrebuje dáta od viacerých majstrov, teda server — to je fáza s databázou.
 * Toto je osobná verzia, ktorá funguje od prvej zákazky.
 */

export type WinStats = {
  won: number;
  lost: number;
  /** Zákazky, ktoré ešte bežia — do úspešnosti sa nerátajú. */
  open: number;
  /** Podiel vyhraných z uzavretých (vyhral + prehral). null = zatiaľ žiadna uzavretá. */
  winRate: number | null;
  /** Priemerná cena vyhraných a prehraných — kde je hranica. */
  avgWonPrice: number | null;
  avgLostPrice: number | null;
  /** Koľko uzavretých zákaziek máme — pod ~5 je to ešte šum, nie signál. */
  closed: number;
};

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => n > 0);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}

export function winStats(jobs: Job[] = listJobs()): WinStats {
  const won = jobs.filter((j) => j.status === "hotovo");
  const lost = jobs.filter((j) => j.status === "straceny");
  const open = jobs.filter((j) => j.status !== "hotovo" && j.status !== "straceny").length;
  const closed = won.length + lost.length;

  return {
    won: won.length,
    lost: lost.length,
    open,
    winRate: closed ? Math.round((won.length / closed) * 100) : null,
    avgWonPrice: avg(won.map((j) => j.priceExVat ?? 0)),
    avgLostPrice: avg(lost.map((j) => j.priceExVat ?? 0)),
    closed,
  };
}
