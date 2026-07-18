import type { Job } from "./jobs";

/**
 * Automatický follow-up.
 *
 * Konverze, co leží na zemi: řemeslník pošle nabídku a zapomene. Tohle sleduje
 * stav nabídky (otevřel / neotevřel / má zájem) a navrhne postrčit ty, co visí
 * — zákazník se na ni díval a neozval, nebo ji ještě ani neotevřel.
 *
 * Zájem řešíme jinde (silný signál) — sem patří ticho po nabídce.
 */

export type QuoteStatus = {
  id: string;
  openedAt: string | null;
  interestedAt: string | null;
  createdAt: string;
};

export type FollowUp = {
  job: Job;
  kind: "opened-silent" | "unopened";
  days: number;
  message: string;
};

const DAY = 86_400_000;
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / DAY);

/** Prahy, po kolika dnech ticha má smysl postrčit. */
const OPENED_SILENT_DAYS = 1; // otevřel, neozval se
const UNOPENED_DAYS = 2; // ještě neotevřel

/** Z nabídkových zakázek + stavů nabídek udělá seznam „postrč". */
export function computeFollowUps(
  jobs: Job[],
  statuses: QuoteStatus[],
  now: Date = new Date(),
): FollowUp[] {
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const out: FollowUp[] = [];

  for (const job of jobs) {
    if (job.status !== "ponuka" || !job.shareUrl) continue;
    // Budoucí připomínka = odloženo, nech být.
    if (job.remindAt && new Date(job.remindAt) > now) continue;

    const id = job.shareUrl.split("/p/")[1];
    if (!id) continue;
    const st = byId.get(id);
    if (!st || st.interestedAt) continue; // bez stavu nebo už má zájem → sem ne

    if (st.openedAt) {
      const days = daysBetween(new Date(st.openedAt), now);
      if (days >= OPENED_SILENT_DAYS) {
        out.push({
          job,
          kind: "opened-silent",
          days,
          message:
            days === 0
              ? "Pozrel ponuku a neozval sa."
              : `Pozrel ponuku pred ${days} ${days === 1 ? "dňom" : "dňami"} a neozval sa.`,
        });
      }
    } else {
      const days = daysBetween(new Date(st.createdAt), now);
      if (days >= UNOPENED_DAYS) {
        out.push({
          job,
          kind: "unopened",
          days,
          message: `Poslal si pred ${days} dňami, ešte neotvoril.`,
        });
      }
    }
  }

  // Nejdéle visící první.
  return out.sort((a, b) => b.days - a.days);
}

/** Vytáhne id nabídky z jejího odkazu (…/p/<id>). */
export function quoteIdFromShareUrl(shareUrl: string | null): string | null {
  if (!shareUrl) return null;
  return shareUrl.split("/p/")[1] ?? null;
}
