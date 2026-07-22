-- Sincroniza file_path com url quando necessario (anexos legado / app)
CREATE OR REPLACE FUNCTION public.sync_event_attachment_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name := COALESCE(NULLIF(trim(NEW.name), ''), NULLIF(trim(NEW.file_name), ''), 'Anexo');
  NEW.file_name := COALESCE(NULLIF(trim(NEW.file_name), ''), NEW.name, 'Anexo');

  IF NEW.type IS NULL AND NEW.mime_type IS NOT NULL THEN
    NEW.type := NEW.mime_type;
  END IF;
  IF NEW.mime_type IS NULL AND NEW.type IS NOT NULL THEN
    NEW.mime_type := NEW.type;
  END IF;
  IF NEW.file_type IS NULL AND NEW.mime_type IS NOT NULL THEN
    NEW.file_type := NEW.mime_type;
  END IF;

  -- Se so veio URL publica, deriva file_path do Storage
  IF (NEW.file_path IS NULL OR trim(NEW.file_path) = '') AND NEW.url IS NOT NULL THEN
    IF position('/event-attachments/' in NEW.url) > 0 THEN
      NEW.file_path := split_part(NEW.url, '/event-attachments/', 2);
    ELSE
      NEW.file_path := NEW.url;
    END IF;
  END IF;

  IF NEW.url IS NULL AND NEW.file_path IS NOT NULL THEN
    NEW.url := NEW.file_path;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_event_attachment_names ON public.event_attachments;
CREATE TRIGGER trg_sync_event_attachment_names
BEFORE INSERT OR UPDATE ON public.event_attachments
FOR EACH ROW EXECUTE FUNCTION public.sync_event_attachment_names();

NOTIFY pgrst, 'reload schema';
