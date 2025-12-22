# ROCKET.FUN Launchpad Specification

## Overview
ROCKET.FUN is a token launchpad platform built on Over Protocol, using an exponential bonding curve for fair token distribution.

## Bonding Curve Model
- **Type**: Exponential curve
- **Mechanism**: Price increases as more tokens are bought
- **Benefit**: Early supporters get better prices, discourages dumps

## Fee Structure
| Fee Type | Percentage | Destination |
|----------|------------|-------------|
| Creator Share | 75% | Token creator wallet |
| Platform Fee | 25% | Threshold accumulation |

### Platform Fee Usage
When platform fees reach threshold:
- **Action**: Automatic ROCKET buyback
- **Purpose**: Creates constant buy pressure on ROCKET token

## Minting Options

### Over Protocol (Primary)
| Token | Status |
|-------|--------|
| OVER (native) | ✅ Supported |
| WOVER | ✅ Supported |
| USDC | ✅ Supported |
| USDT | ✅ Supported |

### Base Chain (Phase 2)
| Token | Status |
|-------|--------|
| ETH | 🔄 Planned |
| USDC | 🔄 Planned |
| USDT | 🔄 Planned |

## Multi-Chain Support
- Network switcher in UI
- Same contract architecture on both chains
- Unified dashboard for creators

## Launchpad Features
- [ ] Token creation wizard
- [ ] Bonding curve visualization
- [ ] Real-time price chart
- [ ] Buy/Sell interface
- [ ] Creator dashboard
- [ ] Fee distribution automation
- [ ] ROCKET buyback mechanism

## Creator Flow
1. Connect wallet
2. Set token name, symbol, description
3. Upload logo
4. Configure initial parameters
5. Deploy token with bonding curve
6. Share launch link
7. Monitor performance in dashboard

## User Flow
1. Connect wallet
2. Browse active launches
3. Select token to buy
4. Choose payment token (OVER/WOVER/Stables)
5. Enter amount
6. Confirm transaction
7. Receive tokens instantly

---
*Last updated: December 2024*
