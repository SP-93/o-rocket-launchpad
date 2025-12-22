# ROCKET Token Specification

## Basic Info
| Property | Value |
|----------|-------|
| Name | Rocket |
| Symbol | ROCKET |
| Decimals | 18 |
| Standard | ERC-20 + Burn |
| Network | Over Protocol (Mainnet) |

## Admin Wallet
```
0x8b847bd369d2fdac7944e68277d6ba04aaeb38b4
```

## Supply & Tokenomics

### Total Supply
- **Initial Mint**: 1,000,000,000 ROCKET (1 Billion)
- **Final Supply**: 940,000,000 ROCKET (after 10% farm burn)

### Distribution
| Allocation | Percentage | Amount | Purpose |
|------------|------------|--------|---------|
| Presale | 25% | 250,000,000 | Early investors |
| Initial Liquidity | 15% | 150,000,000 | DEX liquidity pools |
| Farm Rewards | 60% | 600,000,000 | Liquidity mining (540M after burn) |

### Burn Mechanism
- 10% of Farm Rewards burned over time
- Burn amount: 60,000,000 ROCKET
- Reduces final supply to 940M

## Presale Configuration (TBD)
| Parameter | Value |
|-----------|-------|
| Price | TBD |
| Hard Cap | TBD |
| Min per Wallet | TBD |
| Max per Wallet | TBD |
| Duration | TBD |
| Vesting | TBD |
| Accepted Tokens | OVER, WOVER, USDC, USDT |

## Contract Features
- [x] Standard ERC-20 functions
- [x] Burn function (public)
- [ ] Pause function (optional)
- [ ] Logo metadata (awaiting image)

## Deployment Status
- [ ] Contract written
- [ ] Contract tested
- [ ] Contract deployed
- [ ] Verified on explorer
- [ ] Logo uploaded

---
*Last updated: December 2024*
