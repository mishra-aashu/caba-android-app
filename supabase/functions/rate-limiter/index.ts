import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request info
    const url = new URL(req.url)
    const endpoint = url.pathname.replace('/', '') || 'general'
    
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip')
      || 'unknown'
    
    // Get user ID if authenticated
    const authHeader = req.headers.get('Authorization')
    let userId = clientIp
    
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      )
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        userId = user.id
      }
    }

    // Check rate limit using Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Define limits per endpoint
    const limits: Record<string, { max: number; window: number }> = {
      'general': { max: 100, window: 900 },      // 100 per 15 min
      'auth': { max: 5, window: 3600 },          // 5 per hour
      'search': { max: 30, window: 60 },         // 30 per minute
      'messages': { max: 60, window: 60 },       // 60 per minute
      'upload': { max: 10, window: 60 },        // 10 uploads per minute
    }

    const limitConfig = limits[endpoint] || limits['general']

    // Call the rate limit function
    const { data: allowed, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_identifier: userId,
      p_endpoint: endpoint,
      p_max_requests: limitConfig.max,
      p_window_seconds: limitConfig.window
    }

    if (error || !allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: limitConfig.window
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Rate limit passed - continue with request
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Request allowed',
        remaining: limitConfig.max - 1
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
