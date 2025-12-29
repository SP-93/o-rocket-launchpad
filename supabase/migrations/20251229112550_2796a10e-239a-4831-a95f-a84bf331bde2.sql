-- Create game audit log table for tracking all game events
CREATE TABLE public.game_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  wallet_address TEXT,
  ticket_id UUID,
  bet_id UUID,
  round_id UUID,
  correlation_id TEXT,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_game_audit_log_wallet ON public.game_audit_log(wallet_address);
CREATE INDEX idx_game_audit_log_event_type ON public.game_audit_log(event_type);
CREATE INDEX idx_game_audit_log_created_at ON public.game_audit_log(created_at DESC);
CREATE INDEX idx_game_audit_log_round_id ON public.game_audit_log(round_id);
CREATE INDEX idx_game_audit_log_correlation_id ON public.game_audit_log(correlation_id);

-- Enable Row Level Security
ALTER TABLE public.game_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit logs
CREATE POLICY "Users can read own audit logs" 
ON public.game_audit_log 
FOR SELECT 
USING (lower(wallet_address) = lower((SELECT user_wallets.wallet_address FROM user_wallets WHERE user_wallets.user_id = auth.uid() LIMIT 1)));

-- Wallet admins can read all audit logs
CREATE POLICY "Wallet admins can read all audit logs" 
ON public.game_audit_log 
FOR SELECT 
USING (is_wallet_admin((SELECT user_wallets.wallet_address FROM user_wallets WHERE user_wallets.user_id = auth.uid() LIMIT 1)));

-- Only service role can insert (via edge functions)
CREATE POLICY "Service role can insert audit logs"
ON public.game_audit_log
FOR INSERT
WITH CHECK (true);

-- Audit logs cannot be updated or deleted
CREATE POLICY "Audit logs cannot be updated"
ON public.game_audit_log
FOR UPDATE
USING (false);

CREATE POLICY "Audit logs cannot be deleted"
ON public.game_audit_log
FOR DELETE
USING (false);

-- Add serial number to game_tickets for better tracking
ALTER TABLE public.game_tickets ADD COLUMN IF NOT EXISTS serial_number BIGINT;

-- Create sequence for ticket serial numbers
CREATE SEQUENCE IF NOT EXISTS game_ticket_serial_seq START 1;

-- Create trigger to auto-assign serial number on ticket creation
CREATE OR REPLACE FUNCTION public.assign_ticket_serial_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.serial_number IS NULL THEN
    NEW.serial_number := nextval('game_ticket_serial_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER assign_ticket_serial
BEFORE INSERT ON public.game_tickets
FOR EACH ROW
EXECUTE FUNCTION public.assign_ticket_serial_number();

-- Enable realtime for audit log
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_audit_log;