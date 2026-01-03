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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { wallet_address, action } = await req.json();

    // Verify admin
    if (!wallet_address || !ADMIN_WALLETS.some(w => w.toLowerCase() === wallet_address.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Admin only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'cleanup_ghost_tickets') {
      // Delete tickets without tx_hash that are older than 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data: ghostTickets, error: selectError } = await supabase
        .from('game_tickets')
        .select('id, wallet_address, created_at')
        .is('tx_hash', null)
        .lt('created_at', oneHourAgo);

      if (selectError) {
        console.error('Error finding ghost tickets:', selectError);
        return new Response(
          JSON.stringify({ error: 'Failed to find ghost tickets' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const totalGhostFound = ghostTickets?.length || 0;
      let deletedCount = 0;
      let skippedWithBets = 0;

      if (totalGhostFound > 0) {
        // Get IDs of tickets that have NO bets referencing them
        const ticketIds = ghostTickets.map(t => t.id);
        
        // Check which tickets have bets
        const { data: betsWithTickets } = await supabase
          .from('game_bets')
          .select('ticket_id')
          .in('ticket_id', ticketIds);
        
        const ticketsWithBetsSet = new Set((betsWithTickets || []).map(b => b.ticket_id));
        const deletableTickets = ticketIds.filter(id => !ticketsWithBetsSet.has(id));
        
        skippedWithBets = ticketsWithBetsSet.size;
        
        console.log(`[Cleanup] Found ${deletableTickets.length} ghost tickets without bets (${skippedWithBets} have bets)`);

        if (deletableTickets.length > 0) {
          const { error: deleteError } = await supabase
            .from('game_tickets')
            .delete()
            .in('id', deletableTickets);

          if (deleteError) {
            console.error('Error deleting ghost tickets:', deleteError);
            return new Response(
              JSON.stringify({ error: 'Failed to delete ghost tickets', details: deleteError.message }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          deletedCount = deletableTickets.length;
        }

        // Log the cleanup
        await supabase.from('game_audit_log').insert({
          event_type: 'ADMIN_CLEANUP_GHOST_TICKETS',
          wallet_address: wallet_address.toLowerCase(),
          event_data: { 
            deleted_count: deletedCount, 
            skipped_with_bets: skippedWithBets,
            tickets: ghostTickets.filter(t => deletableTickets.includes(t.id))
          },
        });

        console.log(`[Cleanup] Deleted ${deletedCount} ghost tickets, skipped ${skippedWithBets} with bets`);
      } else {
        console.log(`[Cleanup] No ghost tickets found`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          deleted_count: deletedCount,
          skipped_with_bets: skippedWithBets,
          total_ghost_found: totalGhostFound
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});