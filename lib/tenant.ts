/**
 * Konfigurace instance = celý náš white-label.
 *
 * Jedno repo, N nasazení, rozdíl je jen tady v proměnných prostředí. Žádné
 * forky, žádná multi-tenancy v databázi. Zákazník dostane vlastní Vercel
 * projekt, vlastní databázi a vlastní doménu — a my opravujeme na jednom místě.
 */
export type Tenant = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  locale: string;
  currency: string;
  /** Kam posíláme lead. Zákazník si ho vezme do svého CRM (GHL, Pipedrive, …). */
  leadWebhookUrl: string | null;
  /** Text souhlasu. Dodá právní oddělení zákazníka — my ho jen zobrazíme a uložíme. */
  consentText: string;
  /** Verze textu souhlasu. Bez ní nedokážeš doložit, s ČÍM ten člověk souhlasil. */
  consentVersion: string;
};

/**
 * Podmnožina, kterou je bezpečné poslat do prohlížeče.
 *
 * `leadWebhookUrl` tu schválně NENÍ — je to endpoint zákazníkova CRM a kdyby
 * unikl do klienta, může na něj kdokoliv střílet falešné leady.
 */
export type PublicTenant = Pick<
  Tenant,
  "name" | "logoUrl" | "primaryColor" | "locale" | "consentText"
>;

export function getPublicTenant(): PublicTenant {
  const t = getTenant();
  return {
    name: t.name,
    logoUrl: t.logoUrl,
    primaryColor: t.primaryColor,
    locale: t.locale,
    consentText: t.consentText,
  };
}

export function getTenant(): Tenant {
  return {
    name: process.env.TENANT_NAME ?? "Demo",
    logoUrl: process.env.TENANT_LOGO_URL ?? null,
    primaryColor: process.env.TENANT_PRIMARY_COLOR ?? "#e5e5e5",
    locale: process.env.TENANT_LOCALE ?? "cs",
    currency: process.env.TENANT_CURRENCY ?? "EUR",
    leadWebhookUrl: process.env.TENANT_LEAD_WEBHOOK_URL ?? null,
    consentText:
      process.env.TENANT_CONSENT_TEXT ??
      "Souhlasím, aby mě společnost kontaktovala s nabídkou střešní krytiny a zpracovala k tomu mé kontaktní údaje.",
    consentVersion: process.env.TENANT_CONSENT_VERSION ?? "v1",
  };
}
