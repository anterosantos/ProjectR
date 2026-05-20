import { createClient } from '@supabase/supabase-js'

interface ValidateTokenRequest {
  token: string
}

interface ValidateTokenResponse {
  valid: boolean
  playerId?: string
  parentEmail?: string
  playerName?: string
  reason?: string
}

// In-memory rate limiter — resets on cold start (acceptable for "basic" per spec; Redis preferred)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()

  // Purge expired entries to prevent unbounded memory growth
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) rateLimitStore.delete(key)
  }

  const entry = rateLimitStore.get(ip)

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (entry.count >= 10) {
    return false
  }

  entry.count++
  return true
}

// Token must be a non-empty string of ≤256 alphanumeric/hyphen/underscore characters
export const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{1,256}$/

export async function handler(req: Request): Promise<Response> {
  // CORS: restrict to app's own origin (configured via APP_URL env var)
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000'
  const corsHeaders = {
    'Access-Control-Allow-Origin': appUrl,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Resolve client IP — if undeterminable, skip rate limiting (internal/trusted call)
    const forwardedFor = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const clientIp = forwardedFor?.split(',')[0]?.trim() ?? realIp ?? null

    if (clientIp !== null && !checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'rate_limit_exceeded' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    const body: ValidateTokenRequest = await req.json()
    const { token } = body

    if (!token || typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
      return new Response(
        JSON.stringify({ valid: false, reason: 'missing_token' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase credentials')
      return new Response(
        JSON.stringify({ valid: false, reason: 'internal_error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const { data: consent, error } = await supabase
      .from('parental_consents')
      .select('id, player_id, parent_email, status, confirmed_at')
      .eq('token', token)
      .eq('status', 'confirmed')
      .single()

    if (error || !consent) {
      console.log('Token not found or not confirmed')
      return new Response(
        JSON.stringify({ valid: false, reason: 'not_found' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    // Guard against null or unparseable confirmed_at
    const confirmedAtMs = consent.confirmed_at
      ? new Date(consent.confirmed_at).getTime()
      : NaN

    if (!isFinite(confirmedAtMs)) {
      console.error('Invalid confirmed_at value for consent', { id: consent.id })
      return new Response(
        JSON.stringify({ valid: false, reason: 'internal_error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    const expirationTime = confirmedAtMs + 30 * 24 * 60 * 60 * 1000
    if (Date.now() > expirationTime) {
      console.log('Token expired')
      return new Response(
        JSON.stringify({ valid: false, reason: 'expired' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, full_name')
      .eq('id', consent.player_id)
      .single()

    if (playerError || !player) {
      console.error('Player not found', { playerId: consent.player_id })
      return new Response(
        JSON.stringify({ valid: false, reason: 'internal_error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    const responseBody: ValidateTokenResponse = {
      valid: true,
      playerId: consent.player_id,
      parentEmail: consent.parent_email,
      playerName: player.full_name,
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ valid: false, reason: 'internal_error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
}

// Supabase Edge Functions entry point — only active in Deno runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).Deno !== 'undefined') {
  Deno.serve(handler)
}
