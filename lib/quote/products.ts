/**
 * Krytiny — ZDROJ PRAVDY pro výkaz materiálu.
 *
 * PRAVIDLO: sem jde jen to, co je doslova na webu nebo v ceníku výrobce.
 * Nic se nedomýšlí. Jedno vymyšlené číslo = řemeslník prodělá na zakázce.
 *
 * Katalog je postavený na tom, co se DOOPRAVDY prodává na Slovensku podle
 * ceníku platného od 1. 7. 2026. Původně tu byly Bramac MAX a Tegalit
 * Protector Plus — ani jeden ve slovenském ceníku není. MAX je tam jen jako
 * "Max 7°" (varianta pro nízké sklony, dražší než Tegalit), Protector Plus
 * vůbec. Kdybychom je nechali, řemeslník by poslal nabídku na tašku, kterou
 * si zákazník nemůže koupit.
 *
 * Technická data: bmigroup.com (technické listy), staženo 17. 7. 2026.
 * Ceny: lib/quote/pricelist.ts
 */

export type RoofProduct = {
  id: string;
  brand: string;
  model: string;
  material: "beton" | "keramika";
  grade: "zaklad" | "standard" | "premium";
  /** Jedna věta pro zákazníka. Tohle prodává, ne tabulka čísel. */
  pitch: string;
  /** Spotřeba ks/m² z technického listu. */
  tilesPerM2: { min: number; max: number } | null;
  /** Rozteč latí v mm — závisí na sklonu střechy. */
  battenSpacingMm: { min: number; max: number } | null;
  /** Bezpečný sklon. POZOR: není totéž co minimální sklon. */
  safePitchDeg: number | null;
  /** Minimální sklon — jen když je na stránce výrobce. */
  minPitchDeg: number | null;
  weightKgPerTile: number | null;
  imageUrl: string;
  sourceUrl: string;
  renderPrompt: string;
  /** Co u produktu nemáme ověřené a je potřeba doplnit. Zobrazuje se v UI. */
  caveat: string | null;
};

export const PRODUCTS: RoofProduct[] = [
  {
    id: "bramac-tegalit-novo",
    brand: "Bramac",
    model: "Tegalit Novo",
    material: "beton",
    grade: "zaklad",
    pitch: "Moderná plochá škridla bez vĺn. Najlepší pomer cena/vzhľad.",
    tilesPerM2: { min: 9.8, max: 10.6 },
    battenSpacingMm: { min: 315, max: 340 },
    safePitchDeg: 25,
    minPitchDeg: null, // na stránce výrobce není — nedomýšlíme
    weightKgPerTile: 5.2,
    imageUrl:
      "https://store.bmigroup.com/medias/Product-Hero-Small-Desktop-Tablet-Tegalit-NOVO-zakladn-ta-ka-1-1-b-idlicov-ern-.jpg?context=bWFzdGVyfHJvb3R8MTkxMTR8aW1hZ2UvanBlZ3xhR1V4TDJnM05TODVNekUxTkRBek9ESTFNVGd5TDFCeWIyUjFZM1F0U0dWeWJ5MVRiV0ZzYkMxRVpYTnJkRzl3TFZSaFlteGxkRjlVWldkaGJHbDBJRTVQVms5ZmVtRnJiR0ZrYnNPdElIUmh4YUZyWVNBeFh6RmZZc1daYVdSc2FXTnZkc1NiSU1TTlpYSnV3NkV1YW5CbnxmMWU0NDFlMWY4ZDdmOWM5Njg0MTUzMDhjMTZjOTYyNDMyNDE3NTlmMjA1OTRkYTM5Y2VlNDM0ZDY3OTkyZmUz",
    sourceUrl:
      "https://www.bmigroup.com/cz/p/tegalit-novo-základní-taška-01-břidlicově-černá-novo-vysoce-kvalitní-probarvený-beton-311721370/",
    renderPrompt:
      "flat smooth slate black concrete roof tiles, matte finish, clean modern flat profile with no waves",
    caveat:
      "Rozteč latí a bezpečný sklon převzaty z řady Tegalit — je to stejné těleso tašky, liší se povrchová úprava. Ověřit v technické příručce.",
  },
  {
    id: "bramac-tegalit-star",
    brand: "Bramac",
    model: "Tegalit Star",
    material: "beton",
    grade: "standard",
    pitch: "Tegalit s povrchom STAR — obmedzuje prehrievanie strechy.",
    tilesPerM2: { min: 9.8, max: 10.6 },
    battenSpacingMm: { min: 315, max: 340 },
    safePitchDeg: 25,
    minPitchDeg: null,
    weightKgPerTile: 5.2,
    imageUrl:
      "https://store.bmigroup.com/medias/Product-Hero-Small-Desktop-Tablet-Tegalit-Star-ta-ka-z-kladn-ebenov-ern-.jpg?context=bWFzdGVyfHJvb3R8MTk2MjF8aW1hZ2UvanBlZ3xhR1U1TDJneU5DODVNRFUzTmpBMU5UZ3lPRGM0TDFCeWIyUjFZM1F0U0dWeWJ5MVRiV0ZzYkMxRVpYTnJkRzl3TFZSaFlteGxkRjlVWldkaGJHbDBJRk4wWVhKZmRHSHZ2NzFyWVNCNjc3LTlhMnhoWkc3dnY3MWZaV0psYm05Mjc3LTlJTy1fdldWeWJ1LV92UzVxY0djfGZhNGE5NjZhYTU5YjYzNTk0YmM0OTUxMzdiYTcyMTQ1YzE3Y2MxNmVmNTZiNTMyYzdhMWY3YTFkNGM3MjNkZWI",
    sourceUrl:
      "https://www.bmigroup.com/cz/p/tegalit-star-základní-taška-03-ebenově-černá-star-vysoce-kvalitní-probarvený-beton-554516719/",
    renderPrompt:
      "flat smooth ebony black concrete roof tiles, matte finish, clean modern flat profile with no waves",
    caveat:
      "Rozteč latí a bezpečný sklon převzaty z řady Tegalit — stejné těleso tašky, jiná povrchová úprava. Ověřit v technické příručce.",
  },
  {
    id: "braas-rubin-13-glazura-cierna",
    brand: "Braas",
    model: "Rubín 13",
    material: "keramika",
    grade: "premium",
    pitch: "Pálená keramika, glazúra čierna. Životnosť až 100 rokov, farba nevybledne.",
    tilesPerM2: { min: 12.3, max: 13.5 },
    battenSpacingMm: { min: 330, max: 360 },
    safePitchDeg: 16,
    minPitchDeg: 12,
    weightKgPerTile: 3.2,
    imageUrl:
      "https://store.bmigroup.com/medias/Product-Hero-Small-Desktop-Tablet-Rubin-13-rezna.jpg?context=bWFzdGVyfHJvb3R8MTc1MTl8aW1hZ2UvanBlZ3xhRGRsTDJobU1TODVNRFUzTWpZM056UTBOems0TDFCeWIyUjFZM1F0U0dWeWJ5MVRiV0ZzYkMxRVpYTnJkRzl3TFZSaFlteGxkRjlTZFdKcGJpQXhNMTl5WlhwdVlTNXFjR2N8MjdiOWYxMzU0ZTVmODFjMTE0ZWJjYmM4N2Y5NDVmNWI4M2NjZWJiNjBjZjkxZDU3YzczZDkyNjAxMmVmNmZjZQ",
    sourceUrl:
      "https://www.bmigroup.com/cz/p/rubín-13-základní-taška-01-režná-režná-vypalovaný-jíl-s-příměsí-3538180012/",
    renderPrompt:
      "traditional glazed black fired clay roof tiles, classic wavy profile, glossy glazed finish",
    caveat:
      "Rubín 13 má 4 povrchové úpravy s cenami 2,33–2,75 €/ks (rozdiel 18 %). Tu je glazúra čierna. Výber povrchu zatiaľ nie je v aplikácii.",
  },
];

