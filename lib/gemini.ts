import { GoogleGenAI } from "@google/genai";

// Obrázkové modely se mění po měsících, proto proměnná a ne konstanta v kódu.
//
// Varianty (stav 07/2026):
//   gemini-3.1-flash-image       generalista, 0.5K–4K, umí referenční obrázky  <- výchozí
//   gemini-3-pro-image           nejlepší kvalita, 2x dražší
//   gemini-3.1-flash-lite-image  nejlevnější, ale jen 1K a podle Googlu
//                                "not optimized for multiple reference inputs"
//                                — což je přesně náš workload. Falešná úspora.
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";

// Rozlišení = cena. 0.5K $0.045 / 1K $0.067 / 2K $0.101 / 4K $0.151 za obrázek.
// Musí sedět na MAX_PHOTO_PX v composite.ts, jinak střechu při slepení
// natahujeme a je měkčí než zbytek fotky.
const IMAGE_SIZE = process.env.GEMINI_IMAGE_SIZE ?? "1K";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chybí GEMINI_API_KEY v .env.local");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export type ReferenceImage = { mimeType: string; data: Buffer };

/**
 * Opakování při výpadku sítě.
 *
 * Majster je na střeše, signál kolísá. Jedno blafnutí sítě nesmí znamenat
 * "Render zlyhal, ťukni znova" — to u chlapa s rukavicema na žebříku vadí.
 * Dvě opakování s krátkou pauzou pokryjí přechodné výpadky, aniž by ho to
 * nechalo dlouho čekat, když je síť fakt pryč.
 */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

/**
 * Pošle fotku modelu s instrukcí vyměnit krytinu a vrátí překreslený obrázek.
 *
 * POZOR: Gemini nemá vstup pro masku. Ověřeno v dokumentaci — jejich "inpainting"
 * je jen prosba v promptu ("change only the roof"), ne parametr. Proto se na to
 * nespoléháme: model překreslí celou fotku, my z výsledku vezmeme jen pixely
 * uvnitř naší masky (lib/composite.ts) a zbytek zahodíme.
 */
/**
 * Testovací režim. Když MOCK_RENDER=1, NEVOLÁ Gemini a vrátí vstupní fotku.
 * Kvůli tomu, aby šlo proklikat celý tok bez placení za generování obrázků —
 * jedno kolo testů jinak stojí reálné peníze. V produkci flag nenastavuj.
 */
const MOCK = process.env.MOCK_RENDER === "1";

export async function renderRoof(
  photo: Buffer,
  mimeType: string,
  materialPrompt: string,
  /** Produktová fotka krytiny od výrobce. Bez ní je výběr z katalogu kulisa. */
  reference?: ReferenceImage,
): Promise<Buffer> {
  if (MOCK) return photo;
  const ai = getClient();

  const prompt = [
    `Using the FIRST image (a photo of a house), change only the roof covering to ${materialPrompt}.`,
    reference
      ? `The SECOND image is a product swatch of the roof tile. Use it ONLY as a` +
        ` material sample — copy its colour, surface texture and tile profile.` +
        ` Do NOT copy any walls, windows, sky, background or objects from the` +
        ` second image. Take nothing from it except the tile material itself.`
      : "",
    `Keep everything else in the first image exactly the same, preserving the`,
    `original style, lighting, composition, camera angle and framing.`,
    `Keep the roof geometry identical: same ridge lines, same pitch, same eaves,`,
    `same chimney, same skylights in the same positions, same snow guards.`,
    `Do not change the walls, windows, garden, terrace or sky.`,
  ]
    .filter(Boolean)
    .join(" ");

  const parts: object[] = [
    { text: prompt },
    { inlineData: { mimeType, data: photo.toString("base64") } },
  ];
  if (reference) {
    parts.push({
      inlineData: { mimeType: reference.mimeType, data: reference.data.toString("base64") },
    });
  }

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: parts,
      config: {
        // Bez tohohle model rád přibalí i odstavec textu, který jen platíme.
        responseModalities: ["Image"],
        // aspectRatio schválně neuvádíme — model podle dokumentace sám drží poměr
        // vstupní fotky, a to je přesně to, co chceme.
        imageConfig: { imageSize: IMAGE_SIZE },
      },
    }),
  );

  return imageFromResponse(response);
}

/** Vytáhne obrázek z odpovědi modelu, jinak srozumitelně spadne. */
function imageFromResponse(response: {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string }; text?: string }> } }>;
}): Buffer {
  const out = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of out) {
    if (part.inlineData?.data) return Buffer.from(part.inlineData.data, "base64");
  }
  const text = out.map((p) => p.text).filter(Boolean).join(" ");
  throw new Error(`Model nevrátil obrázek.${text ? ` Odpověděl: ${text.slice(0, 300)}` : ""}`);
}

/**
 * Atmosférická varianta téhož domu: léto, sníh, večer, stárnutí.
 *
 * Na rozdíl od výměny krytiny tady MĚNÍME celý záběr (obloha, světlo, sníh),
 * takže se nemaskuje — bereme celý výstup modelu. Dům, tvar střechy i materiál
 * krytiny musí zůstat, mění se jen nálada. Tohle je ta věc, kterou si zákazník
 * uloží do telefonu.
 */
export async function renderAtmosphere(
  photo: Buffer,
  mimeType: string,
  atmospherePrompt: string,
): Promise<Buffer> {
  if (MOCK) return photo;
  const ai = getClient();

  const prompt = [
    `Using this photo of a house, ${atmospherePrompt}`,
    `Keep the house identical: same walls, windows, roof shape, roof covering`,
    `material and colour, same composition, camera angle and framing.`,
    `Only change the atmosphere, lighting, sky and season as described.`,
    `Photorealistic result.`,
  ].join(" ");

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: [
        { text: prompt },
        { inlineData: { mimeType, data: photo.toString("base64") } },
      ],
      config: {
        responseModalities: ["Image"],
        imageConfig: { imageSize: IMAGE_SIZE },
      },
    }),
  );

  return imageFromResponse(response);
}
