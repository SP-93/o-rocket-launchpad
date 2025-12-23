-- =============================================
-- ROCKET CRASH GAME DATABASE SCHEMA
-- =============================================

-- 1. GAME TICKETS TABLE
CREATE TABLE public.game_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  ticket_value NUMERIC NOT NULL CHECK (ticket_value >= 1 AND ticket_value <= 5),
  payment_currency TEXT NOT NULL CHECK (payment_currency IN ('WOVER', 'USDT')),
  payment_amount NUMERIC NOT NULL CHECK (payment_amount > 0),
  tx_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_in_round UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. GAME ROUNDS TABLE
CREATE TABLE public.game_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number SERIAL,
  status TEXT DEFAULT 'betting' CHECK (status IN ('betting', 'countdown', 'flying', 'crashed', 'payout')),
  crash_point NUMERIC CHECK (crash_point >= 1.00 AND crash_point <= 10.00),
  server_seed_hash TEXT,
  server_seed TEXT,
  started_at TIMESTAMPTZ,
  crashed_at TIMESTAMPTZ,
  total_bets INTEGER DEFAULT 0,
  total_wagered NUMERIC DEFAULT 0,
  total_payouts NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GAME BETS TABLE
CREATE TABLE public.game_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  ticket_id UUID REFERENCES public.game_tickets(id),
  bet_amount NUMERIC NOT NULL CHECK (bet_amount > 0),
  auto_cashout_at NUMERIC CHECK (auto_cashout_at IS NULL OR (auto_cashout_at >= 1.01 AND auto_cashout_at <= 10.00)),
  cashed_out_at NUMERIC CHECK (cashed_out_at IS NULL OR (cashed_out_at >= 1.00 AND cashed_out_at <= 10.00)),
  winnings NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. GAME POOL TABLE (Admin only)
CREATE TABLE public.game_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_balance NUMERIC DEFAULT 0 CHECK (current_balance >= 0),
  total_deposits NUMERIC DEFAULT 0,
  total_payouts NUMERIC DEFAULT 0,
  last_refill_at TIMESTAMPTZ,
  last_payout_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. GAME REVENUE TABLE (Admin only)
CREATE TABLE public.game_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_wover NUMERIC DEFAULT 0 CHECK (pending_wover >= 0),
  pending_usdt NUMERIC DEFAULT 0 CHECK (pending_usdt >= 0),
  total_wover_collected NUMERIC DEFAULT 0,
  total_usdt_collected NUMERIC DEFAULT 0,
  last_distribution_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. GAME CONFIG TABLE
CREATE TABLE public.game_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for used_in_round after game_rounds is created
ALTER TABLE public.game_tickets 
  ADD CONSTRAINT fk_used_in_round 
  FOREIGN KEY (used_in_round) 
  REFERENCES public.game_rounds(id) ON DELETE SET NULL;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.game_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;

-- GAME_TICKETS policies
CREATE POLICY "Users can read own tickets"
  ON public.game_tickets FOR SELECT
  USING (
    LOWER(wallet_address) = LOWER((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can read all tickets"
  ON public.game_tickets FOR SELECT
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can insert tickets"
  ON public.game_tickets FOR INSERT
  WITH CHECK (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can update tickets"
  ON public.game_tickets FOR UPDATE
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

-- GAME_ROUNDS policies (public read, admin write)
CREATE POLICY "Anyone can read rounds"
  ON public.game_rounds FOR SELECT
  USING (true);

CREATE POLICY "Wallet admins can insert rounds"
  ON public.game_rounds FOR INSERT
  WITH CHECK (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can update rounds"
  ON public.game_rounds FOR UPDATE
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

-- GAME_BETS policies
CREATE POLICY "Users can read own bets"
  ON public.game_bets FOR SELECT
  USING (
    LOWER(wallet_address) = LOWER((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can read all bets"
  ON public.game_bets FOR SELECT
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can insert bets"
  ON public.game_bets FOR INSERT
  WITH CHECK (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can update bets"
  ON public.game_bets FOR UPDATE
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

-- GAME_POOL policies (admin only)
CREATE POLICY "Wallet admins can read pool"
  ON public.game_pool FOR SELECT
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can insert pool"
  ON public.game_pool FOR INSERT
  WITH CHECK (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can update pool"
  ON public.game_pool FOR UPDATE
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

-- GAME_REVENUE policies (admin only)
CREATE POLICY "Wallet admins can read revenue"
  ON public.game_revenue FOR SELECT
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can insert revenue"
  ON public.game_revenue FOR INSERT
  WITH CHECK (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can update revenue"
  ON public.game_revenue FOR UPDATE
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

-- GAME_CONFIG policies
CREATE POLICY "Anyone can read public config"
  ON public.game_config FOR SELECT
  USING (
    config_key NOT IN ('treasury_wallet_private', 'admin_secrets')
  );

CREATE POLICY "Wallet admins can read all config"
  ON public.game_config FOR SELECT
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can insert config"
  ON public.game_config FOR INSERT
  WITH CHECK (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can update config"
  ON public.game_config FOR UPDATE
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

CREATE POLICY "Wallet admins can delete config"
  ON public.game_config FOR DELETE
  USING (
    is_wallet_admin((
      SELECT wallet_address FROM public.user_wallets
      WHERE user_id = auth.uid()
      LIMIT 1
    ))
  );

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert initial game pool record
INSERT INTO public.game_pool (current_balance, total_deposits, total_payouts)
VALUES (0, 0, 0);

-- Insert initial game revenue record
INSERT INTO public.game_revenue (pending_wover, pending_usdt, total_wover_collected, total_usdt_collected)
VALUES (0, 0, 0, 0);

-- Insert initial game config
INSERT INTO public.game_config (config_key, config_value) VALUES
  ('game_status', '{"active": false}'::jsonb),
  ('distribution_split', '{"prize_pool": 70, "platform": 30}'::jsonb),
  ('auto_pause_threshold', '{"wover": 150}'::jsonb),
  ('factory_deployer_wallet', '{"address": "0x8334966329b7f4b459633696A8CA59118253bC89"}'::jsonb);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_game_tickets_wallet ON public.game_tickets(wallet_address);
CREATE INDEX idx_game_tickets_expires ON public.game_tickets(expires_at);
CREATE INDEX idx_game_tickets_unused ON public.game_tickets(is_used) WHERE is_used = false;
CREATE INDEX idx_game_rounds_status ON public.game_rounds(status);
CREATE INDEX idx_game_rounds_created ON public.game_rounds(created_at DESC);
CREATE INDEX idx_game_bets_round ON public.game_bets(round_id);
CREATE INDEX idx_game_bets_wallet ON public.game_bets(wallet_address);
CREATE INDEX idx_game_bets_status ON public.game_bets(status);

-- =============================================
-- REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_bets;