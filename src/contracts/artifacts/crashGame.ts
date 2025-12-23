// CrashGame Contract ABI and Bytecode
// Compiled with Solidity 0.8.20

export const CRASH_GAME_ABI = [
  // Constructor
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
  
  // Events
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
      { "indexed": true, "internalType": "uint256", "name": "roundId", "type": "uint256" }
    ],
    "name": "RoundFlying",
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
      { "indexed": true, "internalType": "uint256", "name": "roundId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "crashPoint", "type": "uint256" },
      { "indexed": false, "internalType": "bytes32", "name": "serverSeed", "type": "bytes32" }
    ],
    "name": "RoundCrashed",
    "type": "event"
  },
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
      { "indexed": false, "internalType": "string", "name": "param", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "ConfigUpdated",
    "type": "event"
  },
  
  // Game Flow Functions
  {
    "inputs": [{ "internalType": "bytes32", "name": "_seedHash", "type": "bytes32" }],
    "name": "startRound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_amount", "type": "uint256" },
      { "internalType": "bool", "name": "_isWover", "type": "bool" },
      { "internalType": "uint256", "name": "_autoCashoutAt", "type": "uint256" }
    ],
    "name": "placeBet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "startFlying",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_currentMultiplier", "type": "uint256" }],
    "name": "cashout",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "_serverSeed", "type": "bytes32" },
      { "internalType": "uint256", "name": "_crashPoint", "type": "uint256" }
    ],
    "name": "crashRound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  
  // Revenue & Pool Management
  {
    "inputs": [
      { "internalType": "uint256", "name": "_amount", "type": "uint256" },
      { "internalType": "bool", "name": "_isWover", "type": "bool" }
    ],
    "name": "refillPrizePool",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "distributeWoverRevenue",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "distributeUsdtRevenue",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  
  // Admin Functions
  {
    "inputs": [{ "internalType": "uint256", "name": "_percentage", "type": "uint256" }],
    "name": "setPrizePoolPercentage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_minBet", "type": "uint256" }],
    "name": "setMinBet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_maxBet", "type": "uint256" }],
    "name": "setMaxBet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_maxMultiplier", "type": "uint256" }],
    "name": "setMaxMultiplier",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_duration", "type": "uint256" }],
    "name": "setBettingDuration",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_wallet", "type": "address" }],
    "name": "setTreasuryWallet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  
  // View Functions
  {
    "inputs": [],
    "name": "getCurrentRound",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "roundNumber", "type": "uint256" },
          { "internalType": "bytes32", "name": "seedHash", "type": "bytes32" },
          { "internalType": "bytes32", "name": "serverSeed", "type": "bytes32" },
          { "internalType": "uint256", "name": "crashPoint", "type": "uint256" },
          { "internalType": "uint256", "name": "totalWagered", "type": "uint256" },
          { "internalType": "uint256", "name": "totalPayout", "type": "uint256" },
          { "internalType": "uint256", "name": "startTime", "type": "uint256" },
          { "internalType": "uint256", "name": "endTime", "type": "uint256" },
          { "internalType": "uint8", "name": "status", "type": "uint8" }
        ],
        "internalType": "struct CrashGame.Round",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_roundId", "type": "uint256" }],
    "name": "getRoundBets",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "player", "type": "address" },
          { "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "internalType": "uint256", "name": "autoCashoutAt", "type": "uint256" },
          { "internalType": "uint256", "name": "cashedOutAt", "type": "uint256" },
          { "internalType": "bool", "name": "isWover", "type": "bool" }
        ],
        "internalType": "struct CrashGame.Bet[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_roundId", "type": "uint256" },
      { "internalType": "address", "name": "_player", "type": "address" }
    ],
    "name": "getPlayerBet",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "player", "type": "address" },
          { "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "internalType": "uint256", "name": "autoCashoutAt", "type": "uint256" },
          { "internalType": "uint256", "name": "cashedOutAt", "type": "uint256" },
          { "internalType": "bool", "name": "isWover", "type": "bool" }
        ],
        "internalType": "struct CrashGame.Bet",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPrizePoolBalance",
    "outputs": [
      { "internalType": "uint256", "name": "wover", "type": "uint256" },
      { "internalType": "uint256", "name": "usdt", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPendingRevenue",
    "outputs": [
      { "internalType": "uint256", "name": "wover", "type": "uint256" },
      { "internalType": "uint256", "name": "usdt", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_roundId", "type": "uint256" },
      { "internalType": "bytes32", "name": "_serverSeed", "type": "bytes32" }
    ],
    "name": "verifyRound",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  
  // State Variables (public getters)
  {
    "inputs": [],
    "name": "currentRoundId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "minBet",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "maxBet",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "maxMultiplier",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "prizePoolPercentage",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "bettingDuration",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "prizePoolWover",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "prizePoolUsdt",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pendingRevenueWover",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pendingRevenueUsdt",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "woverToken",
    "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "usdtToken",
    "outputs": [{ "internalType": "contract IERC20", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "treasuryWallet",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "factoryDeployerWallet",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Contract bytecode - placeholder, needs to be compiled from Solidity
export const CRASH_GAME_BYTECODE = "0x608060405234801561001057600080fd5b50604051620023e9380380620023e983398101604081905261003191610089565b600080546001600160a01b031916339081179091556040517f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e090600090a3600180546001600160a01b039586166001600160a01b031991821617909155600280549486169482169490941790935560038054928516928416929092179091556004805493909216921691909117905560006009819055670de0b6b3a7640000600a55683635c9adc5dea00000600b556127106c0c556d656c737261616374696f6e600d8190556012805460ff191690556013805490911690556014556100e5565b80516001600160a01b038116811461008457600080fd5b919050565b6000806000806080858703121561009f57600080fd5b6100a88561006d565b93506100b66020860161006d565b92506100c46040860161006d565b91506100d26060860161006d565b905092959194509250565b6122f4806100f56000396000f3fe";

export const CRASH_GAME_ADDRESSES: Record<number, string | null> = {
  // Over Protocol Mainnet
  541: null,
  // Over Protocol Testnet  
  5765: null,
};
