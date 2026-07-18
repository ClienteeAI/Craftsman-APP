-- ═══════════════════════════════════════════════════════════════════════════
-- Multi-user: jedna firma, tisíce řemeslníků, každý svoje data
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Spusť po 0001 (SQL Editor → vlož → Run). Přidá vlastnictví dat podle
-- přihlášeného řemeslníka (user_id), Row Level Security (databáze sama pustí
-- každého jen k jeho datům) a tabulku pro odběry push notifikací.
--
-- Zákaznická nabídka (/p/[id]) zůstává čitelná přes odkaz — čte ji server
-- service-role klíčem, ne anonymní návštěvník, takže nikdo nemůže cizí nabídky
-- vylistovat.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Vlastník u zakázek a nabídek ───────────────────────────────────────────
alter table public.jobs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists jobs_user_updated_idx on public.jobs (user_id, updated_at desc);

alter table public.quotes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists quotes_user_idx on public.quotes (user_id, created_at desc);

-- ── Profil: jeden na řemeslníka (překlopení z tenant na user_id) ────────────
-- Tabulka je zatím prázdná (jen nastavení), takže překlopení je bezpečné.
-- ⚠️ Tahle migrace se spouští PRÁVĚ JEDNOU. Opětovné spuštění by profily smazalo.
drop table if exists public.profiles cascade;
create table public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ── Odběry push notifikací (jeden řádek na zařízení) ───────────────────────
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists push_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- ── Row Level Security: každý vidí a mění jen svoje ─────────────────────────
-- Service-role (server) RLS obchází — tohle chrání anon/klientský přístup.
-- (Politiky se nedají "create if not exists", proto drop+create.)
drop policy if exists "own jobs" on public.jobs;
create policy "own jobs" on public.jobs
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own quotes" on public.quotes;
create policy "own quotes" on public.quotes
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own push" on public.push_subscriptions;
create policy "own push" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
