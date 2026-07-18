/**
 * Obsáhlá data zakázky — všechno, co pokrývač u zakázky potřebuje vědět.
 *
 * Uloženo jako jeden JSON blok (`details`) na zakázce. Formulář v detailu se
 * generuje z konfigurace níž (SECTIONS), ať se pole přidávají bez psaní UI.
 *
 * Technické parametry (typ, sklon, plocha, prostupy…) se automaticky předvyplní
 * z toho, co majster nadiktoval při tvorbě nabídky — nemusí je psát dvakrát.
 */

export type FieldType = "text" | "num" | "bool" | "date" | "textarea";

export type DetailField = {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
};

export type DetailSection = {
  title: string;
  /** Krátký popis pod nadpisem sekce. */
  note?: string;
  fields: DetailField[];
};

/** Volná struktura — klíče odpovídají DetailField.key. */
export type JobDetails = Record<string, string | number | boolean | null>;

export const SECTIONS: DetailSection[] = [
  {
    title: "Kontakt a fakturácia",
    note: "Adresa stavby a fakturačná bývajú iné — zákazník býva inde, než sa robí strecha.",
    fields: [
      { key: "constructionAddress", label: "Adresa stavby", type: "text" },
      { key: "billingAddress", label: "Fakturačná adresa", type: "text" },
      { key: "isCompany", label: "Firma (nie fyzická osoba)", type: "bool" },
      { key: "ico", label: "IČO", type: "text" },
      { key: "dic", label: "DIČ", type: "text" },
      { key: "leadSource", label: "Zdroj dopytu (odporúčanie, web, FB…)", type: "text" },
    ],
  },
  {
    title: "Strecha — technické parametre",
    note: "Jadro kalkulácie. Predvyplní sa z toho, čo si nadiktoval do ponuky.",
    fields: [
      { key: "roofType", label: "Typ strechy (sedlová, valbová, pultová…)", type: "text" },
      { key: "pitchDeg", label: "Sklon (°)", type: "num", hint: "kľúčové — určuje plochu aj vhodnú krytinu" },
      { key: "areaM2", label: "Skutočná plocha krytiny (m²)", type: "num", hint: "nie pôdorys — kvôli sklonu je väčšia" },
      { key: "lengthM", label: "Dĺžka (m)", type: "num" },
      { key: "widthM", label: "Šírka (m)", type: "num" },
      { key: "ridgeHeightM", label: "Výška hrebeňa (m)", type: "num" },
      { key: "floors", label: "Počet podlaží", type: "num", hint: "kvôli lešeniu a doprave hore" },
    ],
  },
  {
    title: "Líniové prvky (bm)",
    note: "Počítajú sa zvlášť, nie cez m².",
    fields: [
      { key: "eavesM", label: "Odkvapy", type: "num" },
      { key: "ridgeM", label: "Hrebene", type: "num" },
      { key: "hipsM", label: "Nárožia", type: "num" },
      { key: "valleysM", label: "Úžľabia", type: "num" },
      { key: "gablesM", label: "Štíty", type: "num" },
    ],
  },
  {
    title: "Krytina a konštrukcia",
    fields: [
      { key: "productName", label: "Krytina — výrobca a model", type: "text" },
      { key: "colour", label: "Farba", type: "text" },
      { key: "isReconstruction", label: "Rekonštrukcia (nie novostavba)", type: "bool" },
      { key: "demolition", label: "Demontáž starej krytiny + likvidácia odpadu", type: "bool" },
      { key: "trussCondition", label: "Stav krovu a latí (oprava?)", type: "text" },
      { key: "membrane", label: "Poistná hydroizolácia / difúzna fólia", type: "bool" },
      { key: "insulation", label: "Zateplenie (hrúbka)", type: "text" },
    ],
  },
  {
    title: "Prostupy a doplnky",
    note: "Často sa zabudnú a potom chýbajú v cene.",
    fields: [
      { key: "skylights", label: "Strešné okná (počet)", type: "num" },
      { key: "dormers", label: "Vikiere (počet)", type: "num" },
      { key: "chimneys", label: "Komíny (počet)", type: "num" },
      { key: "gutterSystem", label: "Odkvapový systém (materiál, rozmer)", type: "text" },
      { key: "flashing", label: "Klampiarske prvky (oplechovanie, lemovanie)", type: "bool" },
      { key: "snowGuards", label: "Snehové zábrany", type: "bool" },
      { key: "roofExit", label: "Strešný výlez", type: "bool" },
      { key: "lightningRod", label: "Bleskozvod", type: "bool" },
      { key: "pvPrep", label: "Príprava pod fotovoltiku", type: "bool" },
    ],
  },
  {
    title: "Logistika a prístup",
    fields: [
      { key: "access", label: "Prístupnosť pre techniku a zloženie materiálu", type: "text" },
      { key: "scaffolding", label: "Lešenie", type: "bool" },
      { key: "crane", label: "Žeriav", type: "bool" },
      { key: "lift", label: "Stavebný výťah", type: "bool" },
      { key: "distanceKm", label: "Vzdialenosť od prevádzky (km)", type: "num" },
    ],
  },
  {
    title: "Riadenie zákazky",
    fields: [
      { key: "inquiryDate", label: "Dátum dopytu", type: "date" },
      { key: "desiredTerm", label: "Želaný termín zákazníka", type: "text" },
      { key: "durationDays", label: "Predpokladaná dĺžka realizácie (dni)", type: "num" },
    ],
  },
];
