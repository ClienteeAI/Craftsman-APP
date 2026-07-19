-- ═══════════════════════════════════════════════════════════════════════════
-- Vlastná e-mailová schránka majstra (IMAP + SMTP)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Spusť po 0007. Majster si pripojí VLASTNÚ schránku (svoj mailserver) — appka
-- z nej vie čítať, posielať aj mazať. Adresu a prístupy si dáva sám.
--
-- ⚠️ Heslo k schránke sa ukladá ŠIFROVANE (AES-256-GCM) v stĺpci password_enc.
-- Kľúč žije len v env (EMAIL_ENC_KEY), nikdy v databáze — bez kľúča je šifra
-- bezcenná. Service-role prístup k tejto tabuľke drž prísne (server only).
--
-- Gmail/Outlook nepustia bežné heslo cez IMAP/SMTP — treba „app password"
-- (Gmail: účet s 2FA → App passwords) alebo neskôr OAuth. Vlastné doménové
-- schránky (IMAP/SMTP) fungujú s bežnými prístupmi.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.email_accounts (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  org_id        uuid references public.orgs(id) on delete set null,
  email         text not null,
  imap_host     text not null,
  imap_port     integer not null default 993,
  imap_secure   boolean not null default true,
  smtp_host     text not null,
  smtp_port     integer not null default 465,
  smtp_secure   boolean not null default true,
  username      text not null,
  password_enc  text not null,          -- AES-256-GCM, kľúč v EMAIL_ENC_KEY
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.email_accounts enable row level security;

-- Vidí a mení len vlastník. (Server aj tak jde cez service-role; toto je pojistka.)
drop policy if exists "own email account" on public.email_accounts;
create policy "own email account" on public.email_accounts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
