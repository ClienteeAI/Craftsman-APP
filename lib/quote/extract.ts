import Anthropic from "@anthropic-ai/sdk";
import { ROOF_TYPES, SCOPE_ITEMS, type Extraction } from "./types";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Chybí ANTHROPIC_API_KEY v .env.local");
    client = new Anthropic();
  }
  return client;
}

const SCHEMA = {
  type: "object",
  properties: {
    job: {
      type: "object",
      properties: {
        customer: {
          type: "object",
          properties: {
            name: { type: ["string", "null"] },
            obec: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            email: { type: ["string", "null"] },
          },
          required: ["name", "obec", "phone", "email"],
          additionalProperties: false,
        },
        roof: {
          type: "object",
          properties: {
            // anyOf, ne `type: [string,null] + enum` — validátor Anthropicu
            // vyžaduje, aby hodnoty enumu seděly na deklarovaný typ.
            type: { anyOf: [{ type: "string", enum: ROOF_TYPES }, { type: "null" }] },
            areaM2: { type: ["number", "null"] },
            pitchDeg: { type: ["number", "null"] },
            lengthM: { type: ["number", "null"] },
            widthM: { type: ["number", "null"] },
          },
          required: ["type", "areaM2", "pitchDeg", "lengthM", "widthM"],
          additionalProperties: false,
        },
        product: {
          type: "object",
          properties: {
            brand: { type: ["string", "null"] },
            model: { type: ["string", "null"] },
            colour: { type: ["string", "null"] },
          },
          required: ["brand", "model", "colour"],
          additionalProperties: false,
        },
        penetrations: {
          type: "object",
          properties: {
            chimneys: { type: ["number", "null"] },
            skylights: { type: ["number", "null"] },
            vents: { type: ["number", "null"] },
          },
          required: ["chimneys", "skylights", "vents"],
          additionalProperties: false,
        },
        scope: { type: "array", items: { type: "string", enum: SCOPE_ITEMS } },
        notes: { type: ["string", "null"] },
      },
      required: ["customer", "roof", "product", "penetrations", "scope", "notes"],
      additionalProperties: false,
    },
    followUps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["field", "question"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
  },
  required: ["job", "followUps", "summary"],
  additionalProperties: false,
} as const;

const SYSTEM = `Si asistent slovenského pokrývača. Zo súvislej reči majstra vytiahneš parametre zákazky.

Majster hovorí po slovensky alebo česky, v teréne, často nespisovne a v jednej dlhej vete. Čísla hovorí slovom ("stoosemdesiat", "dva komíny"). Rozumej mu ako kolega, nie ako formulár.

PRAVIDLÁ:
- Vypĺňaj len to, čo naozaj povedal. Čo nepovedal, nechaj null. Nikdy nič nedomýšľaj.
- "približne 180 metrov štvorcových" → areaM2: 180
- Ak povie rozmery ("dvanásť krát osem"), vyplň lengthM a widthM a areaM2 nechaj null — plochu si dopočítame sami zo sklonu.
- Značku a model rozdeľ: "Bramac Tegalit" → brand "Bramac", model "Tegalit".
- scope: vyber len to, čo výslovne spomenul. "mení sa celá krytina aj latovanie" → ["krytina", "latovanie"].
- Do notes daj len to, čo sa nezmestilo do štruktúry. Nie prerozprávanie.

DOPLŇUJÚCE OTÁZKY (followUps):
- Pýtaj sa LEN na to, čo naozaj chýba a bez čoho sa nedá spočítať cena.
- Sklon strechy (roof.pitchDeg) je povinný — bez neho nevieme plochu ani spotrebu. Ak ho nepovedal, pýtaj sa naň VŽDY.
- Ak nevieme ani plochu, ani rozmery, pýtaj sa na plochu.
- Nepýtaj sa na telefón a mail, ak ide o obhliadku — to doplní neskôr v karte zákazníka.
- Maximálne 3 otázky. Krátke, jedna veta, tak ako by sa spýtal kolega.
- Kde to dáva zmysel, ponúkni options (napr. bežné sklony: "35°", "40°", "45°").
- field je cesta do objektu, napr. "roof.pitchDeg".

summary: jedna veta po slovensky, čo si pochopil. Napríklad:
"Nitra, sedlová strecha 180 m², Bramac Tegalit, 2 komíny, 3 strešné okná, mení sa krytina aj latovanie."`;

/** Nadiktovaná řeč → strukturované parametry zakázky + doptání na chybějící. */
export async function extractJob(transcript: string): Promise<Extraction> {
  const res = await getClient().messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
    max_tokens: 4000,
    system: SYSTEM,
    // Bez uvažování. Extrakce není náročná na inteligenci a majster stojí na
    // střeše ve větru — každá vteřina je znát. S adaptivním uvažováním to
    // trvalo 10 s, což je na hlasové ovládání nepoužitelné.
    thinking: { type: "disabled" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [{ role: "user", content: transcript }],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Model nevrátil text.");
  return JSON.parse(text.text) as Extraction;
}
