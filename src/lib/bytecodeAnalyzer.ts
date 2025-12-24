/**
 * Bytecode Analyzer for EVM Compatibility
 * Detects problematic opcodes like PUSH0 (0x5f) that may not be supported on all chains
 */

export interface BytecodeAnalysis {
  hasPush0: boolean;
  /** Number of actual PUSH0 opcodes found in the opcode stream (not inside PUSH data) */
  push0Count: number;
  /** Byte offset (0-based) of the first PUSH0 opcode in the opcode stream, if any */
  firstPush0ByteOffset: number | null;
  evmVersion: 'paris' | 'shanghai' | 'unknown';
  warnings: string[];
  recommendations: string[];
}

/**
 * Analyzes bytecode for potential EVM compatibility issues
 * 
 * PUSH0 (0x5f) was introduced in Shanghai upgrade and may not be supported
 * on chains that haven't upgraded yet (like some L2s or alternative L1s)
 */
export function analyzeBytecode(bytecode: string): BytecodeAnalysis {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Remove 0x prefix if present
  const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;

  // Convert to bytes array for analysis
  const bytes: number[] = [];
  for (let bi = 0; bi < cleanBytecode.length; bi += 2) {
    bytes.push(parseInt(cleanBytecode.slice(bi, bi + 2), 16));
  }

  // Scan through bytecode looking for 0x5f opcode.
  // IMPORTANT: skip PUSH1-PUSH32 immediate data so we don't false-positive on data bytes.
  let push0Count = 0;
  let firstPush0ByteOffset: number | null = null;

  let i = 0;
  while (i < bytes.length) {
    const opcode = bytes[i];

    // PUSH0 = 0x5f
    if (opcode === 0x5f) {
      push0Count += 1;
      if (firstPush0ByteOffset === null) firstPush0ByteOffset = i;
      // continue scanning to count all occurrences
      i += 1;
      continue;
    }

    // PUSH1 (0x60) through PUSH32 (0x7f) - skip the data bytes
    if (opcode >= 0x60 && opcode <= 0x7f) {
      const pushSize = opcode - 0x60 + 1;
      i += 1 + pushSize;
    } else {
      i += 1;
    }
  }

  const hasPush0 = push0Count > 0;

  // Determine likely EVM version
  let evmVersion: 'paris' | 'shanghai' | 'unknown' = 'unknown';

  if (hasPush0) {
    evmVersion = 'shanghai';
    warnings.push('Bytecode contains PUSH0 opcode (Shanghai / Solidity 0.8.20+)');
    warnings.push('Over Protocol may not support PUSH0 yet; deployments can fail');
    recommendations.push('Recompile with Remix using EVM Version: Paris');
    recommendations.push('Copy BYTECODE → object (creation bytecode), not deployed/runtime');
  } else {
    evmVersion = 'paris';
  }

  return {
    hasPush0,
    push0Count,
    firstPush0ByteOffset,
    evmVersion,
    warnings,
    recommendations,
  };
}

/**
 * Quick check if bytecode likely contains PUSH0
 */
export function hasPush0Opcode(bytecode: string): boolean {
  return analyzeBytecode(bytecode).hasPush0;
}
