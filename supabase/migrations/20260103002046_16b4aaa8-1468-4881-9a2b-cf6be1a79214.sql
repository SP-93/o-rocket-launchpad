-- Create chat_profiles table for nickname system
CREATE TABLE IF NOT EXISTS public.chat_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on lowercase nickname for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS chat_profiles_nickname_lower_idx 
ON public.chat_profiles (LOWER(nickname));

-- Enable Row Level Security
ALTER TABLE public.chat_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read nicknames (public chat)
CREATE POLICY "Anyone can view chat profiles" 
ON public.chat_profiles 
FOR SELECT 
USING (true);

-- Only service role can insert/update (via edge function)
CREATE POLICY "Service role can manage chat profiles" 
ON public.chat_profiles 
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_chat_profiles_updated_at
BEFORE UPDATE ON public.chat_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for wallet lookups
CREATE INDEX IF NOT EXISTS chat_profiles_wallet_idx 
ON public.chat_profiles (LOWER(wallet_address));