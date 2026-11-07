-- Review target Supabase project before applying. This migration is not deployed by this PR.
CREATE TABLE IF NOT EXISTS public.altiv_extension_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.saas_accounts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  code_hash text NOT NULL UNIQUE CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS altiv_extension_licenses_account_idx
  ON public.altiv_extension_licenses(account_id);
ALTER TABLE public.altiv_extension_licenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.altiv_extension_licenses FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.altiv_extension_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.altiv_extension_licenses(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS altiv_extension_sessions_license_idx
  ON public.altiv_extension_sessions(license_id);
ALTER TABLE public.altiv_extension_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.altiv_extension_sessions FROM anon, authenticated;

-- The single SQL transaction both consumes the one-use code and creates its session.
CREATE OR REPLACE FUNCTION public.redeem_altiv_extension_code(
  p_code_hash text,
  p_session_hash text
)
RETURNS TABLE(session_account_id uuid, session_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE selected_license record;
BEGIN
  IF p_code_hash !~ '^[0-9a-f]{64}$' OR p_session_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
  UPDATE public.altiv_extension_licenses l SET redeemed_at = now()
  WHERE l.code_hash = p_code_hash
    AND l.redeemed_at IS NULL AND l.revoked_at IS NULL
    AND l.expires_at > now()
    AND EXISTS (
      SELECT 1 FROM public.saas_accounts a
      WHERE a.id = l.account_id AND a.status IN ('active','trial')
        AND (a.status <> 'trial' OR a.trial_ends_at > now())
    )
  RETURNING l.id, l.account_id, l.expires_at INTO selected_license;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.altiv_extension_sessions(license_id, token_hash, expires_at)
  VALUES(selected_license.id, p_session_hash, selected_license.expires_at);
  RETURN QUERY SELECT selected_license.account_id::uuid, selected_license.expires_at::timestamptz;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_altiv_extension_code(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_altiv_extension_code(text,text) TO service_role;
