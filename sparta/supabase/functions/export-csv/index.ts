// Type stub for Deno runtime — allows import in Node/Vitest without @deno/types package
declare const Deno: {
  env: { get(key: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'

const UUID_PATTERN = /^[0-9a-f-]{36}$/i

// Whitelist of columns safe to export (excludes internal/sensitive fields)
const COLUMN_WHITELIST: Record<string, string[]> = {
  profiles: ['id', 'email', 'full_name', 'avatar_url', 'updated_at'],
  players: ['id', 'profile_id', 'full_name', 'date_of_birth', 'gender', 'position', 'shirt_number', 'status', 'created_at', 'updated_at'],
  player_metrics: ['id', 'player_id', 'recorded_at', 'weight_kg', 'height_cm', 'created_at'],
  parental_consents: ['id', 'player_id', 'guardian_email', 'confirmed_at', 'created_at'],
  match_lineups: ['id', 'player_id', 'match_id', 'position', 'shirt_number', 'status'],
  audit_logs: ['id', 'action', 'actor_id', 'target_kind', 'target_id', 'reason', 'created_at'],
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0] ?? {})
  const escape = (v: unknown): string => {
    const s = String(v ?? '')
    let escaped = s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
    // Escape formula injection: prefix dangerous characters with single quote
    if (escaped.match(/^[=@+\-]/)) {
      escaped = `'${escaped}`
    }
    return escaped
  }
  return [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(','))
  ].join('\n')
}

export function headersOnlyCsv(columns: string[]): string {
  return columns.join(',')
}

function getSelectColumns(tableName: string): string {
  return COLUMN_WHITELIST[tableName]?.join(',') ?? '*'
}

function buildReadme(playerName: string, includedTables: string[], isLargeExport = false): string {
  const lines = includedTables.map(t => `- ${t}.csv`)
  const largeExportWarning = isLargeExport
    ? '\n\n⚠️  AVISO: Este ficheiro é muito grande. O link para download foi enviado por email e é válido durante 7 dias.'
    : ''

  return `Exportação de dados pessoais — SPARTA
Data: ${new Date().toISOString()}
Jogador: ${playerName}

Este ficheiro contém os seus dados pessoais em formato CSV.

Ficheiros incluídos:
${lines.join('\n')}

Para questões, contacte o staff de SPARTA.${largeExportWarning}`
}

function exportEmailHtml(signedUrl: string): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head><meta charset="UTF-8"><title>Exportação pronta</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#171717;">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:16px;">A tua exportação está pronta — SPARTA</h1>
  <p style="font-size:14px;line-height:1.6;margin-bottom:16px;">
    Os teus dados pessoais foram exportados com sucesso e estão disponíveis para download.
    O link é válido durante 7 dias.
  </p>
  <a href="${signedUrl}"
     style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
    Descarregar ficheiro
  </a>
  <p style="font-size:12px;color:#737373;margin-top:24px;">
    Aviso: Este link expira em 7 dias. Após essa data, será necessário solicitar uma nova exportação.
  </p>
  <hr style="border:none;border-top:1px solid #E5E5E5;margin:24px 0;">
  <p style="font-size:11px;color:#A3A3A3;">SPARTA · Gestão desportiva</p>
</body>
</html>`

  const text = `A tua exportação está pronta — SPARTA

Os teus dados pessoais foram exportados e estão disponíveis para download durante 7 dias:

${signedUrl}

