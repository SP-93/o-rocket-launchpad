-- Audit log treba biti IMUTABILAN - zabrani UPDATE i DELETE za sve
-- Ovo osigurava integritet audit traga

-- Dodaj restriktivnu UPDATE politiku za audit_log (nikome nije dozvoljeno)
CREATE POLICY "Audit logs cannot be updated"
ON public.audit_log
FOR UPDATE
USING (false)
WITH CHECK (false);

-- Dodaj restriktivnu DELETE politiku za audit_log (nikome nije dozvoljeno)
CREATE POLICY "Audit logs cannot be deleted"
ON public.audit_log
FOR DELETE
USING (false);

-- Dodaj DELETE politiku za profiles (samo admini ili korisnik sam sebi)
CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
USING (is_admin(auth.uid()));