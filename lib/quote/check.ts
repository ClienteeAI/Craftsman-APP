import type { PricedItem } from "./pricing";
import type { RoofJob } from "./types";

/**
 * Kontrola nabídky před odesláním.
 *
 * Nejlevnější wow v celé aplikaci a zároveň to, co řemeslníkovi ušetří peníze
 * na první zakázce — přesně v ten moment se rozhodne, jestli apku používat dál.
 *
 * Řemeslník po večerech u desáté nabídky zapomene započítat oplechování komína.
 * Materiál koupí, práci odvede, ale do ceny to nedal — a je v mínusu. Apka to
 * chytí dřív, než nabídku pošle.
 *
 * Tahle část je čistě logická: porovná, co je v zadání, s tím, co je v položkách.
 * Žádný model, nula nákladů, nula halucinace. Vizuální kontrola z fotky
 * (mech, okno navíc) je zvlášť a je to model.
 */

export type CheckSeverity = "chyba" | "upozornenie";

export type CheckFinding = {
  severity: CheckSeverity;
  message: string;
};

/** Je v položkách něco, co odpovídá klíčovým slovům? */
function hasItem(items: PricedItem[], ...needles: string[]): boolean {
  return items.some((i) => {
    const l = i.label.toLowerCase();
    return needles.some((n) => l.includes(n.toLowerCase()));
  });
}

export function checkQuote(job: RoofJob, items: PricedItem[]): CheckFinding[] {
  const out: CheckFinding[] = [];
  const does = (s: string) => job.scope.includes(s as never);

  // --- Komín zmíněn, ale bez oplechování? Klasická díra. ---
  if (job.penetrations.chimneys && !hasItem(items, "komín", "oplech")) {
    out.push({
      severity: "chyba",
      message: `V zadaní máš ${job.penetrations.chimneys} komín(y), ale v ponuke chýba oplechovanie komína. Zabudol si naň?`,
    });
  }

  // --- Střešní okna bez lemování? ---
  if (job.penetrations.skylights && !hasItem(items, "okn", "lemov")) {
    out.push({
      severity: "chyba",
      message: `Máš ${job.penetrations.skylights} strešné okná, ale chýba lemovanie okien.`,
    });
  }

  // --- Mění se krytina, ale v položkách žádná? ---
  if (does("krytina") && !hasItem(items, "škridla", "krytina")) {
    out.push({
      severity: "chyba",
      message: "Meníš krytinu, ale v ponuke nie je žiadna škridla.",
    });
  }

  // --- Nová krytina skoro vždy chce novou fólii. Jen upozornění. ---
  if (does("krytina") && !does("fólia") && !hasItem(items, "fólia", "fólie")) {
    out.push({
      severity: "upozornenie",
      message: "Pri výmene krytiny sa zvyčajne mení aj poistná fólia. V ponuke nie je — je to zámer?",
    });
  }

  // --- Latě: mění se, ale nejsou? ---
  if (does("latovanie") && !hasItem(items, "laty", "latovanie")) {
    out.push({
      severity: "chyba",
      message: "Meníš latovanie, ale strešné laty v ponuke chýbajú.",
    });
  }

  // --- Hřebenáče u sedlové/valbové střechy. ---
  const hasRidge = job.roof.type === "sedlová" || job.roof.type === "valbová" || job.roof.type === "polovalbová";
  if (does("krytina") && hasRidge && !hasItem(items, "hreben")) {
    out.push({
      severity: "upozornenie",
      message: "Sedlová/valbová strecha má hrebeň — hrebenáče v ponuke nevidím.",
    });
  }

  // --- Práce vůbec? Materiál bez práce je ceník, ne nabídka. ---
  if (!items.some((i) => i.kind === "praca")) {
    out.push({
      severity: "chyba",
      message: "V ponuke nie je žiadna práca — je tam len materiál.",
    });
  }

  // --- Řádek bez ceny odejde jako nula a podhodnotí nabídku. ---
  const missingPrice = items.filter((i) => i.total == null);
  if (missingPrice.length) {
    out.push({
      severity: "chyba",
      message: `${missingPrice.length} položk(a/y) nemá cenu (${missingPrice
        .map((i) => i.label)
        .slice(0, 3)
        .join(", ")}). Do súčtu vstúpi ako nula.`,
    });
  }

  return out;
}
