-- Create table for securely storing server seeds (encrypted)
CREATE TABLE public.game_round_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL UNIQUE,
  encrypted_server_seed TEXT NOT NULL,
  server_seed_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_round_secrets ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table (via edge functions)
-- No public policies - completely locked down

-- Create index for fast lookups by round_id
CREATE INDEX idx_game_round_secrets_round_id ON public.game_round_secrets(round_id);

-- Add comment explaining the table purpose
COMMENT ON TABLE public.game_round_secrets IS 'Stores encrypted server seeds for active game rounds. Seeds are deleted after the round crashes.';