export function findProduct(id: string): RoofProduct | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/**
 * Najde produkt podle toho, co majster nadiktoval ("Bramac Tegalit").
 *
 * POZOR na pořadí. Majster skoro nikdy neřekne přesnou řadu — řekne "Tegalit"
 * a myslí tím tašku, ne povrchovou úpravu. Když se v takovém případě sáhne po
 * první shodě v poli, vyhraje náhoda: "tegalit novo".includes("tegalit") je
 * true, takže by dostal nejlevnější řadu a doporučenou hladinou by byl Základ.
 * Na 180 m² střeše je to rozdíl 1 800 € a majster by nevěděl proč.
 *
 * Proto: přesná shoda → jinak rodina + štandard.
 */
export function matchProduct(brand: string | null, model: string | null): RoofProduct | null {
  if (!brand && !model) return null;
  const b = (brand ?? "").toLowerCase().trim();
  const m = (model ?? "").toLowerCase().trim();
  const brandOk = (p: RoofProduct) => !b || p.brand.toLowerCase() === b;

  // 1. Řekl přesně ("Tegalit Star") — bereme to.
  const exact = PRODUCTS.find((p) => brandOk(p) && p.model.toLowerCase() === m);
  if (exact) return exact;

  // 2. Řekl rodinu ("Tegalit") — bereme štandard, ne to, co je první v poli.
  const family = m ? PRODUCTS.filter((p) => brandOk(p) && p.model.toLowerCase().startsWith(m)) : [];
  if (family.length) return family.find((p) => p.grade === "standard") ?? family[0];

  // 3. Řekl jen značku.
  const byBrand = b ? PRODUCTS.filter(brandOk) : [];
  return byBrand.find((p) => p.grade === "standard") ?? byBrand[0] ?? null;
}

/** Střed rozsahu spotřeby z technického listu. */
export function tilesPerM2(p: RoofProduct): number | null {
  if (!p.tilesPerM2) return null;
  return Math.round(((p.tilesPerM2.min + p.tilesPerM2.max) / 2) * 10) / 10;
}

/**
 * Rozteč latí podle sklonu. Čím nižší sklon, tím hustěji — voda musí odtéct
 * dřív, než ji vítr zafouká pod tašku.
 */
export function battenSpacingMm(p: RoofProduct, pitchDeg: number): number | null {
  if (!p.battenSpacingMm) return null;
  const { min, max } = p.battenSpacingMm;
  const safe = p.safePitchDeg ?? 25;
  if (pitchDeg <= safe) return min;
  if (pitchDeg >= 45) return max;
  return Math.round(min + ((pitchDeg - safe) / (45 - safe)) * (max - min));
}
