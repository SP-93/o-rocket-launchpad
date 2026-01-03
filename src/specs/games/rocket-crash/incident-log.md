# Rocket Crash Game - Incident Log

## Purpose
This document tracks all debugging sessions, fixes, and findings related to the Rocket Crash game to prevent repeating the same investigations.

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
- Switch to async `executeWithRetry()` with fallback RPC endpoints
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

## Verification Checklist

After applying fixes, verify:

1. [ ] Admin → Ticket Cleanup → Scan → Shows connected wallet
2. [ ] Admin → Ticket Cleanup → Full Cleanup → No 403 error
3. [ ] Admin → OnChain Inspector → Fetch → Shows bytecode hash
4. [ ] Admin → OnChain Inspector → Shows RPC endpoint used
5. [ ] Admin → DEX Price → Consistent value after multiple refreshes
6. [ ] Price update → After refresh, value stays the same

---

## Known RPC Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| `https://rpc.overprotocol.com` | Primary | Main endpoint |
| `https://wallet-dolphin.rpc.over.network` | Fallback | Used when primary fails |

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
4. Consider caching RPC responses client-side for faster UI
