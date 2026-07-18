/**
 * Ceny materiálu z oficiálního ceníku výrobce.
 *
 * ═══ PROČ MÁ KAŽDÁ CENA ZDROJ A STRÁNKU ═══
 *
 * První pokus o vyčtení tohoto ceníku vrátil u tří úplně jiných krytin shodně
 * "2,86 €/ks, 28,60 €/m², spotreba 10 ks/m²". Model našel první tabulku
 * v dokumentu (Tegalit Star, str. 6) a nakopíroval ji na všechny modely.
 * Chytili jsme to jen proto, že spotřeby máme nezávisle z technických listů.
 *
 * Čísla níže jsou ověřená třemi způsoby:
 *   1. cena/m² ÷ cena/ks = vytištěná spotřeba  (sedí na 2 desetinná místa)
 *   2. s DPH ÷ bez DPH = 1,23  (slovenská DPH)
 *   3. druhý nezávislý parser potvrdil párování materiálových čísel
 *
 * Cena bez zdroje se sem nedostane.
 */

export type PriceSource = {
  document: string;
  url: string;
  /** ISO datum, od kdy ceník platí. */
  validFrom: string;
  currency: "EUR";
  country: "SK";
  fetchedAt: string;
};

export const BRAMAC_SK_2026: PriceSource = {
  document: "Cenník Bramac / Braas platný od 1. 7. 2026",
  url: "https://dxb-slovakia.payloadcms.app/api/document/file/Bramac_Cennik_1.7.2026_FINAL.pdf",
  validFrom: "2026-07-01",
  currency: "EUR",
  country: "SK",
  fetchedAt: "2026-07-17",
};

export type TilePrice = {
  productId: string;
  /** Stránka v ceníku — ať jde cena dohledat. */
  page: number;
  /** Základná škridla 1/1, bez DPH. */
  perPiece: number;
  perM2: number;
  /** Spotřeba tak, jak ji uvádí CENÍK (verbatim). Kontrola proti tech. listu. */
  statedConsumption: string;
  /** Hrebenáč — u betonových je to SET včetně príchytky, u keramiky zvlášť. */
  ridgeTile: { price: number; isSet: boolean; consumption: string };
  /** Príchytka hrebenáča samostatně. null = je v ceně setu, needuplikovat. */
  ridgeClip: number | null;
  vergeTile: { price: number; consumption: string } | null;
  ventTile: { price: number; consumption: string } | null;
  source: PriceSource;
};

export const PRICES: TilePrice[] = [
  {
    productId: "bramac-tegalit-novo",
    page: 13,
    perPiece: 2.37,
    perM2: 23.7,
    statedConsumption: "spotreba cca. 10 ks/m2",
    ridgeTile: { price: 5.0, isSet: true, consumption: "2,5 ks / 1 m" },
    ridgeClip: null, // v setu
    vergeTile: { price: 10.21, consumption: "cca 1,5 ks/m" },
    ventTile: { price: 12.62, consumption: "min. 10 ks/100 m2" },
    source: BRAMAC_SK_2026,
  },
  {
    productId: "bramac-tegalit-star",
    page: 6,
    perPiece: 2.86,
    perM2: 28.6,
    statedConsumption: "Spotreba: 10 ks/m2",
    ridgeTile: { price: 8.62, isSet: true, consumption: "2,5 ks / 1 m" },
    ridgeClip: null, // v setu
    vergeTile: { price: 12.62, consumption: "cca 1,5 ks/m" },
    ventTile: { price: 17.01, consumption: "min. 10 ks/100 m2" },
    source: BRAMAC_SK_2026,
  },
  {
    // Rubín 13 má 4 ceny podle povrchu (2,33–2,75 €/ks). Bereme glazúru čiernu
    // jako prémiovou variantu. Cílově musí datový model nést variantu povrchu —
    // rozdíl medená vs. glazúra je 18 %, na 150 m² skoro 800 €.
    productId: "braas-rubin-13-glazura-cierna",
    page: 23,
    perPiece: 2.75,
    perM2: 33.83,
    statedConsumption: "Spotreba: cca. 12,3 ks/m2",
    ridgeTile: { price: 12.18, isSet: true, consumption: "2,5 ks / 1 m" },
    ridgeClip: 0.46, // u keramiky JE i samostatně — nesčítat dvakrát se setem
    vergeTile: { price: 11.53, consumption: "cca 2,8 ks/m" },
    ventTile: { price: 8.07, consumption: "min. 25 ks/100 m2" },
    source: BRAMAC_SK_2026,
  },
];

export function priceFor(productId: string): TilePrice | undefined {
  return PRICES.find((p) => p.productId === productId);
}

/** Ceník starší než rok je podezřelý — výrobci je mění zhruba ročně. */
export function isStale(source: PriceSource, today = new Date()): boolean {
  const months = (today.getTime() - new Date(source.validFrom).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return months > 12;
}
