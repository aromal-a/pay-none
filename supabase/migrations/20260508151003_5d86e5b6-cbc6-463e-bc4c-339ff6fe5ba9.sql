REVOKE EXECUTE ON FUNCTION public.admin_credit_tokens(TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;