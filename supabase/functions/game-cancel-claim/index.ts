import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, betId, nonce } = await req.json();

    console.log("[game-cancel-claim] Request:", { walletAddress, betId, nonce });

    if (!walletAddress || !betId || nonce === undefined) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: bet, error: betError } = await supabase
      .from("game_bets")
      .select("id, wallet_address, status, claim_nonce, claim_tx_hash")
      .eq("id", betId)
      .single();

    if (betError || !bet) {
      console.error("[game-cancel-claim] Bet not found:", betError);
      return new Response(JSON.stringify({ error: "Bet not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bet.wallet_address?.toLowerCase() !== walletAddress.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Bet does not belong to this wallet" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow cancel if it's still a local lock (no tx hash) and nonce matches
    if (bet.status !== "claiming") {
      return new Response(JSON.stringify({ success: true, message: "Nothing to cancel" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bet.claim_tx_hash) {
      return new Response(JSON.stringify({ error: "Cannot cancel: transaction already recorded" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bet.claim_nonce || bet.claim_nonce !== nonce) {
      return new Response(JSON.stringify({ error: "Nonce mismatch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("game_bets")
      .update({ status: "won", claiming_started_at: null, claim_nonce: null })
      .eq("id", betId)
      .eq("status", "claiming")
      .eq("claim_nonce", nonce)
      .is("claim_tx_hash", null);

    if (updateError) {
      console.error("[game-cancel-claim] Update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to cancel claim" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[game-cancel-claim] Cancelled claim lock for bet:", betId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[game-cancel-claim] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
