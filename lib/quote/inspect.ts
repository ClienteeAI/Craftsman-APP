import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("Chýba ANTHROPIC_API_KEY");
    client = new Anthropic();
  }
  return client;
}

export type RoofFinding = {
  /** Krátký název, co je vidět. */
  label: string;
  /** Co s tím — do nabídky, k prověření. */
  note: string;
  /** low = mohl by ses splést, high = jasně vidět. */
  confidence: "low" | "high";
};

export type Inspection = {
  findings: RoofFinding[];
  /** Jedna věta shrnutí pro majstra. */
  summary: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          note: { type: "string" },
          confidence: { type: "string", enum: ["low", "high"] },
        },
        required: ["label", "note", "confidence"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
  },
  required: ["findings", "summary"],
  additionalProperties: false,
} as const;

/**
 * Systémový prompt je celý o jednom: NEHALUCINOVAT.
 *
 * Diagnóza střechy z fotky má stejné riziko jako všechno ostatní — model rád
 * "vidí" prasklou tašku, i když tam není. A tady je to nebezpečnější: majster
 * podle toho osloví zákazníka. Když si to vymyslí a zákazník tam nic nenajde,
 * majster vypadá jako podvodník.
 *
 * Proto: jen co je NA FOTCE JASNĚ VIDĚT, radši míň než víc, a všechno jako
 * "skontroluj", ne jako fakt. Prázdný seznam je legitimní a správný výsledek.
 */
const SYSTEM = `Si skúsený pokrývač a pozeráš sa na fotku strechy pred obhliadkou. Tvoja úloha je pomôcť majstrovi — upozorniť ho na to, čo je na streche VIDNO, aby na nič nezabudol v ponuke.

ŽELEZNÉ PRAVIDLO: Hovor LEN o tom, čo je na fotke jasne a zreteľne vidno. Nič nedomýšľaj, nič nepredpokladaj, nič nevymýšľaj. Ak si nie si istý, DAJ TO PREČ. Prázdny zoznam je úplne v poriadku a je lepší než vymyslený nález.

Prečo: majster podľa teba osloví zákazníka. Ak povieš "vidím prasknutú škridlu" a žiadna tam nie je, majster vyzerá ako podvodník. Radšej mlč, než klam.

Čoho si všímať (LEN ak je to zreteľne vidno):
- mach, riasy, zelený povlak na škridlách
- viditeľne posunuté, prasknuté alebo chýbajúce škridly
- chýbajúce alebo poškodené snehové zábrany
- stav oplechovania komína, úžľabí
- strešné okná (počet, stav)
- antény, prestupy, ktoré treba obísť
- celkový vek / opotrebenie krytiny

Ku každému nálezu:
- label: krátky názov (napr. "Mach na severnej strane")
- note: čo s tým — čo doplniť do ponuky alebo overiť na mieste
- confidence: "high" ak je to jasne vidno, "low" ak sa MÔŽEŠ mýliť

confidence "low" použi štedro — radšej označ neistotu, než tváriť sa isto.

summary: jedna vecná veta. Ak nič zreteľné nevidíš, napíš to na rovinu — napríklad "Na fotke nevidím nič zvláštne, škridla vyzerá v poriadku."`;

/** Fotka střechy → co je na ní vidět. Nástroj pro majstra, ne pro zákazníka. */
export async function inspectRoof(photo: Buffer, mimeType: string): Promise<Inspection> {
  const media =
    mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/webp" || mimeType === "image/gif"
      ? (mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif")
      : "image/png";

  const res = await getClient().messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
    max_tokens: 2000,
    system: SYSTEM,
    // Vidění chce uvažování — na rozdíl od extrakce. Ale nízké, ať to není věčnost.
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: media, data: photo.toString("base64") } },
          { type: "text", text: "Čo vidíš na tejto streche?" },
        ],
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Model nevrátil text.");
  return JSON.parse(text.text) as Inspection;
}
