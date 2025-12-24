// CrashGame Contract ABI and Bytecode
// Compiled with Solidity 0.8.20
// EVM Version: PARIS (NO PUSH0 opcode for Over Protocol compatibility)
// Provably Fair Crash Game with SafeERC20
// Updated: Added claimWinnings() for on-chain player claims

export const CRASH_GAME_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_woverToken", "type": "address" },
      { "internalType": "address", "name": "_usdtToken", "type": "address" },
      { "internalType": "address", "name": "_treasuryWallet", "type": "address" },
      { "internalType": "address", "name": "_factoryDeployerWallet", "type": "address" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "OwnableInvalidOwner", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "OwnableUnauthorizedAccount", "type": "error" },
  { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }], "name": "SafeERC20FailedOperation", "type": "error" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "roundId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "player", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "bool", "name": "isWover", "type": "bool" },
      { "indexed": false, "internalType": "uint256", "name": "autoCashoutAt", "type": "uint256" }
    ],
    "name": "BetPlaced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "string", "name": "param", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "ConfigUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "account", "type": "address" }], "name": "Paused", "type": "event" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "roundId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "player", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "PayoutProcessed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "roundId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "player", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "multiplier", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "payout", "type": "uint256" }
    ],
    "name": "PlayerCashedOut",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "token", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "PrizePoolRefilled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "bool", "name": "isWover", "type": "bool" },
      { "indexed": false, "internalType": "uint256", "name": "prizePoolAmount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "platformAmount", "type": "uint256" }
    ],
    "name": "RevenueDistributed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "roundId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "crashPoint", "type": "uint256" },
      { "indexed": false, "internalType": "bytes32", "name": "serverSeed", "type": "bytes32" }
    ],
    "name": "RoundCrashed",
    "type": "event"
  },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "roundId", "type": "uint256" }], "name": "RoundFlying", "type": "event" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "roundId", "type": "uint256" },
      { "indexed": false, "internalType": "bytes32", "name": "seedHash", "type": "bytes32" },
      { "indexed": false, "internalType": "uint256", "name": "startTime", "type": "uint256" }
    ],
    "name": "RoundStarted",
    "type": "event"
  },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "address", "name": "account", "type": "address" }], "name": "Unpaused", "type": "event" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "roundId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "player", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "WinningsClaimed",
    "type": "event"
  },
  { "inputs": [], "name": "MAX_POOL_PERCENTAGE", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "MIN_POOL_PERCENTAGE", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "bettingDuration", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  {
    "inputs": [{ "internalType": "uint256", "name": "_roundId", "type": "uint256" }, { "internalType": "address", "name": "_player", "type": "address" }],
    "name": "canClaimWinnings",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  { "inputs": [{ "internalType": "uint256", "name": "_currentMultiplier", "type": "uint256" }], "name": "cashout", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  {
    "inputs": [{ "internalType": "uint256", "name": "_roundId", "type": "uint256" }],
    "name": "claimWinnings",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  { "inputs": [{ "internalType": "bytes32", "name": "_serverSeed", "type": "bytes32" }, { "internalType": "uint256", "name": "_crashPoint", "type": "uint256" }], "name": "crashRound", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "currentRoundId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "distributeUsdtRevenue", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "distributeWoverRevenue", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "factoryDeployerWallet", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  {
    "inputs": [],
    "name": "getCurrentRound",
    "outputs": [{
      "components": [
        { "internalType": "uint256", "name": "roundNumber", "type": "uint256" },
        { "internalType": "bytes32", "name": "seedHash", "type": "bytes32" },
        { "internalType": "bytes32", "name": "serverSeed", "type": "bytes32" },
        { "internalType": "uint256", "name": "crashPoint", "type": "uint256" },
        { "internalType": "uint256", "name": "totalWagered", "type": "uint256" },
        { "internalType": "uint256", "name": "totalPayout", "type": "uint256" },
        { "internalType": "uint256", "name": "startTime", "type": "uint256" },
        { "internalType": "uint256", "name": "endTime", "type": "uint256" },
        { "internalType": "enum CrashGame.RoundStatus", "name": "status", "type": "uint8" }
      ],
      "internalType": "struct CrashGame.Round",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  { "inputs": [], "name": "getPendingRevenue", "outputs": [{ "internalType": "uint256", "name": "wover", "type": "uint256" }, { "internalType": "uint256", "name": "usdt", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  {
    "inputs": [{ "internalType": "uint256", "name": "_roundId", "type": "uint256" }, { "internalType": "address", "name": "_player", "type": "address" }],
    "name": "getPendingClaimAmount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_roundId", "type": "uint256" }, { "internalType": "address", "name": "_player", "type": "address" }],
    "name": "getPlayerBet",
    "outputs": [{
      "components": [
        { "internalType": "address", "name": "player", "type": "address" },
        { "internalType": "uint256", "name": "amount", "type": "uint256" },
        { "internalType": "uint256", "name": "autoCashoutAt", "type": "uint256" },
        { "internalType": "uint256", "name": "cashedOutAt", "type": "uint256" },
        { "internalType": "bool", "name": "isWover", "type": "bool" },
        { "internalType": "bool", "name": "claimed", "type": "bool" }
      ],
      "internalType": "struct CrashGame.Bet",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  { "inputs": [], "name": "getPrizePoolBalance", "outputs": [{ "internalType": "uint256", "name": "wover", "type": "uint256" }, { "internalType": "uint256", "name": "usdt", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  {
    "inputs": [{ "internalType": "uint256", "name": "_roundId", "type": "uint256" }],
    "name": "getRoundBets",
    "outputs": [{
      "components": [
        { "internalType": "address", "name": "player", "type": "address" },
        { "internalType": "uint256", "name": "amount", "type": "uint256" },
        { "internalType": "uint256", "name": "autoCashoutAt", "type": "uint256" },
        { "internalType": "uint256", "name": "cashedOutAt", "type": "uint256" },
        { "internalType": "bool", "name": "isWover", "type": "bool" },
        { "internalType": "bool", "name": "claimed", "type": "bool" }
      ],
      "internalType": "struct CrashGame.Bet[]",
      "name": "",
      "type": "tuple[]"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }], "name": "hasPlayerBet", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "instantCrashProbability", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "maxBet", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "maxMultiplier", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "minBet", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "pause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "paused", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "pendingRevenueUsdt", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "pendingRevenueWover", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }, { "internalType": "bool", "name": "_isWover", "type": "bool" }, { "internalType": "uint256", "name": "_autoCashoutAt", "type": "uint256" }], "name": "placeBet", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }], "name": "playerBetIndex", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "prizePoolPercentage", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "prizePoolUsdt", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "prizePoolWover", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_amount", "type": "uint256" }, { "internalType": "bool", "name": "_isWover", "type": "bool" }], "name": "refillPrizePool", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "roundBets",
    "outputs": [
      { "internalType": "address", "name": "player", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "autoCashoutAt", "type": "uint256" },
      { "internalType": "uint256", "name": "cashedOutAt", "type": "uint256" },
      { "internalType": "bool", "name": "isWover", "type": "bool" },
      { "internalType": "bool", "name": "claimed", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "rounds",
    "outputs": [
      { "internalType": "uint256", "name": "roundNumber", "type": "uint256" },
      { "internalType": "bytes32", "name": "seedHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "serverSeed", "type": "bytes32" },
      { "internalType": "uint256", "name": "crashPoint", "type": "uint256" },
      { "internalType": "uint256", "name": "totalWagered", "type": "uint256" },
      { "internalType": "uint256", "name": "totalPayout", "type": "uint256" },
      { "internalType": "uint256", "name": "startTime", "type": "uint256" },
      { "internalType": "uint256", "name": "endTime", "type": "uint256" },
      { "internalType": "enum CrashGame.RoundStatus", "name": "status", "type": "uint8" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  { "inputs": [{ "internalType": "uint256", "name": "_duration", "type": "uint256" }], "name": "setBettingDuration", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_maxBet", "type": "uint256" }], "name": "setMaxBet", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_maxMultiplier", "type": "uint256" }], "name": "setMaxMultiplier", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_minBet", "type": "uint256" }], "name": "setMinBet", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_percentage", "type": "uint256" }], "name": "setPrizePoolPercentage", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "_wallet", "type": "address" }], "name": "setTreasuryWallet", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "startFlying", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "_seedHash", "type": "bytes32" }], "name": "startRound", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "treasuryWallet", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "unpause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "usdtToken", "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_roundId", "type": "uint256" }, { "internalType": "bytes32", "name": "_serverSeed", "type": "bytes32" }], "name": "verifyRound", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "woverToken", "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }
] as const;

// Contract bytecode - compiled from CrashGame.sol with Solidity 0.8.20
// EVM Version: PARIS (NO PUSH0 opcode for Over Protocol compatibility)
// Uses SafeERC20 for WOVER token compatibility
// Source: Remix IDE with EVM Version explicitly set to "paris"
// IMPORTANT: This bytecode needs to be recompiled in Remix with the updated contract
// Placeholder - compile in Remix IDE and replace with actual bytecode
export const CRASH_GAME_BYTECODE = "COMPILE_IN_REMIX_WITH_SOLIDITY_0.8.20_AND_EVM_PARIS";

// Network addresses for deployed CrashGame contracts
export const CRASH_GAME_ADDRESSES: Record<number, string | null> = {
  // Over Protocol Mainnet
  54176: null,
  // Over Protocol Testnet (Dolphin)
  541764: null,
};
