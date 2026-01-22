-- ============================================
-- FIX TIMEZONE - CORREGIR HORA DEL MATCH
-- ============================================
-- Match ID: 0419c9b3-5907-4a24-a35e-58e602f0ab00
-- Problema: Muestra 14:00 en UI pero debería ser 19:00
-- Solución: Actualizar con timezone offset de Ecuador (UTC-5)
-- ============================================

-- PASO 1: Verificar valores actuales
SELECT 
  id,
  acceptance_proposed_scheduled_at as hora_actual_db,
  acceptance_proposed_scheduled_at AT TIME ZONE 'America/Guayaquil' as hora_mostrada_ecuador,
  scheduled_at as scheduled_actual_db,
  scheduled_at AT TIME ZONE 'America/Guayaquil' as scheduled_mostrado_ecuador
FROM matches
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';

-- PASO 2: Corregir acceptance_proposed_scheduled_at a 19:00 hora Ecuador
-- Si quieres 21 de enero 2026 a las 19:00 hora Ecuador:
UPDATE matches
SET acceptance_proposed_scheduled_at = '2026-01-21 19:00:00-05:00'::timestamptz
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';

-- PASO 3: Si también necesitas corregir scheduled_at:
UPDATE matches
SET scheduled_at = '2026-01-21 19:00:00-05:00'::timestamptz
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00'
  AND scheduled_at IS NOT NULL;

-- PASO 4: Verificar que quedó correcto
SELECT 
  id,
  acceptance_proposed_scheduled_at as hora_corregida_db,
  acceptance_proposed_scheduled_at AT TIME ZONE 'America/Guayaquil' as hora_mostrada_ecuador_ahora,
  TO_CHAR(acceptance_proposed_scheduled_at AT TIME ZONE 'America/Guayaquil', 'DD de Month YYYY, HH24:MI') as formato_ecuador
FROM matches
WHERE id = '0419c9b3-5907-4a24-a35e-58e602f0ab00';
