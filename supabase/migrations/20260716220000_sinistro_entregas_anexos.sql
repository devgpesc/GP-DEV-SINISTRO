-- Tipos de sinistro configuráveis, anexos, aprovação por escrito e entregas simplificadas

ALTER TABLE public.saas_settings
  ADD COLUMN IF NOT EXISTS event_types jsonb DEFAULT '["Colisão","Furto","Roubo","Periférico","Acordo"]'::jsonb;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS delivered_by text,
  ADD COLUMN IF NOT EXISTS observation text,
  ADD COLUMN IF NOT EXISTS movement_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer text,
  ADD COLUMN IF NOT EXISTS vehicle text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-attachments', 'event-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated upload event attachments" ON storage.objects;
CREATE POLICY "Authenticated upload event attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-attachments');

DROP POLICY IF EXISTS "Public read event attachments" ON storage.objects;
CREATE POLICY "Public read event attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-attachments');

DROP POLICY IF EXISTS "Authenticated update event attachments" ON storage.objects;
CREATE POLICY "Authenticated update event attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'event-attachments');

DROP POLICY IF EXISTS "Authenticated delete event attachments" ON storage.objects;
CREATE POLICY "Authenticated delete event attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-attachments');

NOTIFY pgrst, 'reload config';
