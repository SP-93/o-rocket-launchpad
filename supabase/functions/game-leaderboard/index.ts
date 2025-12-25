import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache
let cachedLeaderboard: { data: unknown; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 1000; // 60 seconds

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for force refresh parameter
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('force_refresh') === 'true';
    
    // Check cache (skip if force refresh)
    if (!forceRefresh && cachedLeaderboard && (Date.now() - cachedLeaderboard.timestamp) < CACHE_DURATION) {
      console.log('[Leaderboard] Returning cached data');
      return new Response(
        JSON.stringify(cachedLeaderboard.data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[Leaderboard] Fetching fresh data', forceRefresh ? '(force refresh)' : '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get top 20 players by total winnings (include both 'won' and 'claimed' status)
    const { data: topWinners, error: winnersError } = await supabase
      .from('game_bets')
      .select('wallet_address, winnings, status')
      .in('status', ['won', 'claimed'])
      .order('winnings', { ascending: false });

    if (winnersError) {
      console.error('Error fetching leaderboard:', winnersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leaderboard' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate by wallet
    const walletStats: Map<string, { totalWinnings: number; gamesWon: number; biggestWin: number }> = new Map();

    if (topWinners) {
      for (const bet of topWinners) {
        const existing = walletStats.get(bet.wallet_address) || {
          totalWinnings: 0,
          gamesWon: 0,
          biggestWin: 0,
        };

        existing.totalWinnings += bet.winnings || 0;
        existing.gamesWon += 1;
        existing.biggestWin = Math.max(existing.biggestWin, bet.winnings || 0);

        walletStats.set(bet.wallet_address, existing);
      }
    }

    // Convert to array and sort
    const leaderboard = Array.from(walletStats.entries())
      .map(([wallet, stats]) => ({
        wallet_address: wallet,
        display_address: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
        total_winnings: Math.round(stats.totalWinnings * 100) / 100,
        games_won: stats.gamesWon,
        biggest_win: Math.round(stats.biggestWin * 100) / 100,
      }))
      .sort((a, b) => b.total_winnings - a.total_winnings)
      .slice(0, 20);

    // Get recent big wins (last 24h, winnings > 10 WOVER)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentBigWins } = await supabase
      .from('game_bets')
      .select('wallet_address, winnings, cashed_out_at, created_at, game_rounds(round_number)')
      .in('status', ['won', 'claimed'])
      .gt('winnings', 10)
      .gte('created_at', oneDayAgo)
      .order('winnings', { ascending: false })
      .limit(10);

    const bigWins = recentBigWins?.map(win => {
      const roundData = win.game_rounds as { round_number?: number } | null;
      return {
        wallet_address: `${win.wallet_address.slice(0, 6)}...${win.wallet_address.slice(-4)}`,
        winnings: Math.round(win.winnings * 100) / 100,
        multiplier: win.cashed_out_at,
        round_number: roundData?.round_number,
        time_ago: getTimeAgo(new Date(win.created_at)),
      };
    }) || [];

    // Get game stats
    const { data: roundStats } = await supabase
      .from('game_rounds')
      .select('id, crash_point')
      .eq('status', 'crashed');

    const totalRounds = roundStats?.length || 0;
    const avgCrashPoint = roundStats && roundStats.length > 0
      ? roundStats.reduce((sum, r) => sum + (r.crash_point || 0), 0) / roundStats.length
      : 0;

    const { data: betStats } = await supabase
      .from('game_bets')
      .select('winnings')
      .in('status', ['won', 'claimed']);

    const totalPayouts = betStats?.reduce((sum, b) => sum + (b.winnings || 0), 0) || 0;

    const response = {
      leaderboard,
      recent_big_wins: bigWins,
      stats: {
        total_rounds: totalRounds,
        average_crash_point: Math.round(avgCrashPoint * 100) / 100,
        total_payouts: Math.round(totalPayouts * 100) / 100,
      },
      cached_at: new Date().toISOString(),
    };

    // Update cache
    cachedLeaderboard = {
      data: response,
      timestamp: Date.now(),
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in game-leaderboard:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
