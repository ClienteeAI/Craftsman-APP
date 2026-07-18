import sharp from "sharp";

/**
 * Jádro celého produktu.
 *
 * Model překreslí celou fotku a nemáme jak mu zabránit, aby cestou nepřesunul
 * dřevo na terase nebo nesmazal sněhové zábrany. Tak mu to nedovolíme: z jeho
 * výstupu vyřízneme podle masky jen střechu a položíme ji na originál, kterého
 * jsme se nedotkli.
 *
 * Důsledek: každý pixel mimo masku je bajt po bajtu ten, co uživatel vyfotil.
 * Není to "skoro stejné", je to totožné. To je rozdíl mezi "barák jako můj"
 * a "MŮJ barák" — a v tom je celý wow efekt.
 */
export async function compositeRoof(
  original: Buffer,
  rendered: Buffer,
  /** PNG s alfou: neprůhledné tam, kde je střecha, průhledné všude jinde. */
  mask: Buffer,
): Promise<Buffer> {
  const meta = await sharp(original).metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) throw new Error("Nepodařilo se přečíst rozměry originálu.");

  // Model si s rozměry i poměrem stran dělá, co chce (na tvých fotkách přidal
  // černé pruhy). Natáhneme render zpátky přesně na originál, ať pixely sedí.
  const renderedFitted = await sharp(rendered)
    .resize(width, height, { fit: "fill" })
    .toBuffer();

  // Masku taky na rozměr originálu. Rozmazání okrajů schová tvrdý střih na hraně
  // střechy — bez toho je vidět, že je to slepené.
  const maskFitted = await sharp(mask)
    .resize(width, height, { fit: "fill" })
    .blur(2)
    .ensureAlpha()
    .toBuffer();

  // dest-in nechá z renderu jen to, co je pod neprůhlednou částí masky.
  const roofOnly = await sharp(renderedFitted)
    .ensureAlpha()
    .composite([{ input: maskFitted, blend: "dest-in" }])
    .png()
    .toBuffer();

  // A tenhle výřez položíme na netknutý originál.
  return sharp(original)
    .composite([{ input: roofOnly, blend: "over" }])
    .png()
    .toBuffer();
}

/**
 * Musí sedět na GEMINI_IMAGE_SIZE v lib/gemini.ts:
 *   0.5K→512, 1K→1024, 2K→2048, 4K→4096
 *
 * Když je fotka větší než generovaný render, natahujeme střechu při slepení
 * nahoru a je rozmazanější než zbytek fotky — což je přesně ta věc, které si
 * člověk všimne, i když neví proč.
 */
const MAX_PHOTO_PX = Number(process.env.MAX_PHOTO_PX ?? 1024);

/** Normalizace vstupu — telefony fotí na výšku a EXIF rotaci je potřeba dopéct. */
export async function normalizePhoto(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // aplikuje EXIF orientaci
    .resize(MAX_PHOTO_PX, MAX_PHOTO_PX, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

/**
 * Vodoznak — logo firmy do rohu vizualizace.
 *
 * Když si zákazník obrázek uloží nebo pošle dál (a on ho pošle, když je to
 * JEHO barák s novou střechou), nese logo řemeslníka. Sám mu dělá reklamu.
 *
 * Logo je malé v pravém dolním rohu, na jemném bílém pruhu, ať je čitelné na
 * tmavé i světlé střeše. Když logo nejde zpracovat, vrátíme obrázek beze změny
 * — vodoznak nikdy nesmí shodit odeslání nabídky.
 */
export async function watermark(image: Buffer, logo: Buffer): Promise<Buffer> {
  try {
    const base = sharp(image);
    const meta = await base.metadata();
    const W = meta.width ?? 1024;
    const H = meta.height ?? 1024;

    const logoW = Math.max(90, Math.round(W * 0.16));
    const pad = Math.round(logoW * 0.12);

    // Logo na bílé podložce se zaoblenými rohy — čitelné na jakékoli střeše.
    const logoImg = await sharp(logo)
      .resize({ width: logoW, withoutEnlargement: false })
      .png()
      .toBuffer();
    const lmeta = await sharp(logoImg).metadata();
    const logoH = lmeta.height ?? logoW;

    const plateW = logoW + pad * 2;
    const plateH = logoH + pad * 2;
    const radius = Math.round(pad);
    const plate = await sharp({
      create: { width: plateW, height: plateH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.82 } },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg><rect x="0" y="0" width="${plateW}" height="${plateH}" rx="${radius}" ry="${radius}"/></svg>`,
          ),
          blend: "dest-in",
        },
        { input: logoImg, top: pad, left: pad },
      ])
      .png()
      .toBuffer();

    const margin = Math.round(W * 0.03);
    return base
      .composite([
        { input: plate, top: Math.max(0, H - plateH - margin), left: Math.max(0, W - plateW - margin) },
      ])
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    return image;
  }
}
