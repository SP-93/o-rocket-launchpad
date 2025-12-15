// NFTDescriptor Library - Must be deployed FIRST before NonfungibleTokenPositionDescriptor
// This is a LIBRARY, not a contract with constructor

export const NFT_DESCRIPTOR_LIBRARY_ABI = [] as const; // Libraries don't have external ABI

export async function getNftDescriptorLibraryBytecode(): Promise<string> {
  const artifact = await import('@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json');
  return artifact.bytecode;
}
