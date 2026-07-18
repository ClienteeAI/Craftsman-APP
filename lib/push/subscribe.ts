/**
 * Přihlášení řemeslníka k odběru push notifikací (klientská strana).
 *
 * Požádá o povolení, vytvoří odběr přes servisní worker s naším VAPID veřejným
 * klíčem a pošle ho na server k uložení. Vrací důvod, když to nejde — ať appka
 * řekne pravdu (nepodporováno / zamítnuto / bez klíče) místo tichého selhání.
 *
 * Pozn.: servisní worker se registruje jen v produkci, takže lokálně (dev) push
 * nechodí. Testuje se na nasazené appce. Na iPhonu navíc jen po „Pridať na
 * plochu" a iOS 16.4+.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  // Explicitní ArrayBuffer (ne ArrayBufferLike), ať to sedne na applicationServerKey.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "no-vapid" | "denied" | "no-sw" | "save-failed" };

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, reason: "no-vapid" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { ok: false, reason: "no-sw" };

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid),
  });

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });
  if (!res.ok) return { ok: false, reason: "save-failed" };
  return { ok: true };
}

/** Už je řemeslník na tomto zařízení přihlášený k odběru? */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  return (await reg.pushManager.getSubscription()) !== null;
}
