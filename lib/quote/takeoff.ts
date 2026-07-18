import { battenSpacingMm, matchProduct, tilesPerM2, type RoofProduct } from "./products";
import type { RoofJob } from "./types";

/**
 * Jak moc si daným řádkem věříme. Majster to musí vidět na první pohled —
 * ať ví, kde stačí kouknout a kde má sáhnout.
 *
 *   computed  — spočítáno z technického listu výrobce. Tomuhle věř.
 *   estimated — odhad z plochy, protože nepadly rozměry. Zkontroluj.
 *   manual    — apka to neví, musíš doplnit.
 */
export type Confidence = "computed" | "estimated" | "manual";

export type LineItem = {
  label: string;
  /** Odkaz do ceníku výrobce. Když je vyplněný, cena je ověřená, ne odhad. */
  productId?: string;
  qty: number | null;
  unit: string;
  confidence: Confidence;
  /** Proč to tak je. Zobrazuje se u řádku — bez toho je to černá skříňka. */
  note: string | null;
  kind: "material" | "praca";
};

export type Takeoff = {
  items: LineItem[];
  /** Předpoklady, které jsme si museli vzít. Musí být vidět, ne schované. */
  assumptions: string[];
  product: RoofProduct | null;
};

/** Prořez. Na členité střeše víc, na jednoduché míň. */
const WASTE = 0.05;
/** Přesah fólie. */
const MEMBRANE_OVERLAP = 1.15;

/**
 * Odhad délky hřebene z plochy.
 *
 * Tohle je čistý odhad a je to poctivě přiznané. Z plochy samotné se hřeben
 * spočítat NEDÁ — potřeboval bys rozměry. Majster ale nadiktuje "180 metrov"
 * a rozměry neřekne, tak si vezmeme typickou délku krokve rodinného domu
 * a z ní hřeben dopočítáme. Řádek se označí jako odhad a jde přepsat.
 */
const TYPICAL_RAFTER_M = 6;

function ridgeLengthM(job: RoofJob): { value: number; estimated: boolean } | null {
  const { type, areaM2, lengthM, widthM } = job.roof;

  // Když padly rozměry, hřeben známe přesně.
  if (lengthM && widthM) {
    if (type === "sedlová" || type === "valbová") return { value: lengthM, estimated: false };
    if (type === "pultová") return { value: 0, estimated: false };
  }

  if (!areaM2) return null;

  // Jen plocha → odhad.
  if (type === "pultová") return { value: 0, estimated: true };
  if (type === "stanová") return { value: 0, estimated: true }; // stanová má jen nároží
  return { value: Math.round((areaM2 / (2 * TYPICAL_RAFTER_M)) * 10) / 10, estimated: true };
}

function eavesLengthM(job: RoofJob): { value: number; estimated: boolean } | null {
  const ridge = ridgeLengthM(job);
  if (!ridge) return null;
  const { type, lengthM } = job.roof;
  // Sedlová: okap na obou stranách, délka jako hřeben.
  if (type === "sedlová") return { value: (lengthM ?? ridge.value) * 2, estimated: ridge.estimated };
  return { value: ridge.value * 2, estimated: true };
}

/**
 * @param override Krytina pro tuhle variantu. Používají to cenové hladiny —
 *   majster nadiktoval jednu tašku, ale zákazníkovi ukazujeme tři.
 */
