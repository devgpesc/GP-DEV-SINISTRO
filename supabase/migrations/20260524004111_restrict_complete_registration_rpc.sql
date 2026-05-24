BEGIN;

REVOKE ALL ON FUNCTION public.complete_registration(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_registration(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_registration(text, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
