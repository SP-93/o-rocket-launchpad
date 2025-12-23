import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hardcoded admin wallets (same as in check-admin)
const ADMIN_WALLETS = [
  '0x8334966329b7f4b459633696a8ca59118253bc89',
  '0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8',
];

// Ethereum address validation
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function isValidAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

function isAdmin(walletAddress: string): boolean {
  return ADMIN_WALLETS.some(
    admin => admin.toLowerCase() === walletAddress.toLowerCase()
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS for audit logging
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { wallet_address, config_key, config_value, action } = body;

    // Validate wallet address
    if (!wallet_address || !isValidAddress(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin status
    if (!isAdmin(wallet_address)) {
      // Also check database for dynamically added admins
      const { data: dbAdmin } = await supabase.rpc('is_wallet_admin', { _wallet_address: wallet_address });
      if (!dbAdmin) {
        console.warn('update-protocol-config: Unauthorized access attempt from:', wallet_address);
        return new Response(
          JSON.stringify({ error: 'Unauthorized - Admin wallet required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('update-protocol-config: Admin', wallet_address, 'performing action:', action, 'on key:', config_key);

    // Get current value for audit log
    const { data: currentConfig } = await supabase
      .from('protocol_config')
      .select('*')
      .eq('config_key', config_key)
      .single();

    let result;
    let oldValue = currentConfig?.config_value || null;
    let newValue = config_value;
    let recordId = currentConfig?.id || null;

    switch (action) {
      case 'update':
        if (!config_key || config_value === undefined) {
          return new Response(
            JSON.stringify({ error: 'config_key and config_value required for update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        result = await supabase
          .from('protocol_config')
          .update({ 
            config_value, 
            updated_by: wallet_address,
            updated_at: new Date().toISOString()
          })
          .eq('config_key', config_key)
          .select()
          .single();
        
        recordId = result.data?.id;
        break;

      case 'insert':
        if (!config_key || config_value === undefined) {
          return new Response(
            JSON.stringify({ error: 'config_key and config_value required for insert' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        result = await supabase
          .from('protocol_config')
          .insert({ 
            config_key, 
            config_value, 
            updated_by: wallet_address,
            description: body.description || null,
            is_public: body.is_public !== false
          })
          .select()
          .single();
        
        recordId = result.data?.id;
        oldValue = null;
        break;

      case 'delete':
        if (!config_key) {
          return new Response(
            JSON.stringify({ error: 'config_key required for delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        result = await supabase
          .from('protocol_config')
          .delete()
          .eq('config_key', config_key);
        
        newValue = null;
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: update, insert, or delete' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (result?.error) {
      console.error('update-protocol-config: Database error:', result.error);
      return new Response(
        JSON.stringify({ error: 'Database operation failed', details: result.error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log to audit table
    const auditEntry = {
      action: `config_${action}`,
      table_name: 'protocol_config',
      record_id: recordId,
      old_value: oldValue,
      new_value: newValue,
      wallet_address,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    };

    const { error: auditError } = await supabase
      .from('audit_log')
      .insert(auditEntry);

    if (auditError) {
      console.warn('update-protocol-config: Failed to create audit log:', auditError);
      // Don't fail the request, just log the warning
    }

    console.log('update-protocol-config: Success -', action, 'on', config_key);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        config_key,
        data: result?.data || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('update-protocol-config: Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
