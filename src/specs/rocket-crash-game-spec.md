# Rocket Crash Game Specification

## Overview
Multiplayer crash betting game integrated into O'Rocket DEX on Over Protocol mainnet.

**Navigation**: "Game🚀" link in main navigation
**Route**: `/game`
**Wallet**: Shares connection with DEX

---

## Access Control

| Status | Can See | Cannot |
|--------|---------|--------|
| **Spectator** (no wallet) | Live gameplay, Leaderboard, Crash history | Ticket purchase, Betting, Cash-out |
| **Connected Wallet** | Everything | - |

---

## Payment Methods

| Token | Status | Notes |
|-------|--------|-------|
| **WOVER** | ✅ Active | Native token |
| **USDT** | ✅ Active | Dynamic pricing via CoinGecko |
| **USDC** | 🔜 Coming Soon | Disabled in UI |
| **ROCKET** | 🔜 Coming Soon | Platform token (Phase 2) |

---

## Revenue Flow

### All Payments → Game Treasury Wallet First

```
PLAYER BUYS TICKET
       │
       ▼
┌──────────────────────────────────┐
│     GAME TREASURY WALLET         │
│     (Collects all payments)      │
│                                  │
│  pending_wover: XXX WOVER        │
│  pending_usdt:  XXX USDT         │
└──────────────────────────────────┘
       │
       │ Admin clicks "Distribute"
       ▼
┌──────────────────────────────────┐
│  WOVER DISTRIBUTION              │
│  Split: 20-80% (configurable)    │
│  ├─► Prize Pool (for payouts)    │
│  └─► Platform Treasury           │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  USDT DISTRIBUTION               │
│  100% → Factory Deployer Wallet  │
│  (0x8334966329b7f4b459633696A8CA │
│   59118253bC89)                  │
└──────────────────────────────────┘
```

**Benefits**:
- Full transparency (all revenue visible in treasury)
- Batch processing (accumulate then distribute)
- Admin control over timing
- Clear audit trail

---

## Ticket System

### Ticket Values
| Tier | WOVER | USDT Equivalent |
|------|-------|-----------------|
| 1 | 1 WOVER | Dynamic (CoinGecko) |
| 2 | 2 WOVER | Dynamic |
| 3 | 3 WOVER | Dynamic |
| 4 | 4 WOVER | Dynamic |
| 5 | 5 WOVER | Dynamic |

### Ticket Properties
- **Validity**: 15 days from purchase
- **Countdown**: Visible timer on each ticket
- **One-time use**: Consumed when placing bet
- **On-chain verification**: Optional tx_hash for proof
- **Supabase tracking**: Full history

---

## Game Round Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        ROUND TIMELINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  BETTING      COUNTDOWN      FLYING           CRASH      GAP    │
│   (15s)         (3s)       (3-30s)            (1s)      (10s)   │
│                                                                  │
│  ┌─────┐     ┌─────┐     ┌─────────────┐    ┌─────┐   ┌─────┐  │
│  │Place│     │ 3.. │     │ x1.0 → x10  │    │BOOM │   │Wait │  │
│  │Bets │ ──► │ 2.. │ ──► │ Cash out!   │ ──►│     │ ──►│     │  │
│  │     │     │ 1.. │     │             │    │     │   │     │  │
│  └─────┘     └─────┘     └─────────────┘    └─────┘   └─────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Round Statuses
1. `betting` - Players can place bets (15 seconds)
2. `countdown` - 3, 2, 1... Liftoff! (3 seconds)
3. `flying` - Multiplier increasing, can cash out (3-30 seconds)
4. `crashed` - Round ended (instant)
5. `payout` - Processing winners (background)
6. `gap` - Cooldown before next round (10 seconds)

---

## Prize Pool Rules

### Visibility
- **Balance NOT shown** to players (prevents manipulation)
- Only admin can view actual balance

### Auto-Pause
- Game **automatically pauses** when pool < 150 WOVER
- Admin notification sent
- Prevents payouts exceeding pool

### Refill
- Admin can manually refill pool
- Transfer WOVER to Prize Pool wallet
- Updates `game_pool.current_balance`

### Payouts
- **All payouts in WOVER only**
- Processed during `payout` phase
- Logged in audit trail

### Withdrawal Protection
- Admin **CANNOT** directly withdraw from Prize Pool
- Only way out is through player payouts

---

## Betting Mechanics

### Place Bet
- Select ticket to use (consumes it)
- Choose auto cash-out: **x2**, **x10**, or **OFF**
- Confirm bet before round starts

