import { randomBytes } from "crypto";
import type { PricedItem } from "./pricing";

/**
 * Uložené nabídky, na které se posílá odkaz zákazníkovi.
 *
 * ⚠️ PAMĚŤ PROCESU. Přežije do restartu serveru a na Vercelu se o ni instance
 * nepodělí — zákazník by klikl na odkaz a viděl 404. Před ostrým provozem
 * MUSÍ do databáze (tabulka `quotes` + obrázek do R2/Supabase storage).
 *
 * Pro demo je to v pořádku a je to schválně to nejjednodušší, co funguje.
 */

export type SharedQuote = {
  id: string;
  createdAt: string;
  /** Hlavička z profilu realizátora — jeho logo, jeho kontakty. */
  company: { name: string; phone: string; email: string; logoUrl: string | null };
  customer: { name: string | null; obec: string | null; phone: string | null; email: string | null };
  summary: string;
  tierName: string;
  productName: string;
  /** Najbližší voľný termín z profilu. Prázdny = neukazuje sa. */
  earliestTerm: string;
  items: PricedItem[];
  totals: { materialTotal: number; labourTotal: number; totalExVat: number; totalIncVat: number };
  range: { from: number; to: number };
  assumptions: string[];
  /** Vizualizace zákazníkova baráku jako data URL. Bez ní je to jen tabulka. */
  imageDataUrl: string | null;
  /** Id videa (leží v /api/video/[id]). Prázdné = žádné video. */
  videoId: string | null;
  /** Kdy si ji zákazník poprvé otevřel. Řemeslník pak ví, kdy volat. */
  openedAt: string | null;
  /** Kdy zákazník ťukl "Mám záujem". Nejsilnější signál v celé apce. */
  interestedAt: string | null;
};

/**
 * Přes globalThis, ne prosté `new Map()`.
 *
 * Next.js zabalí API endpoint a stránku do oddělených balíčků, takže by každý
 * dostal vlastní instanci modulu a vlastní prázdnou Map. Endpoint by nabídku
 * uložil a stránka by ji nenašla — ověřeno, dělalo to 404 na čerstvě vytvořený
 * odkaz. globalThis je jediné, co obě strany sdílejí.
 *
 * Nezachraňuje to ale hlavní problém: na Vercelu běží víc instancí a každá má
 * svůj vlastní globalThis. Zákazník klikne na odkaz, trefí jinou instanci a
 * uvidí 404. Pro demo na jednom serveru to stačí, do provozu to MUSÍ do
 * databáze.
 */
const g = globalThis as typeof globalThis & { __quotes?: Map<string, SharedQuote> };
const quotes: Map<string, SharedQuote> = (g.__quotes ??= new Map());

/** Krátké ID — jde nadiktovat do telefonu, když odkaz nedorazí. */
function newId(): string {
  return randomBytes(4).toString("hex");
}

export function saveQuote(
  q: Omit<SharedQuote, "id" | "createdAt" | "openedAt" | "interestedAt">,
): SharedQuote {
  const saved: SharedQuote = {
    ...q,
    id: newId(),
    createdAt: new Date().toISOString(),
    openedAt: null,
    interestedAt: null,
  };
  quotes.set(saved.id, saved);
  return saved;
}

export function getQuote(id: string): SharedQuote | undefined {
  return quotes.get(id);
}

/**
 * Označí nabídku jako otevřenou. Vrací true jen poprvé.
 *
 * Tohle je nenápadně jedna z nejcennějších věcí v celé aplikaci: řemeslník
 * uvidí, že se zákazník na nabídku dívá, a může zvednout telefon ve chvíli,
 * kdy o tom zákazník přemýšlí. Konkurence pošle PDF do mailu a čeká.
 */
export function markOpened(id: string): boolean {
  const q = quotes.get(id);
  if (!q || q.openedAt) return false;
  q.openedAt = new Date().toISOString();
  return true;
}

/**
 * Zákazník ťukl "Mám záujem". Vrací true jen poprvé.
 *
 * Toto je vrchol celého toku: zákazník sám řekl ano. Řemeslník to má vidět
 * okamžitě a zvednout telefon, dokud je zákazník rozhodnutý. Otevření znamená
 * "dívá se", tohle znamená "chce to".
 */
export function markInterested(id: string): boolean {
  const q = quotes.get(id);
  if (!q) return false;
  // I když už byla otevřená, zájem je nová a silnější událost.
  if (!q.openedAt) q.openedAt = new Date().toISOString();
  if (q.interestedAt) return false;
  q.interestedAt = new Date().toISOString();
  return true;
}
