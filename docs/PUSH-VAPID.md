# Push notifikace a VAPID — návod

Krátký, praktický průvodce. Vysvětluje, co je VAPID, proč ho push potřebuje,
co už je hotové a co se ještě staví.

## Co je VAPID (jednou větou)

**VAPID** (Voluntary Application Server Identification) je jeden pár klíčů
(veřejný + privátní), kterým se tvůj server **prokazuje** push službám prohlížečů
(Apple, Google, Mozilla) — aby nikdo cizí nemohl posílat notifikace tvým jménem.

Vygeneruje se **jednou** a používá se pořád. Není to účet ani placená služba —
web push je **zdarma** (na rozdíl od SMS).

## Dva klíče, dvě role

| Klíč | Kam patří | K čemu |
|---|---|---|
| **Public** (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) | do prohlížeče (klient) | řemeslník se s ním „přihlásí k odběru" notifikací |
| **Private** (`VAPID_PRIVATE_KEY`) | jen na server, TAJNÝ | podepisuje odesílané notifikace |
| **Subject** (`VAPID_SUBJECT`) | server | kontakt na provozovatele (`mailto:…`), chtějí ho push služby |

Už jsou vygenerované a uložené v `.env.local` (privátní je v `.gitignore`,
nikdy se nepushuje). Vygenerovat nové: `npx web-push generate-vapid-keys --json`.

## Jak push funguje (celý tok)

1. **Odběr** — řemeslník v appce klikne „Zapnout upozornění". Prohlížeč si
   řekne push službě o „subscription" (adresa jeho zařízení) s naším public
   klíčem.
2. **Uložení** — tu subscription pošleme na server a uložíme do DB k jeho účtu
   (tabulka `push_subscriptions`, jedna řádka na zařízení).
3. **Odeslání** — když se stane událost (zákazník ťukne „Mám záujem"), server
   vezme jeho subscriptions, podepíše zprávu privátním klíčem a pošle ji push
   službě. Ta ji doručí na telefon — **i když má appku zavřenou**.
4. **Zobrazení** — servisní worker (`public/sw.js`) notifikaci zobrazí a po
   ťuknutí otevře správnou obrazovku (třeba detail zakázky).

## Co už je hotové ✓ / co se staví

- ✓ VAPID klíče vygenerované, v `.env.local` a zdokumentované v `.env.example`
- ✓ Servisní worker registrovaný (jen v produkci)
- ⏳ Tabulka `push_subscriptions` (přidá se s přihlášením — subscription patří
  k účtu řemeslníka)
- ⏳ Tlačítko „Zapnout upozornění" + uložení odběru
- ⏳ Odesílání push při „Mám záujem" a „zákazník otevřel nabídku"

**Pořadí:** push staví na přihlášení (odběr musí patřit konkrétnímu řemeslníkovi),
takže se dělá **až po** auth. Proto teď nejdřív auth, pak tohle.

## iPhone — jedna podmínka

Na iOS web push funguje **jen když je appka přidaná na plochu** (Přidat na
plochu → spustit z ikony), a jen na **iOS 16.4+**. V Safari jako záložka push
nechodí — to je omezení Applu, ne appky. Na Androidu jde push i z prohlížeče.
Appka na to řemeslníka navede (má už install prompt / iOS instrukce).

## Náklady

**0 €.** Web push je zdarma napříč platformami. Žádné Twilio, žádné poplatky za
zprávu. To je proti SMS obrovský rozdíl při 10 000 řemeslnících.

## Rotace klíčů (kdyby unikl privátní)

1. Vygeneruj nový pár (`npx web-push generate-vapid-keys --json`).
2. Vyměň oba klíče v env.
3. Všichni řemeslníci se musí znovu přihlásit k odběru (staré subscriptions
   přestanou platit). Proto klíče neměň zbytečně.
