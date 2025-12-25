-- Create RPC function for public bet viewing (limited data for LiveBetsFeed)
CREATE OR REPLACE FUNCTION public.get_round_bets_public(round_uuid uuid)
RETURNS TABLE(
  id uuid,
  wallet_address text,
  bet_amount numeric,
  status text,
  auto_cashout_at numeric,
  cashed_out_at numeric,
  winnings numeric,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gb.id,
    gb.wallet_address,
    gb.bet_amount,
    gb.status,
    gb.auto_cashout_at,
    gb.cashed_out_at,
    gb.winnings,
    gb.created_at
  FROM game_bets gb
  WHERE gb.round_id = round_uuid
  ORDER BY gb.created_at DESC
  LIMIT 50;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_round_bets_public(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_round_bets_public(uuid) TO authenticated;

-- Create function to get active bet count for a round (for admin panel)
CREATE OR REPLACE FUNCTION public.get_round_bet_count(round_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM game_bets
  WHERE round_id = round_uuid;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_round_bet_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_round_bet_count(uuid) TO authenticated;