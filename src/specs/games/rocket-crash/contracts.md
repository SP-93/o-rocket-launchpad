# Rocket Crash - Smart Contracts

## Deployovani Ugovori (Over Protocol Mainnet)

### CrashGame Contract
- **Adresa**: `0xb1849345d279bE4065B1455e5538c29ea31327c8`
- **Explorer**: https://scan.over.network/address/0xb1849345d279bE4065B1455e5538c29ea31327c8
- **Tip**: Prize Pool & Game Logic

**Funkcije:**
- `claimWinnings(address player, uint256 amount, uint256 nonce, bytes signature)` - Isplata dobitaka
- `deposit()` - Dopuna prize pool-a
- `owner()` - Vlasnik ugovora

### TicketNFT Contract
- **Adresa**: `0xF60169C2515FD66b79f1855b939032659E36D9c8`
- **Explorer**: https://scan.over.network/address/0xF60169C2515FD66b79f1855b939032659E36D9c8
- **Token Explorer**: https://scan.over.network/token/0xF60169C2515FD66b79f1855b939032659E36D9c8
- **Tip**: ERC-721 NFT Tiketi

**Funkcije:**
- `buyWithWover(uint8 ticketValue)` - Kupovina tiketom sa WOVER
- `buyWithUsdt(uint8 ticketValue, uint256 usdtAmount)` - Kupovina sa USDT
- `woverPrice()` - Cena WOVER tokena
- `usdtPrice()` - Cena USDT tokena
- `totalSupply()` - Ukupan broj mintovanih NFT-ova
- `tokenIdCounter()` - Trenutni ID brojač

---

## Token Adrese

| Token | Adresa |
|-------|--------|
| WOVER | `0x33D434BF89D2E1e3bCb2bf10aE9b39c0C7b31Be8` |
| USDT | `0x56b9d7e36bC57F1d44d79c001AAF77FFf2c1d0Dc` |
| USDC | `0x71031c1Ad06C2f9d7A9C7FD020E858e8A2DedC51` |

---

## Supabase Config Keys

Adrese su sačuvane u `game_config` tabeli:

| Key | Vrednost |
|-----|----------|
| `crash_game_v2_address` | `0xb1849345d279bE4065B1455e5538c29ea31327c8` |
| `ticket_nft_address` | `0xF60169C2515FD66b79f1855b939032659E36D9c8` |

---

## Hardcoded u Frontend

Adrese su hardcode-ovane u `src/contracts/storage.ts`:

```typescript
crashGame: '0xb1849345d279bE4065B1455e5538c29ea31327c8',
ticketNFT: '0xF60169C2515FD66b79f1855b939032659E36D9c8',
```

---

## Deployment History

| Datum | Ugovor | Akcija | TX Hash |
|-------|--------|--------|---------|
| 2025-12 | CrashGame v2 | Deploy | - |
| 2025-12 | TicketNFT | Deploy | - |

---

## ABI Reference

ABI fajlovi se nalaze u:
- `src/contracts/artifacts/crashGame.ts`
- `src/contracts/artifacts/ticketNFT.ts`