### Cash-out Options
1. **Manual**: Click "CASH OUT" button during flight
2. **Auto x2**: Automatically cash out at 2x multiplier
3. **Auto x10**: Automatically cash out at 10x multiplier
4. **OFF**: Manual only (no auto)

### Winnings Calculation
```
winnings = ticket_value × cash_out_multiplier
```

Example: 3 WOVER ticket, cash out at x4.5 = 13.5 WOVER

---

## Anti-Exploit Measures

### Instant Crash
- **3% probability** of instant crash (x1.00)
- Prevents guaranteed wins
- Random, unpredictable

### Max Multiplier
- Capped at **x10.00**
- Lower than some games (x100) for sustainability
- Better odds for sustained play

### Server-Side Calculation
- Crash point calculated **ONLY on backend**
- No client-side prediction possible
- Seed revealed after round

### Provably Fair System
```
1. Server generates random seed
2. Hash of seed published BEFORE round
3. Round plays out
4. Actual seed revealed AFTER crash
5. Anyone can verify: hash(revealed_seed) === published_hash
```

### Ticket Expiry
- 15-day validity prevents hoarding
- Encourages active play

### Rate Limiting
- All endpoints rate-limited
- IP + wallet address based
- Prevents spam/abuse

---

## Database Schema

### 1. game_tickets
```sql
CREATE TABLE game_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  ticket_value NUMERIC NOT NULL,          -- 1-5 WOVER equivalent
  payment_currency TEXT NOT NULL,         -- 'WOVER' | 'USDT'
  payment_amount NUMERIC NOT NULL,        -- actual amount paid
  tx_hash TEXT,                           -- on-chain verification
  expires_at TIMESTAMPTZ NOT NULL,        -- created_at + 15 days
  is_used BOOLEAN DEFAULT FALSE,
  used_in_round UUID,                     -- references game_rounds
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. game_rounds
```sql
CREATE TABLE game_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number SERIAL,
  status TEXT DEFAULT 'betting',           -- betting|countdown|flying|crashed|payout
  crash_point NUMERIC,                     -- 1.00 - 10.00
  server_seed_hash TEXT,                   -- commit before round
  server_seed TEXT,                        -- reveal after crash
  started_at TIMESTAMPTZ,
  crashed_at TIMESTAMPTZ,
  total_bets INTEGER DEFAULT 0,
  total_wagered NUMERIC DEFAULT 0,
  total_payouts NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. game_bets
```sql
CREATE TABLE game_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES game_rounds(id),
  wallet_address TEXT NOT NULL,
  ticket_id UUID REFERENCES game_tickets(id),
  bet_amount NUMERIC NOT NULL,             -- ticket value
  auto_cashout_at NUMERIC,                 -- x2, x10, or NULL (manual)
  cashed_out_at NUMERIC,                   -- multiplier when cashed out
  winnings NUMERIC DEFAULT 0,              -- bet_amount × cashed_out_at
  status TEXT DEFAULT 'active',            -- active|won|lost
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. game_pool
```sql
CREATE TABLE game_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_balance NUMERIC DEFAULT 0,       -- WOVER available for payouts
  total_deposits NUMERIC DEFAULT 0,
  total_payouts NUMERIC DEFAULT 0,
  last_refill_at TIMESTAMPTZ,
  last_payout_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5. game_revenue
```sql
CREATE TABLE game_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_wover NUMERIC DEFAULT 0,         -- awaiting distribution
  pending_usdt NUMERIC DEFAULT 0,          -- awaiting distribution
  total_wover_collected NUMERIC DEFAULT 0,
  total_usdt_collected NUMERIC DEFAULT 0,
  last_distribution_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. game_config
```sql
CREATE TABLE game_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial config values:
-- 'game_status' → { "active": false }
-- 'treasury_wallet' → { "address": "0x..." }
-- 'distribution_split' → { "prize_pool": 70, "platform": 30 }
-- 'auto_pause_threshold' → { "wover": 150 }
-- 'factory_deployer_wallet' → { "address": "0x8334966329b7f4b459633696A8CA59118253bC89" }
```

---

## RLS Policies Summary

| Table | User Access | Admin Access |
|-------|-------------|--------------|
| game_tickets | Read own only | Read all |
| game_rounds | Read all (public) | Full CRUD |
| game_bets | Read own only | Read all |
| game_pool | No access | Full CRUD |
| game_revenue | No access | Full CRUD |
| game_config | Read public keys | Full CRUD |

---

## Edge Functions

### 1. game-round-manager
- Manages round lifecycle
- Generates provably fair crash point
- Broadcasts real-time updates
- Triggers auto-pause if pool low

### 2. game-buy-ticket
- Validates payment (on-chain optional)
- Creates ticket with 15-day expiry
- Updates pending revenue

### 3. game-place-bet
- Validates ticket (not expired, not used)
- Marks ticket as used
- Creates bet entry
- Updates round stats

### 4. game-cashout
- Only during "flying" status
- Records cash-out multiplier
- Calculates winnings
- Broadcasts to other players

### 5. game-payout
- Processes all winning bets
- Deducts from prize pool
- Logs transactions

### 6. game-admin-distribute
- Admin only (wallet verification)
- WOVER: Apply split to prize pool + platform
- USDT: 100% to Factory Deployer
- Creates audit log entry

### 7. game-leaderboard
- Public endpoint
- Cached (60s refresh)
- Top 20 by total winnings

---

## UI Components

```
src/pages/Game.tsx                    -- Main game page

