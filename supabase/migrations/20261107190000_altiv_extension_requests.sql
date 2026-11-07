-- Run only after the PR #22 license migration has been reviewed and applied to STAGING.
-- This feature queues reviewable requests; it does NOT execute AI or GitHub writes.
CREATE TABLE IF NOT EXISTS public.altiv_extension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.saas_accounts(id) ON DELETE CASCADE,
  license_id uuid NOT NULL REFERENCES public.altiv_extension_licenses(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  prompt text NOT NULL CHECK (char_length(trim(prompt)) BETWEEN 12 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','rejected','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);
ALTER TABLE public.altiv_extension_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.altiv_extension_requests FROM anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.altiv_extension_requests TO service_role;
CREATE INDEX IF NOT EXISTS altiv_extension_requests_account_date
  ON public.altiv_extension_requests(account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS altiv_extension_requests_license_date
  ON public.altiv_extension_requests(license_id,created_at DESC);

-- Transactional account-level lock ensures the daily quota cannot be bypassed
-- by parallel requests. Function is invoked ONLY by the server's service_role.
CREATE OR REPLACE FUNCTION public.create_altiv_extension_request(
  p_token_hash text,
  p_project_id uuid,
  p_prompt text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_license_id uuid;
  v_account_id uuid;
  v_owner_id uuid;
  v_project_allowed boolean;
  v_daily_count integer;
  v_request_id uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR p_project_id IS NULL OR p_prompt IS NULL
     OR char_length(btrim(p_prompt)) NOT BETWEEN 12 AND 2000 THEN
    RETURN NULL;
  END IF;

  SELECT s.license_id, l.account_id INTO v_license_id, v_account_id
  FROM public.altiv_extension_sessions s
  JOIN public.altiv_extension_licenses l ON l.id = s.license_id
  WHERE s.token_hash = p_token_hash
    AND s.revoked_at IS NULL AND s.expires_at > now()
    AND l.revoked_at IS NULL AND l.expires_at > now();
  IF v_license_id IS NULL OR v_account_id IS NULL THEN RETURN NULL; END IF;

  -- Lock the account row until the request is inserted to serialize quota checks.
  SELECT a.owner_id INTO v_owner_id FROM public.saas_accounts a
  WHERE a.id = v_account_id AND a.status IN ('trial','active')
    AND (a.status <> 'trial' OR a.trial_ends_at > now())
  FOR UPDATE OF a;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = p_project_id
      AND p.account_id = v_account_id AND p.owner_id = v_owner_id
  ) INTO v_project_allowed;
  IF NOT v_project_allowed THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_daily_count FROM public.altiv_extension_requests r
    WHERE r.account_id = v_account_id
      AND r.created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
  IF v_daily_count >= 10 THEN
    RAISE EXCEPTION 'daily_request_limit' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.altiv_extension_requests(account_id,license_id,project_id,prompt)
  VALUES (v_account_id,v_license_id,p_project_id,btrim(p_prompt))
  RETURNING id INTO v_request_id;
  RETURN v_request_id;
END
$$;
REVOKE ALL ON FUNCTION public.create_altiv_extension_request(text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_altiv_extension_request(text,uuid,text) TO service_role;
