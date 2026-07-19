/**
 * Značkový HTML e-mail s ponukou.
 *
 * Z textovej šablony majstra (Nastavenie komunikácie) spraví HTML: {odkaz} sa
 * premení na KLIKACIE tlačidlo „Otvoriť ponuku", ostatné premenné na text.
 * Tým padá obmedzenie holého linku — v e-maile posielanom z vlastnej schránky
 * môže byť odkaz schovaný pod slovom, presne ako si majster prial.
 *
 * Čistá funkcia (žiadne node závislosti) — dá sa volať aj z klienta.
 */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type OfferVars = { meno: string; firma: string; odkaz: string; termin: string };

/** HTML telo e-mailu z textovej šablony + premenných. */
export function buildOfferEmailHtml(bodyTemplate: string, vars: OfferVars): string {
  const button =
    `<a href="${esc(vars.odkaz)}" ` +
    `style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;` +
    `padding:14px 28px;border-radius:12px;font-weight:600;font-size:16px;">Otvoriť ponuku</a>`;

  // Escapni šablonu, dosaď textové premenné, {odkaz} nahraď tlačidlom.
  let t = esc(bodyTemplate)
    .replace(/\{meno\}/g, esc(vars.meno))
    .replace(/\{firma\}/g, esc(vars.firma))
    .replace(/\{termin\}/g, esc(vars.termin));

  t = t.includes("{odkaz}") ? t.split("{odkaz}").join(button) : `${t}<br><br>${button}`;
  t = t.replace(/\n/g, "<br>");

  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;` +
    `color:#201a12;max-width:560px;margin:0 auto;padding:24px;">${t}</div>`
  );
}

/** Prostý text ako záloha (klienti bez HTML). Odkaz vypísaný. */
export function buildOfferEmailText(bodyTemplate: string, vars: OfferVars): string {
  return bodyTemplate
    .replace(/\{meno\}/g, vars.meno)
    .replace(/\{firma\}/g, vars.firma)
    .replace(/\{termin\}/g, vars.termin)
    .replace(/\{odkaz\}/g, vars.odkaz);
}
