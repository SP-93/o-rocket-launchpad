-- Create protocol_config table for storing contract addresses, tokens, pools, network config
CREATE TABLE public.protocol_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value jsonb NOT NULL,
  description text,
  is_public boolean DEFAULT true,
  updated_by text, -- wallet address of admin who made the change
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.protocol_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read public configurations
CREATE POLICY "Anyone can read public config" 
ON public.protocol_config 
FOR SELECT 
USING (is_public = true);

-- Only wallet admins can insert/update/delete
CREATE POLICY "Wallet admins can insert config" 
ON public.protocol_config 
FOR INSERT 
WITH CHECK (is_wallet_admin(
  (SELECT wallet_address FROM public.user_wallets WHERE user_id = auth.uid() LIMIT 1)
));

CREATE POLICY "Wallet admins can update config" 
ON public.protocol_config 
FOR UPDATE 
USING (is_wallet_admin(
  (SELECT wallet_address FROM public.user_wallets WHERE user_id = auth.uid() LIMIT 1)
));

CREATE POLICY "Wallet admins can delete config" 
ON public.protocol_config 
FOR DELETE 
USING (is_wallet_admin(
  (SELECT wallet_address FROM public.user_wallets WHERE user_id = auth.uid() LIMIT 1)
));

-- Create trigger for updated_at
CREATE TRIGGER update_protocol_config_updated_at
BEFORE UPDATE ON public.protocol_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create audit_log table for tracking all admin actions
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  wallet_address text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Wallet admins can read audit logs" 
ON public.audit_log 
FOR SELECT 
USING (is_wallet_admin(
  (SELECT wallet_address FROM public.user_wallets WHERE user_id = auth.uid() LIMIT 1)
));

-- System can insert audit logs (via edge function with service role)
CREATE POLICY "System can insert audit logs" 
ON public.audit_log 
FOR INSERT 
WITH CHECK (true);

-- Insert initial configuration data
INSERT INTO public.protocol_config (config_key, config_value, description, is_public) VALUES
('mainnet_contracts', '{
  "factory": "0x7Ff6342b79926813E674732e88F39837FA8B64ed",
  "router": "0xFd83B523C6281343FBCa163F7908bCC5874a245B",
  "nftDescriptorLibrary": "0x0688dc5670dFc719cc0dAf0429382b3fb27fE274",
  "nftDescriptor": "0x324910c4062f20e7E19e711B61c841F5eD032C14",
  "positionManager": "0x7862fEdaa679712bD69402a61aA2063ad9DA3363",
  "quoter": "0x4Db49b37aaC5978AB9CC476E887f0c290dE1ee54"
}', 'Deployed Uniswap V3 contract addresses on OverProtocol Mainnet', true),

('token_addresses', '{
  "WOVER": "0x59c914C8ac6F212bb655737CC80d9Abc79A1e273",
  "USDT": "0xA510432E4aa60B4acd476fb850EC84B7EE226b2d",
  "USDC": "0x8712796136Ac8e0EEeC123251ef93702f265aa80"
}', 'Official token addresses on OverProtocol Mainnet', true),

('mainnet_pools', '{
  "WOVER/USDT": "0x65d22Adf0DA92c31528dC38f3ff87ed221c01e77"
}', 'Deployed liquidity pool addresses', true),

('network_config', '{
  "chainId": 54176,
  "chainIdHex": "0xd3a0",
  "chainName": "OverProtocol Mainnet",
  "rpcUrls": ["https://rpc.overprotocol.com"],
  "blockExplorerUrls": ["https://scan.over.network"],
  "nativeCurrency": {
    "name": "OVER",
    "symbol": "OVER",
    "decimals": 18
  }
}', 'Network configuration for OverProtocol', true),

('fee_config', '{
  "lpShare": 80,
  "protocolShare": 20,
  "feeProtocol": 5,
  "defaultFeeProtocol": 5
}', 'Protocol fee split configuration', true),

('admin_wallets', '{
  "primary": "0x8334966329b7f4b459633696A8CA59118253bC89",
  "secondary": "0x8b847BD369D2FDAC7944E68277D6bA04AaEb38b8",
  "treasury": "0x8334966329b7f4b459633696A8CA59118253bC89"
}', 'Admin wallet addresses', true);