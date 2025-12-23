-- Drop the insecure INSERT policy that allows anyone to insert
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Create new secure INSERT policy - only wallet admins can insert directly
-- Edge functions with service_role bypass RLS automatically, so they will continue to work
CREATE POLICY "Only wallet admins can insert audit logs" 
ON public.audit_log 
FOR INSERT 
WITH CHECK (
  is_wallet_admin(
    (SELECT wallet_address FROM public.user_wallets WHERE user_id = auth.uid() LIMIT 1)
  )
);