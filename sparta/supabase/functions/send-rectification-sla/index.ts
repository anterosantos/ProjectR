// Type stub for Deno runtime — allows import in Node/Vitest without @deno/types package
declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

import { createClient } from '@supabase/supabase-js'

const UUID_PATTERN = /^[0-9a-f-]{36}$/i

interface PendingRequest {
  player_id: string
  field_name: string
  created_at: string
}

interface PlayerRow {
  full_name: string
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const brevoApiKey = Deno.env.get('BREVO_API_KEY')
  const brevoSenderEmail = Deno.env.get('BREVO_SENDER_EMAIL')

  if (!supabaseUrl || !supabaseServiceRoleKey || !brevoApiKey || !brevoSenderEmail) {
    console.error('[send-rectification-sla] Missing required environment variables')
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

  let body: { clubId?: unknown }
  try {
    body = await req.json() as { clubId?: unknown }
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'invalid_json' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const { clubId } = body

  if (!clubId || typeof clubId !== 'string' || !UUID_PATTERN.test(clubId)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'invalid_club_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Pedidos pendentes há ≥7 dias para este clube
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: pendingRequests, error: reqError } = await supabase
      .from('rectification_requests')
      .select('player_id, field_name, created_at')
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .lte('created_at', sevenDaysAgo.toISOString())

    if (reqError) {
      console.error('[send-rectification-sla] DB error fetching requests:', reqError.message)
      return new Response(
        JSON.stringify({ ok: false, error: 'db_error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: false }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const requests = pendingRequests as PendingRequest[]

    // Obter nomes dos jogadores
    const playerIds = [...new Set(requests.map(r => r.player_id))]
    const { data: players } = await supabase
      .from('players')
      .select('id, full_name')
      .in('id', playerIds)

    const playerMap = new Map<string, string>()
    if (players) {
      for (const p of players as Array<{ id: string } & PlayerRow>) {
        playerMap.set(p.id, p.full_name)
      }
    }

    // Obter emails de staff (coach e analyst) do clube
    const { data: staffProfiles } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('club_id', clubId)
      .in('role', ['coach', 'analyst'])

    if (!staffProfiles || staffProfiles.length === 0) {
      console.warn('[send-rectification-sla] No staff found for club', clubId)
      return new Response(
        JSON.stringify({ ok: true, sent: false, reason: 'no_staff' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const staffProfileIds = (staffProfiles as Array<{ id: string; role: string }>).map(p => p.id)

    // Obter emails via getUserById (evita listUsers sem paginação)
    const staffEmails: string[] = []
    for (const profileId of staffProfileIds) {
      const { data: authUserData } = await supabase.auth.admin.getUserById(profileId)
      if (authUserData?.user?.email) {
        staffEmails.push(authUserData.user.email)
      }
    }

    if (staffEmails.length === 0) {
      console.warn('[send-rectification-sla] No staff emails found for club', clubId)
      return new Response(
        JSON.stringify({ ok: true, sent: false, reason: 'no_staff_emails' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const FIELD_LABELS: Record<string, string> = {
      full_name: 'Nome completo',
      birthdate: 'Data de nascimento',
      jersey_num: 'Número de camisola',
    }

    const requestLines = requests.map(r => {
      const playerName = playerMap.get(r.player_id) ?? 'Jogador desconhecido'
      const fieldLabel = FIELD_LABELS[r.field_name] ?? r.field_name
      const daysPending = Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24))
      return `<li>${playerName} — ${fieldLabel} (${daysPending} dias em espera)</li>`
    }).join('')

    const pendingUrl = `${appUrl}/configuracoes/direitos-pendentes`

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="UTF-8"><title>Pedidos de retificação em atraso</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#171717;">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:16px;">Pedidos de retificação aguardam resposta</h1>
  <p style="font-size:14px;line-height:1.6;margin-bottom:16px;">
    Os seguintes pedidos de retificação de dados pessoais têm mais de 7 dias sem resposta.
    O prazo legal (RGPD Art. 16) é de 7 dias.
  </p>
  <ul style="font-size:14px;line-height:1.8;margin-bottom:24px;">
    ${requestLines}
  </ul>
  <a href="${pendingUrl}"
     style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
    Ver pedidos pendentes
  </a>
  <hr style="border:none;border-top:1px solid #E5E5E5;margin:24px 0;">
  <p style="font-size:11px;color:#A3A3A3;">SPARTA — Gestão desportiva</p>
</body>
</html>`

    // Enviar um email para cada membro do staff
    let emailsSent = 0
    for (const staffEmail of staffEmails) {
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'SPARTA', email: brevoSenderEmail },
          to: [{ email: staffEmail }],
          subject: '[SPARTA] Pedidos de retificação aguardam resposta — 7 dias',
          htmlContent,
        }),
      })

      if (!brevoRes.ok) {
        const errBody = await brevoRes.text()
        console.error('[send-rectification-sla] Brevo error for', staffEmail, ':', errBody)
      } else {
        emailsSent++
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: true, count: requests.length, emailsSent }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    console.error('[send-rectification-sla] Unexpected error:', error)
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
