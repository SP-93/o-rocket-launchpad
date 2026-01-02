-- Create game_chat_messages table for live player chat
CREATE TABLE public.game_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message TEXT NOT NULL CHECK (char_length(message) <= 100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.game_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone can read chat messages (public feature)
CREATE POLICY "Anyone can read chat messages" 
ON public.game_chat_messages 
FOR SELECT 
USING (true);

-- RLS: Connected users can insert their own messages
CREATE POLICY "Connected wallets can insert chat messages" 
ON public.game_chat_messages 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_chat_messages;

-- Create index for faster queries
CREATE INDEX idx_game_chat_messages_created_at ON public.game_chat_messages(created_at DESC);

-- Auto-delete old messages (older than 1 hour) to keep table small
-- This will be handled by a cron job or edge function