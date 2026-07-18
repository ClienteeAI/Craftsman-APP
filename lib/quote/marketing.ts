import Anthropic from "@anthropic-ai/sdk";

/**
 * Auto-marketing z hotové zakázky.
 *
 * „Nemá marketing a nikdy mít nebude." Řemeslník po realizaci nemá čas ani chuť
 * psát na Facebook nebo prosit o recenzi. Tohle mu z pár údajů o zakázce udělá
 * hotový příspěvek, prosbu o Google recenzi i krátký popisek do portfolia —
 * stačí zkopírovat a poslat.
 */

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Chybí ANTHROPIC_API_KEY v .env.local");
    client = new Anthropic();
  }
  return client;
}

export type MarketingInput = {
  companyName: string;
  obec: string | null;
  customerName: string | null;
  productName: string | null;
  summary: string | null;
};

export type MarketingAssets = {
  /** Příspěvek na Facebook/Instagram. */
  fbPost: string;
  /** Zpráva zákazníkovi s prosbou o Google recenzi. */
  reviewRequest: string;
  /** Krátký popisek do portfolia (jedna věta). */
  portfolioCaption: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    fbPost: { type: "string" },
    reviewRequest: { type: "string" },
    portfolioCaption: { type: "string" },
  },
  required: ["fbPost", "reviewRequest", "portfolioCaption"],
  additionalProperties: false,
};

const SYSTEM = `Si marketingový asistent slovenského pokrývača. Z údajov o hotovej zákazke vytvoríš tri hotové texty, ktoré majster len skopíruje. Píš po slovensky, prirodzene, ako remeselník — nie ako korporát.

VÝSTUPY:
1) fbPost — príspevok na Facebook/Instagram o dokončenej realizácii. 2–4 vety, ľudsky, hrdo ale bez pátosu. Smie mať pár emoji a 2–3 hashtagy (#strecha #pokryvac + obec). Spomeň obec a typ/značku krytiny, ak sú. Zakonči jemnou výzvou (napr. "Ozvite sa, radi poradíme.").
2) reviewRequest — krátka milá správa zákazníkovi (tykanie/vykanie podľa bežného úzu, skôr vykanie), poďakovanie za dôveru a prosba o Google recenziu. Nechaj na koniec zástupný text [ODKAZ NA RECENZIU], kam si majster vloží odkaz.
3) portfolioCaption — jedna veta do portfólia (napr. "Kompletná výmena strechy, Bramac Tegalit, Nitra").

PRAVIDLÁ:
- Nevymýšľaj údaje, ktoré nemáš (ceny, počty). Pracuj len s tým, čo dostaneš.
- Ak niečo chýba (obec, značka), text napíš tak, aby dával zmysel aj bez toho.
- Žiadne klamlivé superlatívy. Dôveryhodne, striedmo.`;

export async function generateMarketing(input: MarketingInput): Promise<MarketingAssets> {
  const facts = [
    `Firma: ${input.companyName}`,
    input.obec ? `Obec: ${input.obec}` : null,
    input.productName ? `Krytina/materiál: ${input.productName}` : null,
    input.summary ? `Zhrnutie zákazky: ${input.summary}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await getClient().messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
    max_tokens: 1500,
    system: SYSTEM,
    thinking: { type: "disabled" },
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [{ role: "user", content: facts }],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Model nevrátil text.");
  return JSON.parse(text.text) as MarketingAssets;
}
