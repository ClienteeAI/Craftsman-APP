/**
 * Doména zakázky. Vychází přímo ze zadání klienta a z jeho vlastního příkladu:
 *
 *   "Bol som na obhliadke v Nitre. Sedlová strecha Bramac Tegalit, približne
 *    180 metrov štvorcových. Dva komíny, tri strešné okná. Mení sa celá
 *    krytina aj latovanie."
 *
 * Tahle věta musí projít. Je to jeho příklad, jeho slovy — když ji zvládneme,
 * uvěří všemu ostatnímu.
 */

export type RoofType = "sedlová" | "valbová" | "polovalbová" | "pultová" | "stanová" | "manzardová";

export const ROOF_TYPES: RoofType[] = [
  "sedlová",
  "valbová",
  "polovalbová",
  "pultová",
  "stanová",
  "manzardová",
];

/** Co se na střeše mění. Ovlivňuje výkaz i cenu práce. */
export type ScopeItem =
  | "krytina"
  | "latovanie"
  | "fólia"
  | "krov"
  | "žľaby"
  | "klampiarske prvky"
  | "zateplenie";

export const SCOPE_ITEMS: ScopeItem[] = [
  "krytina",
  "latovanie",
  "fólia",
  "krov",
  "žľaby",
  "klampiarske prvky",
  "zateplenie",
];

export type RoofJob = {
  customer: {
    name: string | null;
    obec: string | null;
    phone: string | null;
    email: string | null;
  };
  roof: {
    type: RoofType | null;
    areaM2: number | null;
    /** Sklon ve stupních. Majster ho často neřekne — doptáme se. */
    pitchDeg: number | null;
    /** Když řekne rozměry místo plochy, spočítáme ji sami. */
    lengthM: number | null;
    widthM: number | null;
  };
  product: {
    /** Bramac, Tondach, KM Beta, … */
    brand: string | null;
    /** Tegalit, Classic Protector Plus, … */
    model: string | null;
    colour: string | null;
  };
  penetrations: {
    chimneys: number | null;
    skylights: number | null;
    vents: number | null;
  };
  scope: ScopeItem[];
  notes: string | null;
};

/**
 * Doplňující otázka. Zadání to chce explicitně:
 * "Ak niektorý údaj chýba, položí jednoduchú doplňujúcu otázku."
 *
 * `field` drží cestu do RoofJob, ať víme, kam odpověď zapsat.
 */
export type FollowUp = {
  field: string;
  question: string;
  /** Nabídnuté volby — na mobilu se ťuká líp, než diktuje. */
  options?: string[];
};

export type Extraction = {
  job: RoofJob;
  followUps: FollowUp[];
  /** Krátké lidské shrnutí, co apka pochopila. Majster musí vidět, že mu rozumí. */
  summary: string;
};

export function emptyJob(): RoofJob {
  return {
    customer: { name: null, obec: null, phone: null, email: null },
    roof: { type: null, areaM2: null, pitchDeg: null, lengthM: null, widthM: null },
    product: { brand: null, model: null, colour: null },
    penetrations: { chimneys: null, skylights: null, vents: null },
    scope: [],
    notes: null,
  };
}
