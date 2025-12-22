-- Create profiles table for user metadata
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create user_wallets table for multiple wallets per user
CREATE TABLE public.user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address) -- One wallet can only be linked to one user
);

-- Enable RLS on user_wallets
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_wallets
CREATE POLICY "Users can view own wallets" ON public.user_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallets" ON public.user_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wallets" ON public.user_wallets
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets" ON public.user_wallets
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Function to check if a wallet address belongs to an admin user
CREATE OR REPLACE FUNCTION public.is_wallet_admin(_wallet_address TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_wallets w
    JOIN public.user_roles r ON r.user_id = w.user_id
    WHERE LOWER(w.wallet_address) = LOWER(_wallet_address)
      AND r.role = 'admin'
  )
$$;

-- Trigger to update updated_at on profiles
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();