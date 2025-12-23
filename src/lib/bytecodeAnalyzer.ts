/**
 * Bytecode Analyzer for EVM Compatibility
 * Detects problematic opcodes like PUSH0 (0x5f) that may not be supported on all chains
 */

export interface BytecodeAnalysis {
  hasPush0: boolean;
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
  
  // Check for PUSH0 opcode (0x5f)
  // PUSH0 is a single-byte opcode that pushes 0 onto the stack
  // It appears in bytecode compiled with Solidity 0.8.20+ targeting Shanghai
  
  // Simple heuristic: look for 5f patterns that are likely PUSH0
  // In valid bytecode, 5f as PUSH0 would typically appear:
  // - At even positions (byte boundaries)
  // - Not as part of PUSH data
  
  let hasPush0 = false;
  
  // Convert to bytes array for analysis
  const bytes: number[] = [];
  for (let i = 0; i < cleanBytecode.length; i += 2) {
    bytes.push(parseInt(cleanBytecode.slice(i, i + 2), 16));
  }
  
  // Scan through bytecode looking for 0x5f opcode
  // Skip PUSH1-PUSH32 data
  let i = 0;
  while (i < bytes.length) {
    const opcode = bytes[i];
    
    // PUSH0 = 0x5f
    if (opcode === 0x5f) {
      hasPush0 = true;
      break;
    }
    
    // PUSH1 (0x60) through PUSH32 (0x7f) - skip the data bytes
    if (opcode >= 0x60 && opcode <= 0x7f) {
      const pushSize = opcode - 0x60 + 1;
      i += 1 + pushSize;
    } else {
      i += 1;
    }
  }
  
  // Determine likely EVM version
  let evmVersion: 'paris' | 'shanghai' | 'unknown' = 'unknown';
  
  if (hasPush0) {
    evmVersion = 'shanghai';
    warnings.push('Bytecode contains PUSH0 opcode (Shanghai/Solidity 0.8.20+)');
    warnings.push('This opcode may not be supported on Over Protocol');
    recommendations.push('Recompile with Remix using EVM Version: Paris');
    recommendations.push('Or downgrade to Solidity 0.8.19');
  } else {
    evmVersion = 'paris';
  }
  
  return {
    hasPush0,
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
