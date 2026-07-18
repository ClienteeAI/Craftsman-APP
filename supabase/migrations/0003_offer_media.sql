-- ═══════════════════════════════════════════════════════════════════════════
-- Interaktivní vizualizace na zákaznické nabídce
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Spusť po 0002 (SQL Editor → vlož → Run). Přidá do nabídky místo na galerii
-- obrázků: původní fotka (before), render (after) a atmosférické varianty
-- (léto/sníh/večer/o 15 rokov), aby zákazník na odkazu dostal posuvník před/po
-- a přepínač atmosféry — ne jen jeden statický obrázek.
--
-- `media` je JSON s odkazy do storage bucketu 'renders':
--   { "before": "storage:<id>-before", "variants": { "vecer": "storage:<id>-vecer", ... } }
-- Render (after) zůstává v existujícím sloupci image_url.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.quotes
  add column if not exists media jsonb;
