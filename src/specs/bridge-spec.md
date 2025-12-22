# OverBridge Specification

## Overview

Official bridge for transferring OVER tokens between Over Protocol and Base Network.

**URL**: https://bridge.over.network/

## Bridge Details

| Property | Value |
|----------|-------|
| Name | OverBridge |
| URL | https://bridge.over.network/ |
| Supported Networks | Over Protocol ↔ Base Network |
| Direction | Bidirectional |
| Bridge Fee | 100 OVER per transfer |
| Status | ✅ Active |

## Supported Tokens

| Token | Over Protocol | Base Network |
|-------|---------------|--------------|
| OVER | Native | Bridged (Wrapped) |

## Network Information

| Network | Chain ID | Type | Explorer |
|---------|----------|------|----------|
| Over Protocol | 54176 | Native | https://scan.over.network |
| Base Network | 8453 | EVM L2 | https://basescan.org |

## Key Features

- **EVM Compatible**: Same wallet address works on both networks
- **MetaMask Support**: Standard EVM wallet integration
- **Official Bridge**: Operated by Over Protocol team
- **Fixed Fee**: 100 OVER per bridge transaction

## Technical Notes

### Bridged Token on Base
- Bridged OVER on Base has a **different contract address** than native OVER
- Contract address on Base: TBD (needs verification)

### For DEX Integration
- To create pools with bridged OVER on Base, new Factory deployment required
- Would need separate contract infrastructure for Base Network (Chain ID: 8453)

## Integration with O'Rocket DEX

### Phase 1: Current Implementation
- [x] Bridge link added to Info page (prominent banner)
- [x] Documentation created

### Phase 2: Future Consideration
- [ ] Multi-chain support in DEX (Phase 5 of roadmap)
- [ ] Base Network contract deployment
- [ ] Bridged OVER/USDC pool on Base

## User Flow

1. User connects wallet (MetaMask)
2. Selects source network (Over Protocol or Base)
3. Enters amount to bridge
4. Pays 100 OVER fee
5. Confirms transaction
6. Receives tokens on destination network

## Related Resources

- [Over Protocol Docs](https://docs.over.network/)
- [Base Network](https://base.org/)
- [Over Protocol Explorer](https://scan.over.network)
- [Base Explorer](https://basescan.org)

---

*Last updated: December 2024*
*Document version: 1.0*
