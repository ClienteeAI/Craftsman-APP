import crypto from "node:crypto";

/**
 * Šifrovanie hesla k e-mailovej schránke.
 *
 * AES-256-GCM. Kľúč sa odvodí z EMAIL_ENC_KEY (akýkoľvek reťazec — cez SHA-256
 * z neho spravíme 32 bajtov). Kľúč žije LEN v env, nikdy v databáze; bez neho
 * je uložená šifra bezcenná. GCM navyše overí, že šifra nebola pozmenená.
 *
 * Formát uloženej hodnoty: base64(iv).base64(tag).base64(ciphertext)
 */

function key(): Buffer {
  const secret = process.env.EMAIL_ENC_KEY;
  if (!secret) throw new Error("EMAIL_ENC_KEY nie je nastavené — pripojenie schránky vyžaduje šifrovací kľúč.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Poškodený formát šifry.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** Je šifrovací kľúč nastavený? (Bez neho schránku pripojiť nejde.) */
export function emailCryptoReady(): boolean {
  return Boolean(process.env.EMAIL_ENC_KEY);
}
