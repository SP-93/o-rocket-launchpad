# CrashGame Smart Contract - Remix Compilation Guide

## Prerequisites
- Web browser
- Access to Remix IDE: https://remix.ethereum.org

## Step 1: Open Remix IDE
Go to https://remix.ethereum.org in your browser.

## Step 2: Create New File
1. In the File Explorer (left panel), click the "Create New File" icon
2. Name it `CrashGame.sol`
3. Copy the entire contents of `src/contracts/CrashGame.sol` into this file

## Step 3: Add OpenZeppelin Dependencies
Remix can automatically import OpenZeppelin contracts. The imports in CrashGame.sol should work:
```solidity
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
```

If there are issues, you can use the direct GitHub imports:
```solidity
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/access/Ownable.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/utils/ReentrancyGuard.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/utils/Pausable.sol";
```

## Step 4: Configure Compiler
1. Click the "Solidity Compiler" tab (second icon on left)
2. Set compiler version to `0.8.20`
3. Enable optimization (recommended: 200 runs)
4. Click "Compile CrashGame.sol"

## Step 5: Get Bytecode
1. After successful compilation, click "Compilation Details" button
2. In the popup, scroll down to find "BYTECODE"
3. Click the copy icon next to "object" field
4. This is your contract bytecode (starts with `0x608060...`)

## Step 6: Update Project
1. Open `src/contracts/artifacts/crashGame.ts`
2. Replace the `CRASH_GAME_BYTECODE` value with the copied bytecode:
```typescript
export const CRASH_GAME_BYTECODE = "0x608060405234801561001057600080fd5b50..."; // Your full bytecode here
```

## Step 7: Verify ABI
The ABI in `crashGame.ts` should already match the contract. If you made any changes to the Solidity code, also copy the ABI from Remix:
1. In Compilation Details, find "ABI" section
2. Copy the JSON array
3. Update `CRASH_GAME_ABI` in `crashGame.ts`

## Important Notes

### Security Considerations
- Always verify the bytecode matches the source code
- Test on Testnet (Chain ID: 5765) before Mainnet (Chain ID: 541)
- Keep the deployer wallet secure - it becomes the contract owner

### Constructor Parameters
When deploying, you'll need:
1. `_woverToken`: WOVER token contract address
2. `_usdtToken`: USDT token contract address  
3. `_treasuryWallet`: Treasury wallet for platform fees
4. `_factoryDeployerWallet`: Factory deployer wallet for USDT revenue

### Post-Deployment Checklist
- [ ] Verify contract on block explorer
- [ ] Test `refillPrizePool` with small amounts
- [ ] Test full round cycle: startRound → placeBet → startFlying → crashRound
- [ ] Verify provably fair mechanism works
- [ ] Test revenue distribution

## Provably Fair Verification

The contract implements provably fair gaming:

1. **Pre-Round**: Admin calls `startRound(seedHash)` with `keccak256(serverSeed)`
2. **During Betting**: Players see the `seedHash` but not the actual `serverSeed`
3. **After Crash**: Admin calls `crashRound(serverSeed, crashPoint)`
4. **Verification**: Contract verifies `keccak256(serverSeed) == seedHash`

This ensures the crash point was determined BEFORE any bets were placed.

## Troubleshooting

### "Invalid seed" error on crashRound
- Ensure the serverSeed passed to crashRound matches what was hashed for startRound
- The hook uses `formatBytes32String()` for consistent encoding

### Compilation errors
- Check Solidity version is exactly 0.8.20
- Ensure OpenZeppelin imports resolve correctly
- Try using direct GitHub import URLs if npm imports fail

### Deployment fails
- Ensure you have enough native tokens for gas
- Check constructor parameters are valid addresses
- Verify you're connected to the correct network
