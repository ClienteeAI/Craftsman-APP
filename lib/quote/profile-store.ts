"use client";

import { DEFAULT_PROFILE, type CraftsmanProfile } from "./profile";

/**
 * Profil majstra na jeho telefonu.
 *
 * localStorage, ne databáze — tu zatím nemáme. Na telefonu to přežije zavření
 * appky i restart, takže si sazby nastaví jednou a má je napořád. Až přijde
 * databáze, tohle se stane cache a pravda bude na serveru.
 *
 * Důsledek, který je potřeba znát: sazby jsou vázané na přístroj. Když majster
 * vezme jiný telefon, nastavuje znovu. Pro jednoho uživatele v terénu to je
 * v pohodě, pro firmu se třemi partami ne.
 */
const KEY = "profil-realizatora-v1";

export function loadProfile(): CraftsmanProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PROFILE;
    const saved = JSON.parse(raw) as Partial<CraftsmanProfile>;
    // Merge s výchozím: kdyby приbyla nová pole, starý uložený profil je nerozbije.
    return {
      ...DEFAULT_PROFILE,
      ...saved,
      company: { ...DEFAULT_PROFILE.company, ...(saved.company ?? {}) },
      labour: { ...DEFAULT_PROFILE.labour, ...(saved.labour ?? {}) },
      materialPrices: { ...DEFAULT_PROFILE.materialPrices, ...(saved.materialPrices ?? {}) },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(p: CraftsmanProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch (e) {
    console.warn("[profil] neuloženo:", e);
  }
}

/** Nastavil si už majster svoje sazby, nebo pořád jede na mých odhadech? */
export function isConfigured(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) !== null;
}
