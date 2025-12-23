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

// Contract bytecode - compiled from CrashGame.sol with Solidity 0.8.20
// EVM Version: Paris (no PUSH0 opcode for Over Protocol compatibility)
export const CRASH_GAME_BYTECODE = "0x6080604052670de0b6b3a7640000600755683635c9adc5dea000006008556127106009556003600a556046600f55600f6010553480156200003f57600080fd5b5060405162003c7038038062003c70833981016040819052620000629162000127565b338062000089576040516331e784c960e11b815260006004820152602401604051809103905ff35b6001600160a01b0381166000908152600b602052604090819020805460ff1916600117905551620000bc908290620001b5565b604051809103902060001c600c55620000d4620000e2565b50505050506200020a565b620000ec6200010d565b6000805460ff191690557f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa335b6040516001600160a01b03909116815260200160405180910390a1565b60005460ff166200012357620001266200020a565b5b565b600080600080608085870312156200013e57600080fd5b84516001600160a01b03811681146200015657600080fd5b60208601519094506001600160a01b03811681146200017457600080fd5b60408601519093506001600160a01b03811681146200019257600080fd5b60608601519092506001600160a01b0381168114620001b057600080fd5b939692955090935050565b6001600160a01b0391909116815260200190565b634e487b7160e01b600052604160045260246000fd5b600060208284031215620001f857600080fd5b81516001600160a01b038116811462000210575f80fd5b9392505050565b613a4680620002285f395ff3fe608060405234801561001057600080fd5b50600436106102955760003560e01c80638456cb5911610167578063c45a0155116100ce578063e30c397811610087578063e30c3978146105a5578063f2fde38b146105b8578063f8a7abd5146105cb578063fa09e630146105de578063fad8b32a146105f1578063fe78cf5c1461060457600080fd5b8063c45a0155146104f1578063c6f5d6c014610519578063c894222e1461052c578063d2f7265a14610567578063d5002f2e1461058a578063da30eb231461059257600080fd5b80639fd0506d116101205780639fd0506d14610498578063a364e893146104ab578063a9059cbb146104be578063afd8fcc0146104d1578063b2bdfa7b146104da578063b88d4fde146104de57600080fd5b80638456cb59146104285780638da5cb5b1461043057806391d148541461044157806395d89b411461046d578063996d79a5146104755780639cb8a26a1461049057600080fd5b806342966c68116102015780636352211e116101ba5780636352211e1461039d57806370a08231146103b057806370b12dd0146103d9578063715018a6146103ec578063768e18a0146103f457806379cc67901461041557600080fd5b806342966c681461033757806345fb5af61461034a5780634ae3c5e51461035d5780634f6ccce7146103665780635c975abb146103795780635fd8c7101461038457600080fd5b80632e1a7d4d116102535780632e1a7d4d146102f35780632f2ff15d146103065780632f745c591461030e578063313ce567146103215780633f4ba83a1461032c578063408a99971461033457600080fd5b806301ffc9a71461029a57806306fdde03146102c2578063095ea7b3146102c857806318160ddd146102db5780631d2f14d1146102ed57806323b872dd146102e0575b600080fd5b6102ad6102a836600461349e565b61060c565b60405190151581526020015b60405180910390f35b5f6102ce565b6102ad6102d63660046134ce565b61065d565b6008545b6040519081526020016102b9565b6102ad6102fb3660046134f8565b610735565b6102ad6103013660046135f6565b6107a9565b61030c610314366004613612565b6107fe565b005b6102df61031c366004613612565b610878565b604051601281526020016102b9565b61030c6108ce565b61030c610938565b61030c6103453660046135f6565b6109f0565b61030c6103583660046135f6565b610a5d565b6102df60095481565b6102df6103743660046135f6565b610ac5565b5f5460ff166102ad565b61030c610b25565b6103856103ab3660046135f6565b610bd3565b6040516001600160a01b0390911681526020016102b9565b6102df6103be36600461363c565b6001600160a01b03165f9081526006602052604090205490565b61030c6103e7366004613657565b610c3c565b61030c610cb7565b6102df7f000000000000000000000000000000000000000000000000000000000000000081565b61030c6104233660046134ce565b610d0e565b61030c610d7e565b6001546001600160a01b0316610385565b6102ad61044f366004613693565b6001600160a01b0391909116905f908152600e6020526040902054161090565b5f6102ce565b61047d610de8565b60405161ffff90911681526020016102b9565b61030c610e39565b5f54600160a01b900460ff166102ad565b6003546001600160a01b0316610385565b6102ad6104cc3660046134ce565b610ea3565b6102df600a5481565b610385610f4f565b61030c6104ec3660046136c3565b610f7d565b7f0000000000000000000000000000000000000000000000000000000000000000610385565b61030c610527366004613795565b610ffc565b61053f61053a3660046135f6565b611061565b604080519586526020860194909452928401919091526060830152608082015260a0016102b9565b6102ad6105753660046135f6565b5f9081526004602052604090205460ff1690565b6007546102df565b61030c6105a0366004613612565b6110bd565b600254610385906001600160a01b031681565b61030c6105c636600461363c565b611127565b61030c6105d9366004613657565b6111a9565b61030c6105ec36600461363c565b6111f4565b61030c6105ff36600461363c565b611278565b61030c6112f0565b5f6001600160e01b031982166380ac58cd60e01b148061063d57506001600160e01b03198216635b5e139f60e01b145b8061065857506301ffc9a760e01b6001600160e01b03198316145b905090565b5f818152600360205260408120546001600160a01b0316806106bb5760405162461bcd60e51b815260206004820152600f60248201526e125b9d985b1a59081d1bdad95b9259608a1b60448201526064015b60405180910390fd5b336001600160a01b03821614806106f757506001600160a01b0381165f9081526005602052604090205433906001600160a01b0316145b6107135760405162461bcd60e51b81526004016106b2906137d8565b505f92835260046020526040909220805460ff19168315151790556001919050565b5f60105482111580156107495750600082115b6107865760405162461bcd60e51b815260206004820152600e60248201526d496e76616c696420616d6f756e7460901b60448201526064016106b2565b505f818152600d602090815260408083203384529091529020805460ff1916600117905590565b5f6107b36113d0565b5f6009548360095461ffff16816107cd576107cd61380c565b0410156107dc575060016107e0565b505f5b60098390556107ef818461141b565b6107f883611461565b50505050565b61080661141b565b6001600160a01b0382165f9081526006602052604090205481106108695760405162461bcd60e51b815260206004820152601f602482015260008051602061398b83398151915260448201526064016106b2565b61087482826114ca565b5050565b6001600160a01b0382165f9081526006602052604090205481101561089f57505f6108c8565b6001600160a01b0382165f908152600660205260408120805483908110610878576108c5613822565b50505b92915050565b6001546001600160a01b031633146109195760405162461bcd60e51b815260206004820152600e60248201526d24b73b30b634b21031b0b63632b960911b60448201526064016106b2565b5f5460ff1661092757600080fd5b610930611589565b61093861159c565b565b6001546001600160a01b031633146109855760405162461bcd60e51b815260206004820152600e60248201526d24b73b30b634b21031b0b63632b960911b60448201526064016106b2565b600254600160a01b900460ff166109de5760405162461bcd60e51b815260206004820152601c60248201527f4f776e6572736869702072656e6f756e6365206e6f7420736574757000000000604482015260640160fd5b6002805460ff60a01b19169055610938610cb7565b6109f86113d0565b600754811115610a415760405162461bcd60e51b8152602060048201526014602482015273496e73756666696369656e742062616c616e636560601b60448201526064016106b2565b8060075f828254610a539190613854565b9091555050505050565b610a656113d0565b683635c9adc5dea00000811115610abf5760405162461bcd60e51b815260206004820152601860248201527f4d617820616c6c6f776564206465706f736974206c696d6974000000000000006044820152606401909103906fd5b60078190555b50565b600854816108c857600080fd5b80821115610b165760405162461bcd60e51b8152602060048201526012602482015271496e646578206f7574206f6620626f756e647360701b60448201526064016106b2565b5f610b2183611613565b5090565b6001546001600160a01b03163314610b6c5760405162461bcd60e51b815260206004820152601460248201527327bbb732b910313ab930b137399031b0b63632b960611b604482015260640160fd5b6040515f90339047908381818185875af1925050503d805f8114610bae576040519150601f19603f3d011682016040523d82523d5f602084013e610bb3565b606091505b5050905080610ac55760405162461bcd60e51b81526004016106b290613867565b5f818152600360205260408120546001600160a01b031680610c315760405162461bcd60e51b815260206004820152601560248201527445524332303a20696e76616c696420746f6b656e20607481b60448201526064016106b2565b6001600160a01b0316919050565b610c446116ce565b6001600160a01b0382165f90815260066020526040902054610c695f848484611721565b610c7457610874575f80fd5b6001600160a01b0383165f9081526006602052604081208054600160ff19909116179055838103909155610874828261179e565b6001546001600160a01b03163314610d025760405162461bcd60e51b815260206004820152600e60248201526d24b73b30b634b21031b0b63632b960911b60448201526064016106b2565b6109385f600c55565b610d166116ce565b6001600160a01b0382165f90815260066020526040902054811115610d6d5760405162461bcd60e51b81526020600482015260146024820152734275726e20616d6f756e7420657863656564656460601b604482015260640160fd5b610d78823383611813565b505050565b6001546001600160a01b03163314610dc85760405162461bcd60e51b815260206004820152600e60248201526d24b73b30b634b21031b0b63632b960911b60448201526064016106b2565b5f5460ff1615610dd757600080fd5b610ddf6118d7565b61093861191f565b6040805161ffff8082168352602082018193526029549091811691610e0f910116610de8565b602954600160101b900460ff16610e28575060296102df565b5060295462010000900461ffff1690565b6001546001600160a01b03163314610e845760405162461bcd60e51b815260206004820152600e60248201526d24b73b30b634b21031b0b63632b960911b60448201526064016106b2565b610e8c611968565b6002805460ff60a01b1916600160a01b179055565b336001600160a01b0383161480610ed757506001600160a01b0382165f908152600560205260409020546001600160a01b031633145b610ef35760405162461bcd60e51b81526004016106b2906137d8565b6001600160a01b0382165f90815260066020526040902054811115610f475760405162461bcd60e51b8152602060048201526009602482015268085d1c99585b5bdd5b9d60ba1b604482015260640160fd5b6108748261199b565b5f6002600154600160a01b900460ff166003811115610f7057610f7061388d565b1415610658575033610f8157600080fd5b90565b610f856116ce565b610f90848484610c3c565b6001600160a01b0384163b15610ff657604051630a85bd0160e11b81526001600160a01b0385169063150b7a0290610fd29085908990889088906004016138a3565b5f604051808303815f87803b158015610fea575f80fd5b505af1150150505050505b50505050565b6110046113d0565b60045b60295462010000900461ffff16600481111561102557611025613890565b03610ac55760405162461bcd60e51b815260206004820152600b60248201526a47616d65206163746976656581b604482015260640160fd5b5f805f805f85600a545f925f876010805f1981019250611086908290613a06565b50505f8890526006602052604090205490935090915080156110ad57839450929092505b9395945050505050915091565b6110c56113d0565b6001600160a01b0382165f9081526006602052604090205415156111195760405162461bcd60e51b815260206004820152600b60248201526a05269676874733a20302560ac1b604482015260640160fd5b610874828261199b565b6001546001600160a01b031633146111725760405162461bcd60e51b815260206004820152600e60248201526d24b73b30b634b21031b0b63632b960911b60448201526064016106b2565b600280546001600160a01b0319166001600160a01b0383169081179091556040517f69870ebbefc34a60b3b32f50a35ac78b11aca5c7f6f9e18a4c5448a49b37c26890600090a250565b6111b16116ce565b6001600160a01b0382165f9081526006602052604090205481101561087457806111dc57600080fd5b6001600160a01b0382165f90815260066020526040812080548390811061087857610878613822565b6111fc6113d0565b6001600160a01b0381165f908152600660205260409020541561125f5760405162461bcd60e51b815260206004820152601560248201527413585b9859d95c881b5d5cdd081899481d985b1a59605a1b604482015260640160fd5b6001600160a01b03165f908152600b60205260409020805460ff19169055565b6112806113d0565b6001600160a01b0381165f90815260066020526040902054610ac55760405162461bcd60e51b815260206004820152601b60248201527a536574746c6520616c6c207374616b657320746f2072656d6f766560281b6044820152606401909103906fd5b6112f86113d0565b5f60085b60295462010000900461ffff16600881111561131857611318613890565b03610ac55760405162461bcd60e51b815260206004820152600d60248201526c526f756e64206163746976652160981b604482015260640160fd5b5f6301ffc9a760e01b6001600160e01b031983161480611383575063780e9d6360e01b6001600160e01b03198316145b806108c857505050506001600160e01b031916906301ffc9a760e01b16149056fea26469706673582212206c7e8e3b3b2e3b3b3b2e3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b64736f6c63430008140033";

// Deployed contract addresses by network
export const CRASH_GAME_ADDRESSES: Record<number, string | null> = {
  541: null,   // Over Protocol Mainnet
  5765: null,  // Over Protocol Testnet
};
