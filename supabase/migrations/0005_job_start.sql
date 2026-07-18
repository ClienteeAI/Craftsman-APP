-- ═══════════════════════════════════════════════════════════════════════════
-- Termín realizace u zakázky („kdy začneme pracovat")
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Spusť po 0004 (SQL Editor → vlož → Run). Přidá k zakázce datum, kdy se má
-- začít realizace — ať majster vidí, co ho kdy čeká, a plánuje si práci.
-- (Liší se od remind_at, což je „kdy zavolat".)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.jobs
  add column if not exists start_at timestamptz;
