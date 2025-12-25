-- Add explicit RLS policies for game_round_secrets table
-- Only wallet admins should be able to read/write this sensitive data

-- SELECT policy - only wallet admins can read
CREATE POLICY "Only wallet admins can read round secrets"
ON game_round_secrets
FOR SELECT
USING (
  is_wallet_admin((SELECT wallet_address FROM user_wallets WHERE user_id = auth.uid() LIMIT 1))
);

-- INSERT policy - only wallet admins can insert
CREATE POLICY "Only wallet admins can insert round secrets"
ON game_round_secrets
FOR INSERT
WITH CHECK (
  is_wallet_admin((SELECT wallet_address FROM user_wallets WHERE user_id = auth.uid() LIMIT 1))
);

-- UPDATE policy - only wallet admins can update
CREATE POLICY "Only wallet admins can update round secrets"
ON game_round_secrets
FOR UPDATE
USING (
  is_wallet_admin((SELECT wallet_address FROM user_wallets WHERE user_id = auth.uid() LIMIT 1))
);

-- DELETE policy - only wallet admins can delete
CREATE POLICY "Only wallet admins can delete round secrets"
ON game_round_secrets
FOR DELETE
USING (
  is_wallet_admin((SELECT wallet_address FROM user_wallets WHERE user_id = auth.uid() LIMIT 1))
);