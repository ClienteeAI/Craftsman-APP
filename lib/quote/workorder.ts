import Anthropic from "@anthropic-ai/sdk";

/**
 * Zákazkový list pro partu — v jejich jazyce.
 *
 * Nabídka jde slovensky zákazníkovi, ale příkaz partě potřebuje majster v
 * jazyce, kterým parta reálně mluví (často ukrajinsky). Z položek nabídky
 * a parametrů střechy udělá jasný pracovní příkaz: co udělat, kolik čeho,
 * na co si dát pozor. Bez cen — parta ceny nepotřebuje.
 */

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Chybí ANTHROPIC_API_KEY v .env.local");
    client = new Anthropic();
  }
  return client;
}

export type WorkOrderInput = {
  /** ISO 639-1: "uk" ukrajinsky, "sk" slovensky, "pl" polsky, "ro" rumunsky… */
  lang: string;
  obec: string | null;
  summary: string | null;
  /** Materiálové položky (bez cen) — label + množství. */
  materials: { label: string; qty: number | null; unit: string }[];
  /** Krátké upozornění (sklon pod bezpečný, komín bez oplechování apod.). */
  warnings: string[];
};

const LANG_NAMES: Record<string, string> = {
  uk: "Ukrainian",
  sk: "Slovak",
  pl: "Polish",
  ro: "Romanian",
  hu: "Hungarian",
  en: "English",
};

const SYSTEM = `You write a clear, practical work order for a roofing crew. Output ONLY the work order text in the requested language — no preamble, no explanation, no prices.

Structure it simply:
- A short heading with the location (if given).
- What to do (from the summary).
- Materials with quantities (list them).
- "Pozor / Attention" notes for anything risky (translate the warnings).

Keep it short, direct and unambiguous — a foreman reads it on a phone on site. Use the crew's language throughout.`;

export async function generateWorkOrder(input: WorkOrderInput): Promise<string> {
  const langName = LANG_NAMES[input.lang] ?? "Ukrainian";
  const materials = input.materials
    .filter((m) => m.qty != null)
    .map((m) => `- ${m.label}: ${m.qty} ${m.unit}`)
    .join("\n");

  const facts = [
    `Target language: ${langName}.`,
    input.obec ? `Location: ${input.obec}` : null,
    input.summary ? `Job: ${input.summary}` : null,
    materials ? `Materials:\n${materials}` : null,
    input.warnings.length ? `Warnings to translate:\n${input.warnings.map((w) => `- ${w}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await getClient().messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
    max_tokens: 1200,
    system: SYSTEM,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    messages: [{ role: "user", content: facts }],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Model nevrátil text.");
  return text.text.trim();
}
