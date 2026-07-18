-- ═══════════════════════════════════════════════════════════════════════════
-- „Zeptej se manželky" (výběr z 3 cen) + podpis/záloha v odkazu
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Spusť po 0003 (SQL Editor → vlož → Run). Přidá do nabídky:
--   tiers        — všechny 3 cenové úrovně (aby si zákazník vybral, ne ano/ne)
--   chosen_tier  — kterou úroveň zákazník vybral
--   signed_at    — kdy zákazník nabídku závazně podepsal
--   signature_url — podpis (odkaz do storage bucketu 'renders')
--
-- Jedna migrace pro obě featury, ať to klikáš jen jednou.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.quotes
  add column if not exists tiers jsonb,
  add column if not exists chosen_tier text,
  add column if not exists signed_at timestamptz,
  add column if not exists signature_url text;
