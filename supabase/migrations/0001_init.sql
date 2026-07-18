-- ═══════════════════════════════════════════════════════════════════════════
-- Craftsman APP — základní schéma
-- ═══════════════════════════════════════════════════════════════════════════
--
-- TOHLE JE ZDROJ PRAVDY O DATABÁZI. Kdykoli založíš nový Supabase projekt,
-- spustíš tenhle soubor a dostaneš identickou, prázdnou databázi. Proto je
-- schéma v gitu a ne "naklikané" v Supabase konzoli — jinak by nešlo projekt
-- odhodit a znovu postavit.
--
-- Jak to spustit na novém projektu:
--   Supabase Dashboard → SQL Editor → vlož obsah tohoto souboru → Run.
--   (Nebo `supabase db push`, když používáš Supabase CLI.)
--
-- Vše je zamčené na service-role klíč (RLS zapnuté, žádné public policy).
-- Aplikace na DB sahá jen ze serveru — anon klíč se sem nedostane.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Profil realizátora (nastavení, white-label) ────────────────────────────
-- Celý profil jako jeden JSON blob — jsou to nastavení, ne dotazovaná data.
-- Klíčem je tenant (slug instance), ať víc firem = víc řádků, až přijde auth.
create table if not exists public.profiles (
  tenant      text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ── CRM zakázky (Modul 1) ──────────────────────────────────────────────────
-- status/remind_at/phone jsou vlastní sloupce kvůli filtrování, řazení a
-- deduplikaci podle telefonu; zbytek zákazníka je jsonb.
create table if not exists public.jobs (
  id           text primary key,
  tenant       text not null default 'default',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  status       text not null default 'novy',
  customer     jsonb not null default '{}'::jsonb,
  phone        text,
  summary      text not null default '',
  price_ex_vat numeric,
  share_url    text,
  note         text,
  remind_at    timestamptz
);

create index if not exists jobs_tenant_updated_idx on public.jobs (tenant, updated_at desc);
create index if not exists jobs_tenant_phone_idx on public.jobs (tenant, phone);
create index if not exists jobs_remind_idx on public.jobs (tenant, remind_at) where remind_at is not null;

-- ── Sdílené nabídky (odkaz pro zákazníka místo PDF) ────────────────────────
-- Tady je celý smysl "odkazu": přežije restart serveru i víc instancí, takže
-- zákazníkův link nikdy nehodí 404 (na rozdíl od paměti procesu).
create table if not exists public.quotes (
  id            text primary key,
  tenant        text not null default 'default',
  created_at    timestamptz not null default now(),
  company       jsonb not null default '{}'::jsonb,
  customer      jsonb not null default '{}'::jsonb,
  summary       text not null default '',
  tier_name     text not null default '',
  product_name  text not null default '',
  earliest_term text not null default '',
  items         jsonb not null default '[]'::jsonb,
  totals        jsonb not null default '{}'::jsonb,
  range         jsonb not null default '{}'::jsonb,
  assumptions   jsonb not null default '[]'::jsonb,
  -- Cesta do storage bucketu 'renders' (nebo data URL pro starší nabídky).
  image_url     text,
  -- Id videa ve storage bucketu 'videos'.
  video_id      text,
  opened_at     timestamptz,
  interested_at timestamptz
);

create index if not exists quotes_tenant_created_idx on public.quotes (tenant, created_at desc);

-- ── Zamknout vše na service-role ───────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.jobs     enable row level security;
alter table public.quotes   enable row level security;
-- Žádné policy = přes anon/public klíč se nedá nic. Service-role RLS obchází.

-- ── Storage buckety pro média (privátní) ───────────────────────────────────
-- Videopozdravy a vizualizace střech. Privátní — servírují se přes appku.
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('renders', 'renders', false)
on conflict (id) do nothing;
