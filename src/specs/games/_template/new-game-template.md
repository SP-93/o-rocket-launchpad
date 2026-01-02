# [Game Name] - Specification Template

## Overview
[Brief description of the game]

**Navigation**: "[GameName]" link in game navigation
**Route**: `/game/[game-name]`

---

## Smart Contracts

### Main Contract
- **Adresa**: `0x...`
- **Explorer**: https://scan.over.network/address/0x...
- **Tip**: [Contract type]

**Funkcije:**
- `function1()` - Description
- `function2()` - Description

---

## Database Schema

### game_[name]_rounds
```sql
CREATE TABLE game_[name]_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Add columns
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### game_[name]_bets
```sql
CREATE TABLE game_[name]_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Add columns
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Edge Functions

### game-[name]-round-manager
- Manages round lifecycle
- [Other responsibilities]

### game-[name]-place-bet
- Validates bet
- [Other responsibilities]

---

## UI Components

```
src/components/game/[name]/
├── [Name]Game.tsx            -- Main game component
├── [Name]BettingPanel.tsx    -- Betting UI
└── [Name]History.tsx         -- History display
```

---

## Configuration

### game_config keys
| Key | Description |
|-----|-------------|
| `[name]_active` | Game active status |

---

## Known Issues

1. [Issue description]
   - **Cause**: ...
   - **Solution**: ...

---

## Checklist for New Game

- [ ] Smart contracts deployed
- [ ] Database tables created with RLS
- [ ] Edge functions created
- [ ] UI components created
- [ ] Admin panel integration
- [ ] Testing completed
- [ ] Documentation updated
