ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS participation_quota numeric;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS participation_quota numeric,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload config';
