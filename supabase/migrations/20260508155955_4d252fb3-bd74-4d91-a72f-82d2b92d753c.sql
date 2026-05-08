REVOKE EXECUTE ON FUNCTION public.conversation_peer_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_peer_email(uuid) TO authenticated;