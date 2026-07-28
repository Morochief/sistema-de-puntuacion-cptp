-- ============================================================
-- Script de Migración: Soporte Multi-Modalidad (.22 LR, .308, .223)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Agregar columna de modalidad a eventos
ALTER TABLE events ADD COLUMN IF NOT EXISTS modality text DEFAULT '.22 LR';

-- 2. Agregar columna de bonus activo a series
ALTER TABLE series ADD COLUMN IF NOT EXISTS bonus_active boolean DEFAULT false;

-- 3. Marcar todos los eventos existentes como .22 LR
UPDATE events SET modality = '.22 LR' WHERE modality IS NULL;

-- 4. Agregar columna de evento piloto (no cuenta para campeonato)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_pilot boolean DEFAULT false;
