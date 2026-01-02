import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BetStats {
  total: number;
  active: number;
  won: number;
  lost: number;
  claiming: number;
  claimed: number;
  pendingLiability: number;
}

interface RecentBet {
  id: string;
  wallet_address: string;
  bet_amount: number;
  status: string;
  winnings: number | null;
  cashed_out_at: number | null;
  claim_tx_hash: string | null;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  event_type: string;
  wallet_address: string | null;
  ticket_id: string | null;
  bet_id: string | null;
  round_id: string | null;
  correlation_id: string | null;
  event_data: any;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, action = 'all', filters = {} } = await req.json();

    if (!wallet_address) {
      return new Response(
        JSON.stringify({ error: 'wallet_address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin status
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_wallet_admin', {
      _wallet_address: wallet_address
    });

    if (adminError || !isAdmin) {
      console.log('[game-admin-stats] Admin check failed:', { wallet_address, isAdmin, adminError });
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[game-admin-stats] Admin verified:', wallet_address);

    const result: {
      stats?: BetStats;
      recentBets?: RecentBet[];
      auditLogs?: AuditLogEntry[];
      stuckClaims?: any[];
    } = {};

    // Fetch bet stats
    if (action === 'all' || action === 'stats') {
      const { data: bets, error: betsError } = await supabase
        .from('game_bets')
        .select('id, status, winnings, claiming_started_at');

      if (betsError) {
        console.error('[game-admin-stats] Error fetching bets:', betsError);
        throw betsError;
      }

      const allBets = bets || [];
      result.stats = {
        total: allBets.length,
        active: allBets.filter(b => b.status === 'active').length,
        won: allBets.filter(b => b.status === 'won').length,
        lost: allBets.filter(b => b.status === 'lost').length,
        claiming: allBets.filter(b => b.status === 'claiming').length,
        claimed: allBets.filter(b => b.status === 'claimed').length,
        pendingLiability: allBets
          .filter(b => b.status === 'won' || b.status === 'claiming')
          .reduce((sum, b) => sum + (b.winnings || 0), 0),
      };

      // Find stuck claims (claiming for > 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      result.stuckClaims = allBets
        .filter(b => b.status === 'claiming' && b.claiming_started_at && b.claiming_started_at < fiveMinutesAgo)
        .map(b => ({
          id: b.id,
          winnings: b.winnings || 0,
          claiming_started_at: b.claiming_started_at || '',
        }));
    }

    // Fetch recent bets
    if (action === 'all' || action === 'bets') {
      const { data: recent, error: recentError } = await supabase
        .from('game_bets')
        .select('id, wallet_address, bet_amount, status, winnings, cashed_out_at, claim_tx_hash, created_at, round_id')
        .order('created_at', { ascending: false })
        .limit(50);

      if (recentError) {
        console.error('[game-admin-stats] Error fetching recent bets:', recentError);
        throw recentError;
      }

      result.recentBets = (recent || []) as RecentBet[];
    }

    // Fetch audit logs
    if (action === 'all' || action === 'audit') {
      let query = supabase
        .from('game_audit_log')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.wallet_address) {
        query = query.ilike('wallet_address', `%${filters.wallet_address.toLowerCase()}%`);
      }
      if (filters.event_type && filters.event_type !== 'ALL') {
        query = query.eq('event_type', filters.event_type);
      }
      if (filters.correlation_id) {
        query = query.ilike('correlation_id', `%${filters.correlation_id}%`);
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data: logs, error: logsError } = await query;

      if (logsError) {
        console.error('[game-admin-stats] Error fetching audit logs:', logsError);
        throw logsError;
      }

      result.auditLogs = (logs || []) as AuditLogEntry[];
    }

    console.log('[game-admin-stats] Success:', {
      stats: result.stats?.total,
      recentBets: result.recentBets?.length,
      auditLogs: result.auditLogs?.length,
    });

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[game-admin-stats] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
