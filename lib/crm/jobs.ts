"use client";

/**
 * Modul 1 ze zadání klienta — jednoduché CRM.
 *
 * "Karta zákazníka: meno, obec, telefón, mail, poznámka, fotografie, cenová
 *  ponuka, stav." + zavolať, navigácia, zmena stavu, pripomenutie.
 *
 * localStorage, ne databáze — stejně jako profil. Na telefonu majstra to
 * přežije zavření i restart. Bez tohohle je apka kalkulačka: uděláš nabídku
 * a zmizí. S tímhle je to aplikace: nabídka se uloží jako zakázka a majster
 * ji vede od prvního kontaktu po hotovo.
 *
 * Až přijde databáze, tohle se stane cache a pravda bude na serveru — a hlavně
 * to půjde vidět z víc zařízení. Teď je zakázka vázaná na jeden telefon.
 */

export type JobStatus = "novy" | "ponuka" | "realizacia" | "hotovo" | "straceny";

export const STATUS: Record<JobStatus, { label: string; dot: string; order: number }> = {
  novy: { label: "Nový kontakt", dot: "🟢", order: 0 },
  ponuka: { label: "Ponuka", dot: "📐", order: 1 },
  realizacia: { label: "Realizácia", dot: "🔨", order: 2 },
  hotovo: { label: "Hotovo", dot: "✅", order: 3 },
  straceny: { label: "Stratený", dot: "❌", order: 4 },
};

export type Job = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: JobStatus;
  customer: { name: string | null; obec: string | null; phone: string | null; email: string | null };
  summary: string;
  /** Cena bez DPH z odeslané nabídky, ať jde seznam řadit i sčítat. */
  priceExVat: number | null;
  /** Odkaz na nabídku pro zákazníka, když už byla odeslaná. */
  shareUrl: string | null;
  note: string | null;
  /** Připomenutí — kdy zákazníkovi zavolat. ISO datum. */
  remindAt: string | null;
  /** Termín realizace — kdy se má začít pracovat. ISO datum. */
  startAt: string | null;
};

const KEY = "zakazky-v1";

function read(): Job[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Job[];
  } catch {
    return [];
  }
}

function write(jobs: Job[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs));
  } catch (e) {
    console.warn("[crm] neuloženo:", e);
  }
}

/**
 * Záloha do cloudu (Supabase), fire-and-forget.
 *
 * localStorage je primární — tohle jen mimochodem pošle změnu na server jako
 * zálohu. Když Supabase není nastavené, endpoint vrátí synced:false a nic se
 * neděje. keepalive, ať request doletí i když majster hned zavře stránku.
 * Nikdy nesmí shodit UI — proto všechno spolkne .catch().
 */
function backup(job: Job): void {
  if (typeof window === "undefined") return;
  fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
    keepalive: true,
  }).catch(() => {});
}

function backupDelete(id: string): void {
  if (typeof window === "undefined") return;
  fetch(`/api/jobs/${id}`, { method: "DELETE", keepalive: true }).catch(() => {});
}

/**
 * Obnova ze zálohy — jen když je zařízení prázdné.
 *
 * Scénář: majster přejde na nový telefon (nebo přeinstaluje appku). localStorage
 * je prázdný, tak si stáhne zakázky z cloudu. Obnova JEN když je prázdno, ať
 * se na aktivně používaném zařízení nepřepíšou lokální data ani nevrátí to, co
 * majster mezitím smazal. Vrací aktuální seznam (obnovený nebo lokální).
 */
export async function restoreIfEmpty(): Promise<Job[]> {
  const local = read();
  if (local.length > 0) return local;
  try {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    if (!res.ok) return local;
    const body = await res.json();
    if (body.synced && Array.isArray(body.jobs) && body.jobs.length > 0) {
      write(body.jobs as Job[]);
      return body.jobs as Job[];
    }
  } catch {
    // Bez signálu prostě zůstaneme u prázdna — zkusí se to při dalším načtení.
  }
  return local;
}

