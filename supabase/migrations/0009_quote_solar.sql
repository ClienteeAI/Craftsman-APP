-- ═══════════════════════════════════════════════════════════════════════════
-- Solárny odhad v ponuke (upsell k novej streche)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Spusť po 0008. Keď majster pri tvorbe ponuky pridá solár, uloží sa sem a
-- zobrazí zákazníkovi ako „vaša strecha by ročne vyrobila X kWh".
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.quotes
  add column if not exists solar jsonb;
