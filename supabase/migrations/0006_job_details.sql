-- ═══════════════════════════════════════════════════════════════════════════
-- Obsáhlé CRM — všechny parametry zakázky do jednoho JSON bloku
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Spusť po 0005 (SQL Editor → vlož → Run). Přidá k zakázce `details` — strukturu
-- se vším, co pokrývač potřebuje: fakturace, technická střecha, krytina,
-- prostupy, logistika, řízení. JSON schválně, ať nemusíme migrovat na každé
-- nové pole; startAt (kalendář) a status zůstávají vlastní sloupce kvůli
-- dotazování.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.jobs
  add column if not exists details jsonb;
