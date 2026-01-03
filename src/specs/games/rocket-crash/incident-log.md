# Rocket Crash Game - Incident Log

## Purpose
This document tracks all debugging sessions, fixes, and findings related to the Rocket Crash game to prevent repeating the same investigations.

---

## 2026-01-03 (Round 3): CORS Fix + WOVER-Only Tickets

### Issue: CORS Blocks Browser RPC Calls
**Symptoms:**
- On-Chain Inspector shows "502 Bad Gateway"
- Console shows "access-control-allow-origin" CORS errors
- "Contract State: Loading..." forever
- `woverPrice()` CALL_EXCEPTION

**Root Cause:**
- Browser direct calls to `https://rpc.overprotocol.com` are blocked by CORS
- RPC endpoint doesn't return `Access-Control-Allow-Origin` header

**Fix Applied:**
1. Created `rpc-proxy` edge function that forwards RPC calls
2. Added `getProxiedProvider()` function in `rpcProvider.ts`
3. Updated `OnChainInspector` to use proxy provider
4. Updated `useTicketNFT` to use proxy provider for reads
5. Updated `TicketPurchase` to use proxy provider

**Files Created:**
- `supabase/functions/rpc-proxy/index.ts`

**Files Modified:**
- `supabase/config.toml` (added rpc-proxy config)
- `src/lib/rpcProvider.ts` (added getProxiedProvider)
- `src/components/admin/OnChainInspector.tsx`
- `src/hooks/useTicketNFT.ts`
- `src/components/game/TicketPurchase.tsx`

---

### Issue: USDT Ticket Option Causing DEX Price Complexity
**Symptoms:**
- DEX price fetching added unnecessary complexity
- Multiple points of failure

**Fix Applied:**
1. Removed USDT option from TicketPurchase
2. Now only WOVER payments accepted
3. Removed `useDexPrice` hook usage
4. Simplified UI (removed Tabs component)

---

## 2026-01-03 (Round 2): FK Constraint Fix

### Issue: Ticket Cleanup 500 Error - Foreign Key Constraint
**Symptoms:**
- "Full Cleanup" fails with 500 internal server error
- Edge function logs show FK constraint violation
- Cannot delete ghost tickets that have bets

**Root Cause:**
- Edge function tried to delete `game_tickets` rows that are still referenced by `game_bets.ticket_id`
- Foreign key constraint prevents deletion

**Fix Applied:**
1. Before deleting, query `game_bets` to find which ticket IDs have bets
2. Exclude those tickets from deletion
3. Report count of skipped tickets in response
4. Improved logging and error handling

**Files Modified:**
- `supabase/functions/game-admin-cleanup/index.ts`

---

## 2026-01-03: Admin Panel Fixes

### Issues Identified

#### A) Ticket Cleanup 403 Forbidden
**Symptoms:**
- POST to `/functions/v1/game-admin-cleanup` returning 403
- Error visible in browser network tab

**Root Cause:**
- `TicketCleanupPanel` was using `window.ethereum?.selectedAddress` which is unreliable
- The address was often empty or not matching the connected wallet

**Fix Applied:**
- Import and use `useWallet` hook to get the connected wallet address
- Add proper error handling for 403 responses
- Display connected wallet address in UI for debugging

**Files Modified:**
- `src/components/admin/TicketCleanupPanel.tsx`

---

#### B) On-Chain Inspector CALL_EXCEPTION
**Symptoms:**
- `woverPrice()` call reverting with "execution reverted"
- Inconsistent behavior (sometimes works, sometimes fails)

**Root Cause:**
- Using `getProviderSync()` which doesn't have fallback logic
- No bytecode verification to confirm correct contract
- Poor error details when RPC fails

**Fix Applied:**
- Switch to RPC proxy edge function to bypass CORS
- Add bytecode length and hash display for contract verification
- Add detailed error messages including RPC endpoint info
- Add individual try/catch for each contract call

**Files Modified:**
- `src/components/admin/OnChainInspector.tsx`

---

#### C) DEX Price Incorrect Scaling (0.008 bug)
**Symptoms:**
- DEX price showing wrong value after refresh
- Price calculation incorrect when WOVER is token1

**Root Cause:**
- Decimal adjustment formula was wrong for token1 → token0 direction
- Using wrong `decimalDiff` calculation in else branch

**Fix Applied:**
- Correctly calculate `priceToken0InToken1` and `priceToken1InToken0` separately
- Use proper decimal adjustment: `10^(targetDecimals - sourceDecimals)`
- Add debug metadata showing both directional prices
- Switch to centralized RPC provider with fallback

**Files Modified:**
- `src/hooks/useDexPrice.ts`

---

## 2026-01-03 (Round 4): Documentation + Chat Fixes

### Issue: USDT References Still in Documentation
**Fix Applied:**
1. Updated `WhitepaperSection.tsx` - removed all USDT references for Crash Game
2. Updated `GameTutorial.tsx` - changed "WOVER or USDT" to "WOVER"
3. Updated `Games.tsx` - changed description to "Buy tickets with WOVER"
4. Updated `TicketStatsPanel.tsx` - removed USDT stats

### Issue: Chat Collapsed by Default on PC
**Fix Applied:**
1. Changed `PlayerChat.tsx` initial state to open on desktop (width >= 768px)

---

## Verification Checklist

After applying fixes, verify:

1. [ ] Hard refresh (`Ctrl+Shift+R`) to clear cache
2. [ ] Admin → Ticket Cleanup → Scan → Shows connected wallet
3. [ ] Admin → Ticket Cleanup → Full Cleanup → No 403/500 error
4. [ ] Admin → OnChain Inspector → Fetch → Shows bytecode hash, no CORS error
5. [ ] Admin → OnChain Inspector → Shows "Edge Proxy" as RPC
6. [ ] Game → Ticket Purchase → Only WOVER option (no USDT tabs)
7. [ ] Game → Ticket Purchase → Balance shows correctly
8. [ ] Chat → Set Nickname → Uppercase letters work
9. [ ] Chat → Open by default on desktop
10. [ ] Docs → Whitepaper → No USDT mentions for Crash Game tickets

---

## Known RPC Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| `https://rpc.overprotocol.com` | Primary | Main endpoint |
| `https://wallet-dolphin.rpc.over.network` | Fallback | Used when primary fails |
| Edge Proxy (`/functions/v1/rpc-proxy`) | CORS-safe | For browser reads |

---

## Admin Wallet Addresses

These are hardcoded in `is_wallet_admin` DB function:
- `0x8334966329b7f4b459633696a8ca59118253bc89` (Factory wallet)
- `0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8` (Primary wallet)

---

## Future Improvements

1. Add "Contract Bytecode Match" verification against known artifact
2. Add transaction proof display after price updates
3. Add DEX vs Contract price deviation checker
4. Consider caching RPC responses in edge function
