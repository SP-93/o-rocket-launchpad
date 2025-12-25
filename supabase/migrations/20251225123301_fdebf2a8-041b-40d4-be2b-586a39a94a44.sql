-- Create SECURITY DEFINER function to get game rounds publicly
-- This bypasses RLS but hides sensitive data (server_seed, crash_point) for active rounds

CREATE OR REPLACE FUNCTION public.get_game_rounds_public(
  limit_count integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  round_number integer,
  status text,
  server_seed_hash text,
  server_seed text,
  crash_point numeric,
  total_bets integer,
  total_wagered numeric,
  total_payouts numeric,
  started_at timestamptz,
  crashed_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gr.id,
    gr.round_number,
    gr.status,
    gr.server_seed_hash,
    CASE WHEN gr.status IN ('crashed', 'payout') THEN gr.server_seed ELSE NULL END,
    CASE WHEN gr.status IN ('crashed', 'payout') THEN gr.crash_point ELSE NULL END,
    gr.total_bets,
    gr.total_wagered,
    gr.total_payouts,
    gr.started_at,
    gr.crashed_at,
    gr.created_at
  FROM game_rounds gr
  ORDER BY gr.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Grant execute permissions to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_game_rounds_public TO anon;
GRANT EXECUTE ON FUNCTION public.get_game_rounds_public TO authenticated;