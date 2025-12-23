# Analytics Dashboard Specification

## Overview
Real-time analytics and monitoring for O'Rocket DEX on Over Protocol mainnet.

---

## Components

### A. Protocol Overview Dashboard
- Total Value Locked (TVL) - real-time
- 24h/7d/30d Volume
- Total Transactions
- Unique Users
- Active Pools Count
- Protocol fee earnings

### B. Pool Analytics
- Individual pool TVL history
- Volume charts (1H, 24H, 7D, 30D)
- Fee earnings per pool
- Liquidity provider count
- Price charts with candlesticks
- APR/APY calculations

### C. Transaction History
- Recent swaps table
- Filter by pool/token/wallet
- Transaction details modal
- Export to CSV
- Pagination

### D. User Analytics (wallet connected)
- Personal swap history
- P&L tracking
- Position performance
- Fee earnings
- Portfolio value over time

### E. Admin Monitoring
- Real-time alerts for large swaps
- Unusual activity detection
- Pool health indicators
- System status dashboard
- Whale tracking

---

## Data Sources

### On-chain
- Pool contracts (slot0, liquidity, positions)
- Swap events from router
- Mint/Burn events from pools
- Block timestamps

### Off-chain (Supabase)
- Cached aggregations for performance
- Historical snapshots
- User preferences
- Alert configurations

---

## Tech Stack
- **Charts**: recharts (already installed)
- **Data**: Supabase for persistence
- **Real-time**: Supabase subscriptions
- **State**: TanStack Query for caching

---

## Database Tables (when implementing)

```sql
-- Swap history cache
CREATE TABLE swap_history (
  id UUID PRIMARY KEY,
  tx_hash TEXT UNIQUE,
  pool_address TEXT,
  token_in TEXT,
  token_out TEXT,
  amount_in NUMERIC,
  amount_out NUMERIC,
  wallet_address TEXT,
  timestamp TIMESTAMPTZ,
  block_number BIGINT
);

-- TVL snapshots
CREATE TABLE tvl_snapshots (
  id UUID PRIMARY KEY,
  pool_address TEXT,
  tvl_usd NUMERIC,
  token0_amount NUMERIC,
  token1_amount NUMERIC,
  timestamp TIMESTAMPTZ
);

-- Volume aggregations
CREATE TABLE volume_daily (
  id UUID PRIMARY KEY,
  pool_address TEXT,
  date DATE,
  volume_usd NUMERIC,
  swap_count INTEGER,
  unique_users INTEGER
);
```

---

## UI Components (when implementing)

1. `src/components/analytics/ProtocolStats.tsx`
2. `src/components/analytics/PoolChart.tsx`
3. `src/components/analytics/TransactionTable.tsx`
4. `src/components/analytics/UserPortfolio.tsx`
5. `src/pages/Analytics.tsx`

---

## Priority Order
1. Protocol Overview (TVL, Volume, Transactions)
2. Pool Analytics with charts
3. Transaction History
4. User Analytics
5. Admin Monitoring

---

*Last updated: December 2024*