export function listJobs(): Job[] {
  // Novější nahoře, ale hotové a ztracené klesají dolů — majster řeší živé.
  return read().sort((a, b) => {
    const dead = (j: Job) => (j.status === "hotovo" || j.status === "straceny" ? 1 : 0);
    if (dead(a) !== dead(b)) return dead(a) - dead(b);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function getJob(id: string): Job | undefined {
  return read().find((j) => j.id === id);
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Uloží nebo aktualizuje zakázku. Když má stejný telefon jako existující živá
 * zakázka, aktualizuje ji — ať se ze tří nabídek témuž člověku nestanou tři
 * kontakty v seznamu.
 */
export function upsertJob(
  input: Omit<Job, "id" | "createdAt" | "updatedAt" | "status" | "note" | "remindAt" | "startAt"> &
    Partial<Pick<Job, "status" | "id">>,
): Job {
  const jobs = read();
  const now = new Date().toISOString();

  const existingById = input.id ? jobs.find((j) => j.id === input.id) : undefined;
  const existingByPhone =
    !existingById && input.customer.phone
      ? jobs.find((j) => j.customer.phone === input.customer.phone && j.status !== "hotovo")
      : undefined;
  const existing = existingById ?? existingByPhone;

  if (existing) {
    Object.assign(existing, {
      ...input,
      status: input.status ?? existing.status,
      updatedAt: now,
    });
    write(jobs);
    backup(existing);
    return existing;
  }

  const job: Job = {
    id: shortId(),
    createdAt: now,
    updatedAt: now,
    status: input.status ?? "ponuka",
    note: null,
    remindAt: null,
    startAt: null,
    ...input,
  };
  write([job, ...jobs]);
  backup(job);
  return job;
}

/**
 * Ručně založený kontakt. Majstrovi přijde poptávka mailem nebo telefonem a
 * potřebuje si člověka hodit do seznamu HNED, ještě než dělá nabídku — jinak
 * mu kontakt uteče. Zakládá se ve stavu "novy" a nabídku dodělá později.
 *
 * Na rozdíl od `upsertJob` (to sype do CRM hotové nabídky a dedupuje podle
 * telefonu) tohle vždy vytvoří čerstvou kartu — když majster klikne "nový
 * kontakt", čeká nový kontakt, ne tiché sloučení s něčím starým.
 */
export function createJob(input: {
  customer: Job["customer"];
  summary?: string;
  note?: string | null;
}): Job {
  const now = new Date().toISOString();
  const job: Job = {
    id: shortId(),
    createdAt: now,
    updatedAt: now,
    status: "novy",
    customer: input.customer,
    summary: input.summary ?? "",
    priceExVat: null,
    shareUrl: null,
    note: input.note ?? null,
    remindAt: null,
    startAt: null,
  };
  write([job, ...read()]);
  backup(job);
  return job;
}

export function updateJob(id: string, patch: Partial<Job>): Job | undefined {
  const jobs = read();
  const job = jobs.find((j) => j.id === id);
  if (!job) return undefined;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  write(jobs);
  backup(job);
  return job;
}

export function deleteJob(id: string): void {
  write(read().filter((j) => j.id !== id));
  backupDelete(id);
}

/**
 * Koho má dnes obvolat.
 *
 * Připomenutí bez místa, kde na něj narazíš, je k ničemu — nikdo si detail
 * zakázky každé ráno neotvírá. Tohle patří nahoru do seznamu: dnes a dřív,
 * na živých zakázkách, nejnaléhavější první.
 */
export function dueReminders(today = new Date()): Job[] {
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  return read()
    .filter(
      (j) =>
        j.remindAt &&
        new Date(j.remindAt) <= end &&
        j.status !== "hotovo" &&
        j.status !== "straceny",
    )
    .sort((a, b) => a.remindAt!.localeCompare(b.remindAt!));
}
