-- Dodaj UPDATE politiku za user_roles (samo admini mogu ažurirati)
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Dodaj UPDATE politiku za user_wallets (korisnici mogu ažurirati svoje)
CREATE POLICY "Users can update own wallets"
ON public.user_wallets
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Dodaj UPDATE politiku za user_wallets (admini mogu ažurirati sve)
CREATE POLICY "Admins can update all wallets"
ON public.user_wallets
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));