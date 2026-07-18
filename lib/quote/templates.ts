"use client";

/**
 * Šablony zakázek. „Dělám pořád to samé."
 *
 * Uloží text, který majster nadiktoval/napsal, pod názvem. Příště ho načte
 * jedním ťuknutím, upraví čísla a pošle dál — nemusí diktovat znova.
 *
 * localStorage, per zařízení. Jednoduché úmyslně: je to zkratka, ne data.
 */

export type Template = { id: string; name: string; transcript: string };

const KEY = "sablony-v1";

export function listTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Template[];
  } catch {
    return [];
  }
}

function write(t: Template[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch (e) {
    console.warn("[sablony] neuloženo:", e);
  }
}

export function saveTemplate(name: string, transcript: string): Template {
  const t: Template = {
    id: Math.random().toString(36).slice(2, 8),
    name: name.trim(),
    transcript: transcript.trim(),
  };
  write([t, ...listTemplates()]);
  return t;
}

export function deleteTemplate(id: string): void {
  write(listTemplates().filter((t) => t.id !== id));
}
