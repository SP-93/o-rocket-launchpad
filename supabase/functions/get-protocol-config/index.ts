import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Ethereum address validation regex
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Validate an Ethereum address
function isValidAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

// Validate all addresses in an object
function validateAddresses(obj: Record<string, string>): { valid: boolean; invalid: string[] } {
  const invalid: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.startsWith('0x')) {
      if (!isValidAddress(value)) {
        invalid.push(key);
      }
    }
  }
  return { valid: invalid.length === 0, invalid };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Parse request body for specific config keys
    let requestedKeys: string[] = [];
    try {
      const body = await req.json();
      if (body.keys && Array.isArray(body.keys)) {
        requestedKeys = body.keys;
      }
    } catch {
      // No body or invalid JSON - return all public configs
    }

    console.log('get-protocol-config: Fetching config, requested keys:', requestedKeys.length > 0 ? requestedKeys : 'all');

    // Fetch configurations
    let query = supabase
      .from('protocol_config')
      .select('config_key, config_value, description, updated_at')
      .eq('is_public', true);

    if (requestedKeys.length > 0) {
      query = query.in('config_key', requestedKeys);
    }

    const { data, error } = await query;

    if (error) {
      console.error('get-protocol-config: Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch configuration', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data || data.length === 0) {
      console.warn('get-protocol-config: No configuration found');
      return new Response(
        JSON.stringify({ error: 'No configuration found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform to key-value map and validate addresses
    const config: Record<string, any> = {};
    const validationWarnings: string[] = [];

    for (const row of data) {
      const value = row.config_value;
      
      // Validate addresses in contract/token configs
      if (typeof value === 'object' && value !== null) {
        const addressValidation = validateAddresses(value as Record<string, string>);
        if (!addressValidation.valid) {
          validationWarnings.push(`Invalid addresses in ${row.config_key}: ${addressValidation.invalid.join(', ')}`);
        }
      }
      
      config[row.config_key] = {
        value,
        description: row.description,
        updated_at: row.updated_at,
      };
    }

    if (validationWarnings.length > 0) {
      console.warn('get-protocol-config: Validation warnings:', validationWarnings);
    }

    console.log('get-protocol-config: Returning', Object.keys(config).length, 'config entries');

    return new Response(
      JSON.stringify({
        success: true,
        config,
        warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
        cached_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('get-protocol-config: Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