Aviso: Este link expira em 7 dias. Após essa data, será necessário solicitar uma nova exportação.`

  return { html, text }
}

export async function handler(req: Request): Promise<Response> {
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000'
  const corsHeaders = {
    'Access-Control-Allow-Origin': appUrl,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let body: { playerId?: unknown }
    try {
      body = await req.json() as { playerId?: unknown }
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_json' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const { playerId } = body
    if (!playerId || typeof playerId !== 'string' || !UUID_PATTERN.test(playerId)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_player_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const brevoSenderEmail = Deno.env.get('BREVO_SENDER_EMAIL')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[export-csv] Missing Supabase credentials')
      return new Response(
        JSON.stringify({ ok: false, error: 'internal_error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Fetch player name and email for README and Brevo
    const { data: playerRow } = await supabase
      .from('players')
      .select('id, full_name, profile_id')
      .eq('id', playerId)
      .maybeSingle()
    const playerName = playerRow?.full_name ?? playerId

    // Fetch player email from profiles table
    let playerEmail: string | null = null
    if (playerRow?.profile_id) {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', playerRow.profile_id)
        .maybeSingle()
      playerEmail = profileRow?.email ?? null
    }

    const zip = new JSZip()
    const includedTables: string[] = []

    // Tables with player_id FK (confirmed to exist)
    const tablesWithPlayerId: string[] = [
      'player_metrics',
      'parental_consents',
    ]

    // Helper to safely cast and validate data is array
    function safeRowsCsv(data: unknown, tableName: string): string {
      if (!Array.isArray(data)) {
        console.warn(`[export-csv] ${tableName} returned non-array — skipping`)
        return ''
      }
      return rowsToCsv(data as Record<string, unknown>[])
    }

    // profiles uses id directly
    {
      const { data, error } = await supabase
        .from('profiles')
        .select(getSelectColumns('profiles'))
        .eq('id', playerId)
      if (!error && data) {
        const csv = safeRowsCsv(data, 'profiles')
        if (csv) {
          zip.file('profiles.csv', csv)
          includedTables.push('profiles')
        }
      } else if (error) {
        console.warn('[export-csv] tabela profiles não disponível — omitindo CSV')
      }
    }

    // players uses id directly
    {
      const { data, error } = await supabase
        .from('players')
        .select(getSelectColumns('players'))
        .eq('id', playerId)
      if (!error && data) {
        const csv = safeRowsCsv(data, 'players')
        if (csv) {
          zip.file('players.csv', csv)
          includedTables.push('players')
        }
      } else if (error) {
        console.warn('[export-csv] tabela players não disponível — omitindo CSV')
      }
    }

    // Tables with player_id FK (confirmed to exist)
    for (const tableName of tablesWithPlayerId) {
      const { data, error } = await supabase
        .from(tableName)
        .select(getSelectColumns(tableName))
        .eq('player_id', playerId)
      if (!error && data) {
        const csv = safeRowsCsv(data, tableName)
        if (csv) {
          zip.file(`${tableName}.csv`, csv)
          includedTables.push(tableName)
        }
      } else if (error) {
        console.warn(`[export-csv] tabela ${tableName} não disponível — omitindo CSV`)
      }
    }

    // match_lineups uses player_id (may exist from Story 2.8)
    try {
      const { data, error } = await supabase
        .from('match_lineups')
        .select(getSelectColumns('match_lineups'))
        .eq('player_id', playerId)
      if (!error && data) {
        const csv = safeRowsCsv(data, 'match_lineups')
        if (csv) {
          zip.file('match_lineups.csv', csv)
          includedTables.push('match_lineups')
        }
      }
    } catch {
      console.warn('[export-csv] tabela match_lineups não disponível — omitindo CSV')
    }

    // audit_logs uses target_id
    {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(getSelectColumns('audit_logs'))
        .eq('target_id', playerId)
      if (!error && data) {
        const csv = safeRowsCsv(data, 'audit_logs')
        if (csv) {
          zip.file('audit_logs.csv', csv)
          includedTables.push('audit_logs')
        }
      } else if (error) {
        console.warn('[export-csv] tabela audit_logs não disponível — omitindo CSV')
      }
    }

    // Optional tables from future epics — wrapped in try/catch
    const futureTablesPlayerId = [
      'fatigue_responses',
      'match_events',
      'session_metrics',
      'attendances',
      'data_decisions',
      'notification_log',
    ]

    for (const tableName of futureTablesPlayerId) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select(getSelectColumns(tableName))
          .eq('player_id', playerId)
        if (!error && data) {
          const csv = safeRowsCsv(data, tableName)
          if (csv) {
            zip.file(`${tableName}.csv`, csv)
            includedTables.push(tableName)
          }
        }
      } catch {
        console.warn(`[export-csv] tabela ${tableName} não disponível — omitindo CSV`)
      }
    }

    // Generate initial README without warning — will update if needed after size check
    let readmeText = buildReadme(playerName, includedTables, false)
    zip.file('README.txt', readmeText)

    // ZIP generation with timeout to prevent hanging on large exports
    const generatePromise = zip.generateAsync({ type: 'uint8array' })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('zip_generation_timeout')), 30000)
    )
    let zipBytes: Uint8Array
    try {
      zipBytes = await Promise.race([generatePromise, timeoutPromise])
    } catch (err) {
      if (err instanceof Error && err.message === 'zip_generation_timeout') {
        console.error('[export-csv] ZIP generation timed out after 30s')
        return new Response(
          JSON.stringify({ ok: false, error: 'zip_timeout' }),
          { status: 504, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }
      throw err
    }

    // Check if export will be async (> 5MB), and regenerate ZIP with warning if so
    const isAsync = zipBytes.length > 5 * 1024 * 1024
    if (isAsync) {
      const updatedZip = new JSZip()
      // Re-add all CSV files from existing ZIP
      for (const [path, file] of Object.entries(zip.files)) {
        if (!file.dir && !path.includes('README')) {
          const fileData = await file.async('uint8array')
          updatedZip.file(path, fileData)
        }
      }
      // Add updated README with warning
      readmeText = buildReadme(playerName, includedTables, true)
      updatedZip.file('README.txt', readmeText)
      const updatedGenerate = updatedZip.generateAsync({ type: 'uint8array' })
      const updatedTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('zip_generation_timeout')), 30000)
      )
      try {
        zipBytes = await Promise.race([updatedGenerate, updatedTimeout])
      } catch {
        // If regeneration fails, proceed with original ZIP
        console.warn('[export-csv] Failed to regenerate ZIP with warning — proceeding with original')
      }
    }
    // Cast needed: Uint8Array<ArrayBufferLike> vs Blob's expected ArrayBuffer
    const zipBlob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' })

    const path = `${playerId}/${Date.now()}-export.zip`
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(path, zipBlob, { contentType: 'application/zip', upsert: false })

    if (uploadError) {
      console.error('[export-csv] upload failed:', uploadError.message)
      return new Response(
        JSON.stringify({ ok: false, error: 'upload_failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from('exports')
      .createSignedUrl(path, 604800)

    if (signError || !signedData?.signedUrl) {
      console.error('[export-csv] signed URL failed:', signError?.message)
      return new Response(
        JSON.stringify({ ok: false, error: 'sign_failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const signedUrl = signedData.signedUrl

    // Audit log — both success and failure paths
    try {
      await supabase.from('audit_logs').insert({
        action: 'subject.exported',
        target_kind: 'player',
        target_id: playerId,
      })
    } catch (auditErr) {
      console.error('[export-csv] Failed to insert audit log:', auditErr)
      // Continue despite audit log failure — data export should not be blocked
    }

    if (isAsync) {
      // Fire-and-forget email via Brevo
      if (brevoApiKey && brevoSenderEmail && playerEmail) {
        const { html, text } = exportEmailHtml(signedUrl)
        const fetchBrevo = fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': brevoApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'SPARTA', email: brevoSenderEmail },
            to: [{ email: playerEmail }],
            subject: 'A tua exportação está pronta — SPARTA',
            htmlContent: html,
            textContent: text,
          }),
        })
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('brevo_timeout')), 8000)
        )
        // Fire-and-forget: start the email send without blocking the response
        // Errors are logged but don't affect the response
        fetchBrevo
          .then(async (brevoRes) => {
            if (!brevoRes.ok) {
              console.error('[export-csv] Brevo send failed:', brevoRes.status)
            }
          })
          .catch((e: unknown) => {
            console.error('[export-csv] Brevo fire-and-forget error:', e)
          })
      } else if (!playerEmail) {
        console.warn('[export-csv] Player email not found — skipping email notification')
      } else {
        console.warn('[export-csv] Brevo credentials missing — skipping email')
      }

      return new Response(
        JSON.stringify({ ok: true, async: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, async: false, url: signedUrl }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (err) {
    console.error('[export-csv] Unexpected error:', err)
    // Attempt to log failed export to audit trail
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && supabaseServiceRoleKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
        const body = await req.json() as { playerId?: unknown }
        const { playerId } = body
        if (playerId && typeof playerId === 'string' && UUID_PATTERN.test(playerId)) {
          await supabase.from('audit_logs').insert({
            action: 'subject.export_failed',
            target_kind: 'player',
            target_id: playerId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }).then(undefined, () => {
            // Silently fail if audit log fails — already error state
          })
        }
      }
    } catch {
      // Silently ignore — we're already in error state
    }
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
