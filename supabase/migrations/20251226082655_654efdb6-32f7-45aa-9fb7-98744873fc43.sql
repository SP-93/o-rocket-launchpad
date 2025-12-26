-- Add game_tickets to realtime publication for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_tickets;

-- Set REPLICA IDENTITY FULL for complete row data on updates
ALTER TABLE public.game_tickets REPLICA IDENTITY FULL;