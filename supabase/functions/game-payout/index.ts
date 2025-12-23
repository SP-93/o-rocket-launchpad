import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Admin wallet addresses
const ADMIN_WALLETS = [
  '0x8334966329b7f4b459633696a8ca59118253bc89',
  '0x8b847bd369d2fdac7944e68277d6ba04aaeb38b8',
];

function isAdminWallet(address: string): boolean {
  return ADMIN_WALLETS.includes(address.toLowerCase());
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, action, round_id, refill_amount } = await req.json();

    // Validate admin
    if (!wallet_address || !isAdminWallet(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin wallet required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'get_pool_status': {
        const { data: pool } = await supabase
          .from('game_pool')
          .select('*')
          .limit(1)
          .single();

        const { data: threshold } = await supabase
          .from('game_config')
          .select('config_value')
          .eq('config_key', 'auto_pause_threshold')
          .single();

        const minBalance = threshold?.config_value?.wover || 150;

        return new Response(
          JSON.stringify({
            pool: {
              current_balance: pool?.current_balance || 0,
              total_deposits: pool?.total_deposits || 0,
              total_payouts: pool?.total_payouts || 0,
              last_refill_at: pool?.last_refill_at,
              last_payout_at: pool?.last_payout_at,
            },
            threshold: minBalance,
            is_healthy: (pool?.current_balance || 0) >= minBalance,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'refill_pool': {
        if (!refill_amount || refill_amount <= 0) {
          return new Response(
            JSON.stringify({ error: 'Invalid refill amount' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: pool } = await supabase
          .from('game_pool')
          .select('*')
          .limit(1)
          .single();

        if (!pool) {
          return new Response(
            JSON.stringify({ error: 'Pool not found' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const newBalance = pool.current_balance + refill_amount;

        await supabase
          .from('game_pool')
          .update({
            current_balance: newBalance,
            total_deposits: pool.total_deposits + refill_amount,
            last_refill_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', pool.id);

        // Log to audit
        await supabase
          .from('audit_log')
          .insert({
            wallet_address: wallet_address.toLowerCase(),
            table_name: 'game_pool',
            action: 'REFILL',
            record_id: pool.id,
            old_value: { current_balance: pool.current_balance },
            new_value: { current_balance: newBalance, refill_amount },
          });

        console.log(`Pool refilled: ${refill_amount} WOVER by ${wallet_address}`);

        return new Response(
          JSON.stringify({
            success: true,
            new_balance: newBalance,
            refill_amount,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_round_payouts': {
        if (!round_id) {
          return new Response(
            JSON.stringify({ error: 'Round ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: bets } = await supabase
          .from('game_bets')
          .select('*')
          .eq('round_id', round_id)
          .eq('status', 'won');

        const totalPayouts = bets?.reduce((sum, b) => sum + (b.winnings || 0), 0) || 0;

        return new Response(
          JSON.stringify({
            round_id,
            winning_bets: bets?.length || 0,
            total_payouts: totalPayouts,
            bets: bets?.map(b => ({
              wallet: `${b.wallet_address.slice(0, 6)}...${b.wallet_address.slice(-4)}`,
              bet_amount: b.bet_amount,
              cashed_out_at: b.cashed_out_at,
              winnings: b.winnings,
            })),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_pending_payouts': {
        // Get all won bets that need payouts (placeholder for on-chain implementation)
        const { data: pendingPayouts } = await supabase
          .from('game_bets')
          .select('*, game_rounds(round_number)')
          .eq('status', 'won')
          .gt('winnings', 0);

        const groupedByWallet: Map<string, number> = new Map();
        
        pendingPayouts?.forEach(bet => {
          const current = groupedByWallet.get(bet.wallet_address) || 0;
          groupedByWallet.set(bet.wallet_address, current + bet.winnings);
        });

        const payouts = Array.from(groupedByWallet.entries()).map(([wallet, amount]) => ({
          wallet_address: wallet,
          display_wallet: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
          total_pending: Math.round(amount * 100) / 100,
        }));

        return new Response(
          JSON.stringify({
            pending_payouts: payouts,
            total_pending: payouts.reduce((sum, p) => sum + p.total_pending, 0),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error in game-payout:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
