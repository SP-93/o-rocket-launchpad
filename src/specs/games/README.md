# O'Rocket Games

Dokumentacija za sve igre na O'Rocket platformi.

## Aktivne Igre

### 1. Rocket Crash 🚀
- **Status**: Aktivan
- **Folder**: [rocket-crash/](./rocket-crash/)
- **Route**: `/game`
- **Contracts**:
  - CrashGame: `0xb1849345d279bE4065B1455e5538c29ea31327c8`
  - TicketNFT: `0xF60169C2515FD66b79f1855b939032659E36D9c8`

## Buduće Igre (Soon)

### 2. Dice 🎲
- **Status**: Coming Soon
- **Folder**: TBD

### 3. Wheel 🎡
- **Status**: Coming Soon
- **Folder**: TBD

---

## Folder Struktura

```
src/specs/games/
├── README.md                    (ovaj fajl)
├── rocket-crash/
│   ├── game-spec.md             (kompletna specifikacija)
│   ├── contracts.md             (adrese ugovora i ABI info)
│   └── troubleshooting.md       (poznati problemi i rešenja)
└── _template/
    └── new-game-template.md     (šablon za nove igre)
```

## Važni Linkovi

- **Block Explorer (Over Network)**:
  - https://scan.over.network/address/0xb1849345d279bE4065B1455e5538c29ea31327c8 (CrashGame)
  - https://scan.over.network/address/0xF60169C2515FD66b79f1855b939032659E36D9c8 (TicketNFT)

- **Supabase Edge Functions**:
  - `game-round-manager` - Upravljanje rundama
  - `game-buy-ticket` - Kupovina tiketa
  - `game-place-bet` - Postavljanje opklade
  - `game-cashout` - Isplata
  - `game-admin-stats` - Admin statistika

## Admin Pristup

Admin wallet adrese:
- `0x8334966329b7f4b459633696a8ca59118253bc89` (Factory wallet)
- `0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8` (Primary wallet)
