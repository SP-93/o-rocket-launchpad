# Rocket Crash - Troubleshooting Guide

## Poznati Problemi i Rešenja

### 1. Admin Panel ne prikazuje podatke (Bets, Audit Log)

**Problem**: `BetsOverviewPanel` i `GameAuditLogPanel` prikazuju "0" ili prazno

**Uzrok**: RLS policy na `game_bets` i `game_audit_log` tabelama zahteva autentifikovanog korisnika

**Rešenje**: Koristi `game-admin-stats` edge function umesto direktnog Supabase query-a
```typescript
const { data } = await supabase.functions.invoke('game-admin-stats', {
  body: { wallet_address: walletAddress }
});
```

---

### 2. NFT Tiketi se ne mintuju (koristi se legacy transfer)

**Problem**: Tiketi se kupuju ali NFT se ne mintuje, `useNFTContract` je `false`

**Uzrok**: `getDeployedContracts().ticketNFT` vraća `null`

**Rešenje**: Proveriti da su adrese hardcode-ovane u `storage.ts`:
```typescript
ticketNFT: '0xF60169C2515FD66b79f1855b939032659E36D9c8'
```

---

### 3. Cashout kašnjenje (2+ sekunde)

**Problem**: Korisnik klikne STOP ali prođe 2 sekunde do registracije

**Uzrok**: Network latency + server processing time

**Rešenje**:
1. `LAG_COMPENSATION_MS` u `useGameRound.ts` je povećan na 500ms
2. Optimistički UI u `QuickCashoutOverlay.tsx` prikazuje "Cashing out..." odmah

---

### 4. Auto-Stop dugme ne radi posle auto-cashout-a

**Problem**: Posle auto-cashout-a u prethodnoj rundi, STOP dugme se ne prikazuje u novoj rundi

**Uzrok**: `myBet` state se ne resetuje pravilno između rundi

**Rešenje**: Reset `myBet` na `null` kad se promeni `roundId`:
```typescript
useEffect(() => {
  setMyBet(null);
}, [roundId]);
```

---

### 5. Contract State: Loading... u Admin panelu

**Problem**: Admin panel prikazuje "Contract State: Loading..." neograničeno

**Uzrok**: `fetchContractState()` u `useTicketNFT.ts` ne dobija response

**Debug koraci**:
1. Proveriti RPC endpoint: `https://rpc.overprotocol.com`
2. Proveriti contract adresu
3. Dodati timeout u fetch

---

### 6. USDT cena ne odgovara DEX ceni

**Problem**: USDT tiket cena koristi CoinGecko (CEX) umesto DEX cene

**Rešenje**: Kreiran `useDexPrice` hook koji koristi pool price sa DEX-a

---

### 7. Duplikati Tiketa (KRITIČNO - POPRAVLJENO)

**Problem**: Korisnik plati za 1 tiket ali dobije 7 tiketa sa istim `tx_hash`

**Uzrok**: 
1. Race condition u recovery mehanizmu (višestruki paralelni pozivi)
2. Nedostajao UNIQUE constraint na `tx_hash` koloni
3. `game-buy-ticket` edge function nije bila atomska

**Rešenje** (implementirano 2026-01-02):
1. **Database**: Dodat UNIQUE constraint na `game_tickets.tx_hash`
2. **Frontend**: Dodat `isRecoveryInFlight` ref za sprečavanje višestrukih recovery pokušaja
3. **Frontend**: Povećan `RECOVERY_CHECK_INTERVAL` sa 2000ms na 5000ms
4. **Edge Function**: Pojednostavljena idempotent logika - vraća postojeći tiket bez kreiranja duplikata

```sql
-- Provera da li UNIQUE constraint postoji
SELECT conname FROM pg_constraint WHERE conname = 'game_tickets_tx_hash_unique';
```

---

### 8. NFT Mint Failed: woverPrice is 0

**Problem**: NFT mint failuje sa greškom "woverPrice is 0 - contract not configured"

**Uzrok**: Admin nije postavio `woverPrice` na TicketNFT ugovoru

**Rešenje**:
1. Idi na Admin Panel → TicketNFT Contract
2. Klikni "Sync to CEX" ili ručno postavi cenu
3. Proveri da je `woverPrice > 0` u Contract State

```javascript
// Debug u konzoli
const nft = new ethers.Contract('0xF60169C2515FD66b79f1855b939032659E36D9c8', 
  ['function woverPrice() view returns (uint256)'], 
  new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com'));
const price = await nft.woverPrice();
console.log('woverPrice:', ethers.utils.formatEther(price));
```

---

## Debug Komande

### Provera Contract Adresa u konzoli
```javascript
import { getDeployedContracts } from '@/contracts/storage';
console.log(getDeployedContracts());
```

### Provera Supabase Config
```sql
SELECT * FROM game_config WHERE config_key IN ('crash_game_v2_address', 'ticket_nft_address');
```

### Provera NFT Balance
```javascript
// U browser konzoli
const provider = new ethers.providers.JsonRpcProvider('https://rpc.overprotocol.com');
const nft = new ethers.Contract('0xF60169C2515FD66b79f1855b939032659E36D9c8', ['function totalSupply() view returns (uint256)'], provider);
await nft.totalSupply();
```

### Provera Duplikata u Bazi
```sql
SELECT tx_hash, COUNT(*) as cnt 
FROM game_tickets 
WHERE tx_hash IS NOT NULL 
GROUP BY tx_hash 
HAVING COUNT(*) > 1;
```

---

## Kontakt za Podršku

- Admin wallet: `0x8334966329b7f4b459633696a8ca59118253bc89`
- Primary wallet: `0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8`
