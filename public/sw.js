/**
 * Service worker.
 *
 * Dělá tři věci:
 *   1. Umožňuje instalaci na plochu (Chrome vyžaduje fetch handler).
 *   2. Přijímá push notifikace.
 *   3. Otevře appku po ťuknutí na notifikaci.
 *
 * ═══ CO JEŠTĚ NEFUNGUJE A PROČ ═══
 *
 * Push potřebuje čtyři věci a dvě z nich zatím nemáme:
 *   ✓ HTTPS            — bude na Vercelu (localhost je taky secure context)
 *   ✓ service worker   — tenhle soubor
 *   ✗ VAPID klíče      — vygenerovat: npx web-push generate-vapid-keys
 *   ✗ úložiště odběrů  — potřebuje databázi, kterou zatím nemáme
 *
 * ═══ IOS ═══
 *
 * Na iPhonu web push funguje AŽ od iOS 16.4 a JEN když si uživatel appku
 * přidá na plochu. V Safari na webu push nepřijde nikdy. To je tvrdé omezení
 * PWA proti nativní appce a je potřeba s ním počítat v onboardingu:
 * majster MUSÍ projít "Pridať na plochu", jinak mu žádná notifikace nedorazí.
 */

const CACHE = "ponuka-v1";

self.addEventListener("install", (event) => {
  // Nová verze se nasadí hned, ať majster nekouká na starou appku.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Úklid starých cache po nasazení nové verze.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Zatím jen průchod na síť.
 *
 * Offline režim schválně NEDĚLÁM: majster na střeše potřebuje přepis řeči
 * a výpočet nabídky, což jsou obojí volání na server. Cachovat obal appky,
 * který pak stejně nic neumí, by bylo horší než poctivé "nemáš signál" —
 * to aspoň vidí, na čem je.
 *
 * Až bude co ukládat lokálně (rozdělaná nabídka, karta zákazníka), přijde sem
 * background sync a odešle se to, jakmile chytne signál. To je smysluplný
 * offline, ne cachovaný obal.
 */
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Nová správa", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Rýchla ponuka strechy", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Kvůli tomu, ať ťuknutí otevře správnou nabídku, ne jen appku.
      data: { url: data.url ?? "/" },
      // Vibrace: majster má telefon v kapse pracovních kalhot pod bundou.
      vibrate: [80, 40, 80],
      tag: data.tag ?? "default",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Když je appka už otevřená, jen ji vytáhneme nahoru — neotvírat druhou.
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
