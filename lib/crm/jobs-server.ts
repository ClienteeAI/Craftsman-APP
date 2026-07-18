import type { Job } from "./jobs";
import { getSupabase } from "@/lib/supabase";

/**
 * Serverová (cloudová) strana CRM — záloha zakázek do Supabase.
 *
 * ═══ MODEL: localStorage primární, cloud jako záloha ═══
 * Zakázky žijí na zařízení majstra (offline, okamžitě). Když je nastavené
 * Supabase, každá změna se sem zálohuje a nové/vyměněné zařízení si je při
 * prvním spuštění stáhne zpátky. Přesně to řeší obavu "ztratím telefon =
 * ztratím zákazníky".
 *
 * Není to realtime obousměrná synchronizace víc zařízení naráz — to přijde
 * s přihlášením. Tohle je záloha a obnova, což je to, co jeden majster
 * potřebuje především.
 *
 * Bez Supabase jsou tyhle funkce no-op (endpoint vrátí synced:false) a appka
 * jede čistě z localStorage.
 */

function rowToJob(r: Record<string, unknown>): Job {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    status: r.status as Job["status"],
    customer: r.customer as Job["customer"],
    summary: (r.summary as string) ?? "",
    priceExVat: (r.price_ex_vat as number) ?? null,
    shareUrl: (r.share_url as string) ?? null,
    note: (r.note as string) ?? null,
    remindAt: (r.remind_at as string) ?? null,
    startAt: (r.start_at as string) ?? null,
    details: (r.details as Job["details"]) ?? null,
  };
}

/** Je záloha zapnutá? (Supabase nakonfigurované.) */
export function crmSyncEnabled(): boolean {
  return getSupabase() !== null;
}

/** Zálohuje jednu zakázku (upsert podle id) pod daného řemeslníka. */
export async function upsertJobServer(job: Job, userId: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from("jobs").upsert({
    id: job.id,
    user_id: userId,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    status: job.status,
    customer: job.customer,
    phone: job.customer.phone,
    summary: job.summary,
    price_ex_vat: job.priceExVat,
    share_url: job.shareUrl,
    note: job.note,
    remind_at: job.remindAt,
    start_at: job.startAt,
    details: job.details,
  });
  if (error) throw new Error(`Záloha zákazky zlyhala: ${error.message}`);
}

/** Smaže zálohu zakázky (jen vlastní), ať se po obnově nevrátí. */
export async function deleteJobServer(id: string, userId: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from("jobs").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(`Zmazanie zálohy zlyhalo: ${error.message}`);
}

/** Všechny zakázky řemeslníka ze zálohy (pro obnovu na novém zařízení). */
export async function listJobsServer(userId: string): Promise<Job[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Načítanie zálohy zlyhalo: ${error.message}`);
  return (data ?? []).map(rowToJob);
}
