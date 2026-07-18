/**
 * Profil realizátora. Zadání klienta to chce doslova:
 * "Realizátor si môže editovať hlavičku - svoje kontaktné údaje, logo firmy,
 *  svoje ceny práce a želanú ziskovosť zo zákazky v %."
 *
 * Tohle si majster nastaví JEDNOU a od té chvíle se každá nabídka počítá sama.
 * To je celý ten produkt: apka nezná jeho ceny, ale zapamatuje si je.
 */

export type Money = number; // EUR

export type CraftsmanProfile = {
  company: { name: string; phone: string; email: string; logoUrl: string | null };
  /** Sazby za práci. Tohle apka vědět nemůže — liší se mezi majstry dvojnásobně. */
  labour: {
    perM2Full: Money; // demontáž + latovanie + pokládka
    perM2Covering: Money; // len pokládka
    perChimney: Money;
    perSkylight: Money;
  };
  /** Ceny materiálu za jednotku. Bramac ceny nezveřejňuje → zadává je majster. */
  materialPrices: Record<string, Money>;
  /** Želaná ziskovosť zo zákazky v %. */
  marginPct: number;
  vatPct: number;
  /**
   * Najbližší voľný termín realizácie. #29 — prvá otázka každého zákazníka
   * ("kedy to spravíte?"), zodpovedaná skôr, než ju položí. Voľný text, ať
   * môže napísať "od polovice augusta" aj konkrétny dátum.
   */
  earliestTerm: string;
};

/**
 * VÝCHOZÍ HODNOTY JSOU ODHAD TRHU, NE SKUTEČNÉ CENY.
 *
 * Nemám je odkud vzít — Bramac ceníky nezveřejňuje a normohodiny nezveřejňuje
 * nikdo. Jsou tu proto, aby demo ukázalo hotovou nabídku a ne prázdné řádky.
 * V UI musí být označené jako "uprav si" a majster je přepíše první den.
 *
 * NIKDY je nevydávej za ceny z ceníku.
 */
export const DEFAULT_PROFILE: CraftsmanProfile = {
  company: {
    name: "Tvoja firma s.r.o.",
    phone: "+421 900 000 000",
    email: "info@tvojafirma.sk",
    logoUrl: null,
  },
  labour: {
    perM2Full: 28,
    perM2Covering: 15,
    perChimney: 190,
    perSkylight: 150,
  },
  materialPrices: {
    // Škridly sem NEPATŘÍ — ty mají ověřené ceny v lib/quote/pricelist.ts
    // z oficiálního ceníku výrobce. Tady zůstává jen materiál, na který
    // ceník nemáme, a je to poctivě označené jako odhad.
    "Strešné laty": 1.6,
    "Poistná hydroizolačná fólia": 2.2,
    "Hrebenáče": 6.5,
    "Oplechovanie komína": 110,
    "Lemovanie strešného okna": 85,
    "Odkvapový žľab": 14,
  },
  marginPct: 15,
  vatPct: 23, // SK
  earliestTerm: "",
};
