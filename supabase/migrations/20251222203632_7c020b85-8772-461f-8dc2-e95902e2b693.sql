-- Update is_wallet_admin to include hardcoded admin wallets
CREATE OR REPLACE FUNCTION public.is_wallet_admin(_wallet_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    -- Hardcoded admin wallets (always admin)
    LOWER(_wallet_address) IN (
      LOWER('0x8334966329b7f4b459633696a8ca59118253bc89'),  -- Factory wallet
      LOWER('0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8')   -- Primary wallet
    )
    OR
    -- Or wallet linked to admin user in database (for future additions)
    EXISTS (
      SELECT 1 
      FROM public.user_wallets w
      JOIN public.user_roles r ON r.user_id = w.user_id
      WHERE LOWER(w.wallet_address) = LOWER(_wallet_address)
        AND r.role = 'admin'
    )
$$;