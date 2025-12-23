-- Dodaj politiku koja dozvoljava wallet adminima čitanje SVIH konfiguracija (uključujući privatne)
CREATE POLICY "Wallet admins can read all config" 
ON public.protocol_config
FOR SELECT
USING (
  is_wallet_admin((SELECT wallet_address FROM public.user_wallets WHERE user_id = auth.uid() LIMIT 1))
);