src/components/game/
├── RocketAnimation.tsx               -- 3D rocket (CSS/Canvas)
├── MultiplierDisplay.tsx             -- Live x1.00 → x10.00
├── TicketPurchase.tsx                -- WOVER/USDT tabs
├── MyTickets.tsx                     -- List with countdown timers
├── BettingPanel.tsx                  -- Place bet + auto cashout
├── CashoutButton.tsx                 -- Big STOP button
├── RoundTimer.tsx                    -- Phase countdown
├── CrashHistory.tsx                  -- Last 10 results
├── Leaderboard.tsx                   -- Top players
├── SpectatorOverlay.tsx              -- "Connect to play"
├── GameStats.tsx                     -- Current round info
└── ProvablyFairModal.tsx             -- Verify seeds

src/components/admin/
└── GameManagement.tsx                -- Admin controls
    ├── GameStatusToggle              -- ACTIVE/PAUSED
    ├── PrizePoolCard                 -- Balance + Refill
    ├── PendingRevenueCard            -- WOVER/USDT pending
    ├── DistributionSlider            -- 20-80% split
    └── GameStatsCard                 -- Statistics
```

---

## Admin Panel - Game Section

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎮 CRASH GAME MANAGEMENT                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Game Status: [● ACTIVE] [○ PAUSED]                              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ PRIZE POOL                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Current Balance: 1,234.56 WOVER                             │ │
│ │ Status: ● Healthy (above 150 WOVER threshold)               │ │
│ │                                                             │ │
│ │ [____] WOVER  [Refill Pool]                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ PENDING IN TREASURY                                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ WOVER PENDING: 500.00 WOVER                                 │ │
│ │                                                             │ │
│ │ Distribution Split:                                         │ │
│ │ Prize Pool [====70%====|===30%===] Platform                 │ │
│ │            (min 20%)      (max 80%)                         │ │
│ │                                                             │ │
│ │ Preview: 350 WOVER → Pool, 150 WOVER → Platform             │ │
│ │ [Distribute WOVER]                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ USDT PENDING: 120.00 USDT                                   │ │
│ │ Destination: Factory Deployer (0x8334...bc89)               │ │
│ │ [Distribute USDT]                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ STATISTICS                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Total Rounds: 1,234    │ Total Payouts: 45,678 WOVER        │ │
│ │ Active Players: 56     │ Biggest Win: 500 WOVER (x10)       │ │
│ │ Tickets Sold: 2,345    │ Average Crash: x2.34               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sound Effects

| Event | Sound |
|-------|-------|
| Round start | Rocket engine ignition |
| Flying | Increasing intensity loop |
| Cash-out | Coin/cash register |
| Crash | Explosion |
| Countdown | Beep (3, 2, 1) |
| Bet placed | Click confirmation |
| Big win (>x5) | Celebration fanfare |

---

## Security Checklist

- [ ] All crash calculations server-side only
- [ ] Provably fair with pre-commit hash
- [ ] RLS policies on all tables
- [ ] Rate limiting on all endpoints
- [ ] Admin verification via wallet signature
- [ ] Audit logging for all admin actions
- [ ] Prize pool protected from direct withdrawal
- [ ] Ticket expiry prevents manipulation
- [ ] Input validation on all user inputs

---

## Wallet Addresses

| Purpose | Address |
|---------|---------|
| Game Treasury | TBD (new wallet) |
| Prize Pool | TBD (new wallet or same as treasury) |
| Platform Treasury | Admin wallet |
| Factory Deployer | 0x8334966329b7f4b459633696A8CA59118253bC89 |

---

*Last updated: December 2024*
