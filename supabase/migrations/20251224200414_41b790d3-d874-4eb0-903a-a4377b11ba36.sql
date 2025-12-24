-- Drop existing CHECK constraint that only allows 'active', 'won', 'lost'
ALTER TABLE public.game_bets DROP CONSTRAINT IF EXISTS game_bets_status_check;

-- Add new CHECK constraint that includes 'claiming' and 'claimed' statuses
ALTER TABLE public.game_bets ADD CONSTRAINT game_bets_status_check 
  CHECK (status IN ('active', 'won', 'lost', 'claiming', 'claimed'));

-- Add columns to track claim details
ALTER TABLE public.game_bets ADD COLUMN IF NOT EXISTS claim_tx_hash text;
ALTER TABLE public.game_bets ADD COLUMN IF NOT EXISTS claim_nonce bigint;
ALTER TABLE public.game_bets ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone;
ALTER TABLE public.game_bets ADD COLUMN IF NOT EXISTS claiming_started_at timestamp with time zone;