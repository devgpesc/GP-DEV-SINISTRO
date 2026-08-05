BEGIN;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.quotations
   SET updated_at = coalesce(updated_at, created_at, now());

CREATE OR REPLACE FUNCTION public.touch_quotation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_quotation_updated_at ON public.quotations;
CREATE TRIGGER trg_touch_quotation_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.touch_quotation_updated_at();

NOTIFY pgrst, 'reload schema';

COMMIT;
