-- Remove public read policy from game_rounds (security vulnerability)
-- Server seed should NEVER be accessible before round crashes
DROP POLICY IF EXISTS "Anyone can read rounds" ON public.game_rounds;

-- Add admin-only read policy for the base table
CREATE POLICY "Wallet admins can read all rounds"
ON public.game_rounds
FOR SELECT
USING (
  is_wallet_admin((SELECT wallet_address FROM user_wallets WHERE user_id = auth.uid() LIMIT 1))
);

-- Add comment to clarify usage
COMMENT ON TABLE public.game_rounds IS 'Direct access restricted to admins only. Public clients MUST use game_rounds_secure view which hides server_seed until round completes.';