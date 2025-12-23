-- Create a secure view that hides server_seed and crash_point until round is crashed
-- This provides an additional layer of security on top of the edge function changes

-- First, create a security function that checks if seed should be visible
CREATE OR REPLACE FUNCTION public.get_visible_server_seed(
  round_status text,
  actual_seed text
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE 
    WHEN round_status IN ('crashed', 'payout') THEN actual_seed 
    ELSE NULL 
  END;
$$;

-- Create function for crash point visibility
CREATE OR REPLACE FUNCTION public.get_visible_crash_point(
  round_status text,
  actual_crash_point numeric
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE 
    WHEN round_status IN ('crashed', 'payout') THEN actual_crash_point 
    ELSE NULL 
  END;
$$;

-- Create a secure view for public access to game rounds
-- This view automatically hides sensitive data until appropriate
CREATE OR REPLACE VIEW public.game_rounds_secure AS
SELECT 
  id,
  round_number,
  status,
  server_seed_hash,
  -- Only show server_seed after round is crashed
  public.get_visible_server_seed(status, server_seed) as server_seed,
  -- Only show crash_point after round is crashed  
  public.get_visible_crash_point(status, crash_point) as crash_point,
  total_bets,
  total_wagered,
  total_payouts,
  started_at,
  crashed_at,
  created_at
FROM game_rounds;

-- Grant access to the view
GRANT SELECT ON public.game_rounds_secure TO anon;
GRANT SELECT ON public.game_rounds_secure TO authenticated;

-- Add comment explaining the security purpose
COMMENT ON VIEW public.game_rounds_secure IS 
'Secure view of game_rounds that hides server_seed and crash_point until round status is crashed or payout. Use this view for public queries to ensure provably fair integrity.';
