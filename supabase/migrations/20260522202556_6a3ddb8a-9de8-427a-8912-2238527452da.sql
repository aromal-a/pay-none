
-- Revoke from PUBLIC and anon on all SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.credit_tokens(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conversation_peer_email(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_message(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spend_tokens(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spend_tokens(integer, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_call_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_call_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wipe_viewer_traces() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_credit_tokens(text, integer, integer, text, text) FROM PUBLIC, anon, authenticated;

-- Grant explicit access only where needed
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conversation_peer_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_tokens(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_tokens(integer, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_call_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_call_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wipe_viewer_traces() TO authenticated;

-- Admin-only / internal: service_role only
GRANT EXECUTE ON FUNCTION public.admin_credit_tokens(text, integer, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_tokens(uuid, integer) TO service_role;
