# Incident Log - Rocket Crash Game

Track all significant changes, tests, and results to avoid loops.

---

## 2026-01-03 - Initial Setup

### Changes Made:
1. **Diagnostics Panel** - Added to /admin and /game (admin-only)
   - Shows BUILD_TIME, SW status, RPC status, realtime status, wallet info
   
2. **Stable RPC Reads** - Admin panel now uses read-only RPC for contract state (no MetaMask dependency)

3. **Chat Nicknames** - Backend table + edge function for unique nicknames with wallet signature

4. **Ticket Cleanup Tools** - Admin panel for cleaning expired/test tickets

5. **Chat Realtime Reliability** - Added fallback polling + reconnect button

### Test Plan:
- [ ] Test A: Admin contract read without MetaMask connected
- [ ] Test B: Sync to DEX → verify before/after values
- [ ] Test C: Chat realtime on phone (no refresh needed)
- [ ] Test D: Nickname set/change/duplicate prevention

---

## Template for Future Entries

### YYYY-MM-DD - [Issue Title]

**Symptoms:**
- 

**Root Cause:**
- 

**Changes Made:**
- File: 
- What: 

**Test Steps:**
1. 
2. 

**Result:** ✅ OK / ❌ FAIL

**Screenshots/TX Hash:**
- 