export function computeTakeoff(job: RoofJob, override?: RoofProduct | null): Takeoff {
  const product = override ?? matchProduct(job.product.brand, job.product.model);
  const items: LineItem[] = [];
  const assumptions: string[] = [];

  const area = job.roof.areaM2 ?? (job.roof.lengthM && job.roof.widthM ? job.roof.lengthM * job.roof.widthM : null);
  const pitch = job.roof.pitchDeg;
  const does = (s: string) => job.scope.includes(s as never);

  if (job.roof.areaM2 == null && area != null) {
    assumptions.push(`Plocha ${area} m² dopočítaná z rozměrů ${job.roof.lengthM} × ${job.roof.widthM} m.`);
  }

  // --- Krytina ---
  if (does("krytina") && area) {
    const perM2 = product ? tilesPerM2(product) : null;
    if (perM2) {
      items.push({
        label: `${product!.brand} ${product!.model} — základná škridla`,
        productId: product!.id,
        qty: Math.ceil(area * perM2 * (1 + WASTE)),
        unit: "ks",
        confidence: "computed",
        note: `${area} m² × ${perM2} ks/m² + ${WASTE * 100} % prerez. Spotreba z technického listu výrobcu.`,
        kind: "material",
      });
    } else {
      items.push({
        label: job.product.brand ? `${job.product.brand} ${job.product.model ?? ""}`.trim() : "Krytina",
        qty: null,
        unit: "ks",
        confidence: "manual",
        note: "Túto krytinu ešte nemáme v databáze — doplň spotrebu na m².",
        kind: "material",
      });
    }
  }

  // --- Laty ---
  if (does("latovanie") && area) {
    const spacing = product && pitch ? battenSpacingMm(product, pitch) : null;
    if (spacing) {
      items.push({
        label: "Strešné laty",
        qty: Math.ceil((area / (spacing / 1000)) * (1 + WASTE)),
        unit: "bm",
        confidence: "computed",
        note: `Rozteč ${spacing} mm pri sklone ${pitch}° podľa kladačskej tabuľky výrobcu.`,
        kind: "material",
      });
    }
  }

  // --- Fólie ---
  if (does("fólia") && area) {
    items.push({
      label: "Poistná hydroizolačná fólia",
      qty: Math.ceil(area * MEMBRANE_OVERLAP),
      unit: "m²",
      confidence: "computed",
      note: `${area} m² + ${Math.round((MEMBRANE_OVERLAP - 1) * 100)} % presah.`,
      kind: "material",
    });
  }

  // --- Hřebenáče ---
  if (does("krytina")) {
    const ridge = ridgeLengthM(job);
    if (ridge && ridge.value > 0) {
      items.push({
        label: "Hrebenáče",
        productId: product?.id,
        qty: Math.ceil(ridge.value * 2.5), // ~2,5 ks/bm
        unit: "ks",
        confidence: ridge.estimated ? "estimated" : "computed",
        note: ridge.estimated
          ? `Hrebeň ${ridge.value} m — ODHAD z plochy (typická krokva ${TYPICAL_RAFTER_M} m). Skontroluj.`
          : `Hrebeň ${ridge.value} m z rozmerov.`,
        kind: "material",
      });
      if (ridge.estimated) {
        assumptions.push(
          `Dĺžku hrebeňa (${ridge.value} m) sme odhadli z plochy — nepovedal si rozmery. Z plochy sa presne spočítať nedá.`,
        );
      }
    }
  }

  // --- Prostupy ---
  if (job.penetrations.chimneys) {
    items.push({
      label: "Oplechovanie komína",
      qty: job.penetrations.chimneys,
      unit: "ks",
      confidence: "computed",
      note: "Podľa počtu komínov zo zadania.",
      kind: "material",
    });
  }
  if (job.penetrations.skylights) {
    items.push({
      label: "Lemovanie strešného okna",
      qty: job.penetrations.skylights,
      unit: "ks",
      confidence: "computed",
      note: "Podľa počtu okien zo zadania.",
      kind: "material",
    });
  }

  // --- Okapy ---
  if (does("žľaby")) {
    const eaves = eavesLengthM(job);
    if (eaves) {
      items.push({
        label: "Odkvapový žľab",
        qty: Math.ceil(eaves.value),
        unit: "bm",
        confidence: eaves.estimated ? "estimated" : "computed",
        note: eaves.estimated ? "Odhad z plochy. Skontroluj." : "Z rozmerov.",
        kind: "material",
      });
    }
  }

  // --- Práce ---
  // Normohodiny apka NEVÍ a vedieť nemôže — líšia sa medzi majstrami dvojnásobne.
  // Majster si ich zadá raz vo svojom profile a odvtedy sa počítajú samy.
  if (area) {
    items.push({
      label: does("latovanie") ? "Demontáž, latovanie a pokládka krytiny" : "Pokládka krytiny",
      qty: area,
      unit: "m²",
      confidence: "manual",
      note: "Tvoja sadzba za m² z profilu.",
      kind: "praca",
    });
  }
  if (job.penetrations.chimneys) {
    items.push({
      label: "Napojenie na komín",
      qty: job.penetrations.chimneys,
      unit: "ks",
      confidence: "manual",
      note: "Tvoja sadzba za komín.",
      kind: "praca",
    });
  }
  if (job.penetrations.skylights) {
    items.push({
      label: "Osadenie strešného okna",
      qty: job.penetrations.skylights,
      unit: "ks",
      confidence: "manual",
      note: "Tvoja sadzba za okno.",
      kind: "praca",
    });
  }

  if (product?.safePitchDeg && pitch && pitch < product.safePitchDeg) {
    assumptions.push(
      `POZOR: sklon ${pitch}° je pod bezpečným sklonom krytiny (${product.safePitchDeg}°). Treba doplnkové opatrenia.`,
    );
  }

  return { items, assumptions, product };
}
