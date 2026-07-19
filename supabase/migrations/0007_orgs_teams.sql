-- ═══════════════════════════════════════════════════════════════════════════
-- Firma → party → členovia. Vrstva organizácie a rolí.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Spusť po 0006 (SQL Editor → vlož → Run). Zavádí hierarchii:
--
--   Firma (org)
--    ├─ Parta 1  → šéf party (lead) + členovia
--    └─ Parta 2  → šéf party (lead) + členovia
--
-- Tri role (membership.role):
--   owner  — majiteľ firmy: vidí a riadi všetko naprieč partami
--   lead   — šéf party: vidí a riadi zákazky svojej party
--   member — majster: vidí len svoje zákazky
--
-- Ceny práce: firemný cenník je v profile majiteľa; parta si môže nastaviť
-- výnimky (teams.labour_overrides). Prázdne = dedí firmu.
--
-- POZOR: skutečné scopování jede v serverovém kódu (service-role klient obchází
-- RLS, stejně jako u zakázek). RLS je tu jako druhá pojistka pro přímý přístup.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Firma ──────────────────────────────────────────────────────────────────
create table if not exists public.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Moja firma',
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists orgs_owner_idx on public.orgs (owner_id);

-- ── Parta ──────────────────────────────────────────────────────────────────
create table if not exists public.teams (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs(id) on delete cascade,
  name              text not null,
  -- Šéf party. null = zatiaľ bez šéfa (riadi majiteľ).
  lead_id           uuid references auth.users(id) on delete set null,
  -- Cenové výnimky party (override firemného cenníka práce). null = dedí firmu.
  labour_overrides  jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists teams_org_idx on public.teams (org_id);

-- ── Členstvo (kto patrí do firmy/party a v akej role) ──────────────────────
-- Jeden člověk = jedno členství v jedné firmě (pro tento produkt stačí).
create table if not exists public.memberships (
  user_id     uuid not null references auth.users(id) on delete cascade,
  org_id      uuid not null references public.orgs(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete set null,
  role        text not null default 'member' check (role in ('owner', 'lead', 'member')),
  email       text,               -- ať jde člena zobrazit, než se poprvé přihlásí
  created_at  timestamptz not null default now(),
  primary key (user_id, org_id)
);
create index if not exists memberships_org_idx on public.memberships (org_id);
create index if not exists memberships_team_idx on public.memberships (team_id);
-- Jeden človek = jedna firma (pre tento produkt). Bráni aj súbežnému bootstrapu.
create unique index if not exists memberships_user_uniq on public.memberships (user_id);

-- ── Príslušnosť zákaziek a nabídek k firme/parte ───────────────────────────
alter table public.jobs
  add column if not exists org_id  uuid references public.orgs(id) on delete cascade,
  add column if not exists team_id uuid references public.teams(id) on delete set null;
create index if not exists jobs_org_idx  on public.jobs (org_id, updated_at desc);
create index if not exists jobs_team_idx on public.jobs (team_id, updated_at desc);

alter table public.quotes
  add column if not exists org_id  uuid,
  add column if not exists team_id uuid;

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table public.orgs        enable row level security;
alter table public.teams       enable row level security;
alter table public.memberships enable row level security;

-- Firma: majiteľ má plný prístup; člen si ju smie prečítať.
drop policy if exists "org owner" on public.orgs;
create policy "org owner" on public.orgs
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "org member read" on public.orgs;
create policy "org member read" on public.orgs
  for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.org_id = orgs.id and m.user_id = auth.uid()
  ));

-- Parta: majiteľ firmy má plný prístup; člen firmy si party smie prečítať.
drop policy if exists "team owner" on public.teams;
create policy "team owner" on public.teams
  for all to authenticated
  using (exists (
    select 1 from public.orgs o where o.id = teams.org_id and o.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.orgs o where o.id = teams.org_id and o.owner_id = auth.uid()
  ));

drop policy if exists "team member read" on public.teams;
create policy "team member read" on public.teams
  for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.org_id = teams.org_id and m.user_id = auth.uid()
  ));

-- Členstvo: majiteľ firmy riadi členov; človek si smie prečítať svoje.
drop policy if exists "membership owner" on public.memberships;
create policy "membership owner" on public.memberships
  for all to authenticated
  using (exists (
    select 1 from public.orgs o where o.id = memberships.org_id and o.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.orgs o where o.id = memberships.org_id and o.owner_id = auth.uid()
  ));

drop policy if exists "membership self read" on public.memberships;
create policy "membership self read" on public.memberships
  for select to authenticated
  using (user_id = auth.uid());

-- Zákazky: rozšíriť viditeľnosť z „len vlastné" na rolovú.
--   member → vlastné (user_id)
--   lead   → zákazky svojej party (team.lead_id)
--   owner  → zákazky celej firmy (org.owner_id)
drop policy if exists "own jobs" on public.jobs;
drop policy if exists "role jobs" on public.jobs;
create policy "role jobs" on public.jobs
  for all to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.teams t where t.id = jobs.team_id and t.lead_id = auth.uid())
    or exists (select 1 from public.orgs  o where o.id = jobs.org_id  and o.owner_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.teams t where t.id = jobs.team_id and t.lead_id = auth.uid())
    or exists (select 1 from public.orgs  o where o.id = jobs.org_id  and o.owner_id = auth.uid())
  );
