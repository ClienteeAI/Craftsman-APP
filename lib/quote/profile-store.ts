"use client";

import { DEFAULT_COMMUNICATION, DEFAULT_PROFILE, type CraftsmanProfile } from "./profile";

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
      customLabour: Array.isArray(saved.customLabour) ? saved.customLabour : [],
      materialPrices: { ...DEFAULT_PROFILE.materialPrices, ...(saved.materialPrices ?? {}) },
      communication: { ...DEFAULT_COMMUNICATION, ...(saved.communication ?? {}) },
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
  backup(p);
}

/** Nastavil si už majster svoje sazby, nebo pořád jede na mých odhadech? */
export function isConfigured(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) !== null;
}

/**
 * Cloudová záloha profilu, fire-and-forget. Když Supabase není, endpoint vrátí
 * synced:false a nic se neděje. Nikdy nesmí shodit UI — spolkne .catch().
 */
function backup(p: CraftsmanProfile): void {
  if (typeof window === "undefined") return;
  fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Obnova profilu ze zálohy — jen když si ho majster na tomto zařízení ještě
 * nenastavil. Nový/vyměněný telefon si tak stáhne sazby a logo. Vrací true,
 * když se něco obnovilo (ať se stránka překreslí).
 */
export async function restoreProfileIfMissing(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isConfigured()) return false;
  try {
    const res = await fetch("/api/profile", { cache: "no-store" });
    if (!res.ok) return false;
    const body = await res.json();
    if (body.synced && body.profile) {
      localStorage.setItem(KEY, JSON.stringify(body.profile));
      return true;
    }
  } catch {
    // Bez signálu zůstaneme u výchozích, zkusí se to při dalším otevření.
  }
  return false;
}
