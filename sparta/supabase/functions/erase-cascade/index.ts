// Type stub for Deno runtime — allows import in Node/Vitest without @deno/types package
declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

import { createClient } from '@supabase/supabase-js'

const UUID_PATTERN = /^[0-9a-f-]{36}$/i

interface EraseResult {
  ok: boolean
  erased?: boolean
  profile_id?: string
  error?: string
}

export async function handler(req: Request): Promise<Response> {
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000'
  const corsHeaders = {
    'Access-Control-Allow-Origin': appUrl,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    let body: { playerId?: unknown; actorId?: unknown }
    try {
      body = await req.json() as { playerId?: unknown; actorId?: unknown }
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_json' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const { playerId, actorId } = body

    if (!playerId || typeof playerId !== 'string' || !UUID_PATTERN.test(playerId)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_player_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    if (!actorId || typeof actorId !== 'string' || !UUID_PATTERN.test(actorId)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_actor_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[erase-cascade] Missing Supabase credentials')
      return new Response(
        JSON.stringify({ ok: false, error: 'internal_error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || authHeader !== `Bearer ${supabaseServiceRoleKey}`) {
      return new Response(
        JSON.stringify({ ok: false, error: 'forbidden' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Call PL/pgSQL function — atomic cascade deletion in a single transaction
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('fn_erase_subject_cascade', {
        p_player_id: playerId,
        p_actor_id: actorId,
      })

    if (rpcError) {
      console.error('[erase-cascade] RPC error:', rpcError.message)
      return new Response(
        JSON.stringify({ ok: false, error: 'rpc_failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const eraseResult = rpcData as EraseResult

    if (!eraseResult?.ok) {
      const isNotFound = eraseResult?.error === 'not_found'
      return new Response(
        JSON.stringify({ ok: false, error: eraseResult?.error ?? 'unknown' }),
        { status: isNotFound ? 404 : 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const profileId = eraseResult.profile_id

    // Auth deletion removed — Server Action handles session invalidation via signOut()
    // Middleware will verify session on next request and redirect to login if user is deleted

    return new Response(
      JSON.stringify({ ok: true, erased: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (err) {
    console.error('[erase-cascade] Unexpected error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: 'internal_error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
}

// Supabase Edge Functions entry point — only active in Deno runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).Deno !== 'undefined') {
  Deno.serve(handler)
}
