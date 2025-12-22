import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { wallet_address } = await req.json()

    if (!wallet_address) {
      console.log('check-admin: Missing wallet address')
      return new Response(
        JSON.stringify({ isAdmin: false, error: 'Missing wallet address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`check-admin: Checking admin status for wallet: ${wallet_address}`)

    // Create Supabase client with service role for privileged access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Use the same is_wallet_admin function, but from server-side
    const { data: isAdmin, error } = await supabaseAdmin.rpc('is_wallet_admin', {
      _wallet_address: wallet_address
    })

    if (error) {
      console.error('check-admin: Database error:', error)
      return new Response(
        JSON.stringify({ isAdmin: false, error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`check-admin: Wallet ${wallet_address} isAdmin: ${isAdmin}`)

    return new Response(
      JSON.stringify({ 
        isAdmin: isAdmin === true,
        wallet: wallet_address,
        verifiedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('check-admin: Unexpected error:', error)
    return new Response(
      JSON.stringify({ isAdmin: false, error: 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
