-- Drop existing policy and create new one with expanded blacklist
DROP POLICY IF EXISTS "Anyone can read public config" ON game_config;

CREATE POLICY "Anyone can read public config"
ON game_config
FOR SELECT
USING (
  config_key NOT IN (
    'treasury_wallet_private',
    'admin_secrets',
    'factory_deployer_wallet',
    'admin_private_key',
    'private_key',
    'secret_key'
  )
);