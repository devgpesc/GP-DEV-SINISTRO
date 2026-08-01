-- Fase 1 de acompanhamento operacional de sinistros.
-- Campos opcionais para manter compatibilidade com registros antigos.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS deadline_at date,
  ADD COLUMN IF NOT EXISTS priority_score integer,
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS responsible_company text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS vehicle_stage text;

UPDATE public.events
   SET opened_at = COALESCE(opened_at, created_at),
       priority_score = COALESCE(
         priority_score,
         CASE
           WHEN priority = 'Baixa' THEN 2
           WHEN priority IN ('Média', 'Media') THEN 5
           WHEN priority = 'Alta' THEN 8
           WHEN priority = 'Urgente' THEN 9
           ELSE 5
         END
       )
 WHERE opened_at IS NULL
    OR priority_score IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'events_priority_score_range'
       AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_priority_score_range
      CHECK (priority_score IS NULL OR priority_score BETWEEN 1 AND 10);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_deadline_at ON public.events(deadline_at);
CREATE INDEX IF NOT EXISTS idx_events_priority_score ON public.events(priority_score);
CREATE INDEX IF NOT EXISTS idx_events_vehicle_stage ON public.events(vehicle_stage);

NOTIFY pgrst, 'reload schema';
