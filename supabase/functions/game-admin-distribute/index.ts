import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Admin wallet addresses (hardcoded for security)
const ADMIN_WALLETS = [
  '0x8334966329b7f4b459633696a8ca59118253bc89', // Factory deployer
  '0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8', // Primary wallet
];

const FACTORY_DEPLOYER_WALLET = '0x8334966329b7f4b459633696A8CA59118253bC89';

function isAdminWallet(address: string): boolean {
  return ADMIN_WALLETS.includes(address.toLowerCase());
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, currency, prize_pool_percentage } = await req.json();

    // Validate input
    if (!wallet_address || !currency) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate wallet format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin status
    if (!isAdminWallet(wallet_address)) {
      console.warn(`Unauthorized distribution attempt by: ${wallet_address}`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin wallet required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate currency
    if (!['WOVER', 'USDT'].includes(currency)) {
      return new Response(
        JSON.stringify({ error: 'Currency must be WOVER or USDT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For WOVER, validate split percentage (20-80%)
    if (currency === 'WOVER') {
      if (prize_pool_percentage === undefined || prize_pool_percentage < 20 || prize_pool_percentage > 80) {
        return new Response(
          JSON.stringify({ error: 'Prize pool percentage must be between 20% and 80%' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current revenue
    const { data: revenue, error: revenueError } = await supabase
      .from('game_revenue')
      .select('*')
      .limit(1)
      .single();

    if (revenueError || !revenue) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch revenue data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let distributionDetails: Record<string, number | string> = {};

    if (currency === 'WOVER') {
      const pendingAmount = revenue.pending_wover || 0;
      
      if (pendingAmount <= 0) {
        return new Response(
          JSON.stringify({ error: 'No pending WOVER to distribute' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const prizePoolAmount = (pendingAmount * prize_pool_percentage) / 100;
      const platformAmount = pendingAmount - prizePoolAmount;

      // Update prize pool
      const { data: pool } = await supabase
        .from('game_pool')
        .select('*')
        .limit(1)
        .single();

      if (pool) {
        await supabase
          .from('game_pool')
          .update({
            current_balance: pool.current_balance + prizePoolAmount,
            total_deposits: pool.total_deposits + prizePoolAmount,
            last_refill_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', pool.id);
      }

      // Clear pending WOVER
      await supabase
        .from('game_revenue')
        .update({
          pending_wover: 0,
          last_distribution_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', revenue.id);

      distributionDetails = {
        currency: 'WOVER',
        total_distributed: pendingAmount,
        prize_pool_amount: prizePoolAmount,
        prize_pool_percentage: prize_pool_percentage,
        platform_amount: platformAmount,
        platform_percentage: 100 - prize_pool_percentage,
      };

      console.log(`WOVER distributed: ${pendingAmount} total, ${prizePoolAmount} to pool, ${platformAmount} to platform`);

    } else if (currency === 'USDT') {
      const pendingAmount = revenue.pending_usdt || 0;
      
      if (pendingAmount <= 0) {
        return new Response(
          JSON.stringify({ error: 'No pending USDT to distribute' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // USDT goes 100% to Factory Deployer Wallet
      // (In real implementation, this would trigger an on-chain transfer)
      
      // Clear pending USDT
      await supabase
        .from('game_revenue')
        .update({
          pending_usdt: 0,
          last_distribution_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', revenue.id);

      distributionDetails = {
        currency: 'USDT',
        total_distributed: pendingAmount,
        destination: FACTORY_DEPLOYER_WALLET,
        destination_label: 'Factory Deployer Wallet',
        percentage: 100,
      };

      console.log(`USDT distributed: ${pendingAmount} to Factory Deployer`);
    }

    // Log to audit
    await supabase
      .from('audit_log')
      .insert({
        wallet_address: wallet_address.toLowerCase(),
        table_name: 'game_revenue',
        action: 'DISTRIBUTE',
        record_id: revenue.id,
        old_value: { 
          pending_wover: revenue.pending_wover, 
          pending_usdt: revenue.pending_usdt 
        },
        new_value: distributionDetails,
      });

    return new Response(
      JSON.stringify({
        success: true,
        distribution: distributionDetails,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in game-admin-distribute:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
