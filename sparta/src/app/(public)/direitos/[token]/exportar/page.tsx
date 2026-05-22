import { XCircle } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { ExportarTokenClient } from './_components/exportar-token-client'

interface ExportarTokenPageProps {
  params: Promise<{ token: string }>
}

interface TokenValidationResponse {
  valid: boolean
  playerId?: string
  playerName?: string
  reason?: string
}

async function validateToken(token: string): Promise<TokenValidationResponse> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing required env vars for token validation')
      return { valid: false, reason: 'internal_error' }
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/validate-subject-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
        body: JSON.stringify({ token }),
      }
    )

    if (!response.ok) {
      console.error('Token validation request failed', { status: response.status })
      return { valid: false, reason: 'internal_error' }
    }

    const data: TokenValidationResponse = await response.json()
    return data
  } catch (error) {
    console.error('Token validation error:', error)
    return { valid: false, reason: 'internal_error' }
  }
}

export default async function ExportarTokenPage({ params }: ExportarTokenPageProps) {
  const { token } = await params
  const validation = await validateToken(token)

  if (!validation.valid) {
    const isExpired = validation.reason === 'expired'
    const isInfraError = validation.reason === 'internal_error'

    const errorTitle = isExpired ? 'Link expirado' : 'Link inválido'
    const errorDescription = isExpired
      ? 'Este link expirou. Pede um novo ao staff de SPARTA.'
      : isInfraError
        ? 'Não foi possível verificar o link. Tenta novamente mais tarde.'
        : 'Este link não é válido.'

    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <EmptyState
          icon={<XCircle className="w-8 h-8 text-muted-foreground" />}
          title={errorTitle}
          description={errorDescription}
        />
      </div>
    )
  }

  const playerName = validation.playerName ?? 'Jogador'

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6 max-w-2xl mx-auto">
      <nav
        className="hidden lg:block text-sm text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <ol className="flex items-center gap-2">
          <li>Início</li>
          <li className="text-muted-foreground">/</li>
          <li>Os meus direitos</li>
          <li className="text-muted-foreground">/</li>
          <li className="text-foreground font-medium">Exportar</li>
        </ol>
      </nav>
      <ExportarTokenClient token={token} playerName={playerName} />
    </div>
  )
}
