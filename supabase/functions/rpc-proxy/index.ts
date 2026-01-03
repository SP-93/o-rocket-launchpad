import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Primary and fallback RPC endpoints
const RPC_ENDPOINTS = [
  'https://rpc.overprotocol.com',
  'https://wallet-dolphin.rpc.over.network',
];

// Allowed RPC methods (read-only operations)
const ALLOWED_METHODS = new Set([
  'eth_call',
  'eth_getCode',
  'eth_blockNumber',
  'eth_chainId',
  'eth_getBalance',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'net_version',
]);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { method, params, id = 1, jsonrpc = '2.0' } = body;

    // Validate method
    if (!method) {
      return new Response(
        JSON.stringify({ error: 'Missing RPC method' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only allow read-only methods
    if (!ALLOWED_METHODS.has(method)) {
      return new Response(
        JSON.stringify({ error: `Method ${method} not allowed. Only read operations are permitted.` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RPC Proxy] ${method} params:`, JSON.stringify(params || []).slice(0, 200));

    // Try each RPC endpoint until one works
    let lastError: string = '';
    for (const rpcUrl of RPC_ENDPOINTS) {
      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc, id, method, params: params || [] }),
        });

        if (!response.ok) {
          lastError = `HTTP ${response.status} from ${rpcUrl}`;
          console.warn(`[RPC Proxy] ${lastError}`);
          continue;
        }

        const data = await response.json();
        
        // If RPC returned an error, try next endpoint
        if (data.error) {
          lastError = data.error.message || JSON.stringify(data.error);
          console.warn(`[RPC Proxy] RPC error from ${rpcUrl}:`, lastError);
          // Some errors should not trigger fallback (e.g., contract reverts)
          if (data.error.code === 3 || lastError.includes('revert')) {
            // This is a contract execution error, return it as-is
            console.log(`[RPC Proxy] Returning contract error from ${rpcUrl}`);
            return new Response(
              JSON.stringify(data),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          continue;
        }

        console.log(`[RPC Proxy] Success from ${rpcUrl}, result length:`, 
          typeof data.result === 'string' ? data.result.length : 'object');

        return new Response(
          JSON.stringify(data),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e: any) {
        lastError = e.message || 'Unknown fetch error';
        console.warn(`[RPC Proxy] Fetch error from ${rpcUrl}:`, lastError);
        continue;
      }
    }

    // All endpoints failed
    console.error(`[RPC Proxy] All RPC endpoints failed. Last error:`, lastError);
    return new Response(
      JSON.stringify({ 
        jsonrpc: '2.0', 
        id, 
        error: { code: -32603, message: `All RPC endpoints unavailable: ${lastError}` } 
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[RPC Proxy] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
