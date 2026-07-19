-- ═══════════════════════════════════════════════════════════════════════════
-- Doba realizácie v ponuke (ručne nastaviteľná majstrom)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Spusť po 0009. Doteraz sa dĺžka realizácie iba odhadovala z plochy (5–6 dní).
-- Teraz si ju majster môže v ponuke nastaviť sám; keď nechá prázdne, ukáže sa
-- odhad ako doteraz.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.quotes
  add column if not exists duration_text text;
