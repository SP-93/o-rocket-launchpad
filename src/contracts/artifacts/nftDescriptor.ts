// NonfungibleTokenPositionDescriptor ABI and bytecode
// Imported from @uniswap/v3-periphery

export const NFT_DESCRIPTOR_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_WETH9", type: "address" },
      { internalType: "bytes32", name: "_nativeCurrencyLabelBytes", type: "bytes32" }
    ],
    stateMutability: "nonpayable",
    type: "constructor"
  },
  {
    inputs: [],
    name: "WETH9",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "nativeCurrencyLabel",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "token0", type: "address" },
      { internalType: "address", name: "token1", type: "address" },
      { internalType: "uint256", name: "chainId", type: "uint256" }
    ],
    name: "flipRatio",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "chainId", type: "uint256" }
    ],
    name: "tokenRatioPriority",
    outputs: [{ internalType: "int256", name: "", type: "int256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "contract INonfungiblePositionManager", name: "positionManager", type: "address" },
      { internalType: "uint256", name: "tokenId", type: "uint256" }
    ],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// This function loads bytecode dynamically to avoid build issues
export async function getNftDescriptorBytecode(): Promise<string> {
  const artifact = await import('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json');
  return artifact.bytecode;
}

// Helper to convert string to bytes32 for native currency label
export function stringToBytes32(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return '0x' + hex.padEnd(64, '0');
}
