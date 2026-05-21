import { Download, Trash2, Edit, Lock, XCircle, Users } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

interface DireitosTokenPageProps {
  params: Promise<{ token: string }>
}

interface TokenValidationResponse {
  valid: boolean
  playerId?: string
  parentEmail?: string
  playerName?: string
  reason?: string
}

const rights = [
  {
    id: 'export',
    icon: Download,
    title: 'Exportar os meus dados',
    description: 'Descarrega uma cópia dos teus dados',
    href: (token: string) => `/direitos/${token}/exportar`,
  },
  {
    id: 'erase',
    icon: Trash2,
    title: 'Apagar os meus dados',
    description: 'Solicita o apagamento de todos os teus dados',
    href: (token: string) => `/direitos/${token}/apagar`,
  },
  {
    id: 'rectify',
    icon: Edit,
    title: 'Retificar dados pessoais',
    description: 'Pede correção a dados teus',
    href: (token: string) => `/direitos/${token}/retificar`,
  },
  {
    id: 'restrict',
    icon: Lock,
    title: 'Limitar tratamento',
    description: 'Pausa a recolha de novos dados',
    href: (token: string) => `/direitos/${token}/limitar`,
  },
  {
    id: 'withdraw',
    icon: XCircle,
    title: 'Retirar consentimento',
    description: 'Remove o teu consentimento — sem volta atrás',
    href: (token: string) => `/direitos/${token}/retirar`,
  },
]

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

export default async function DireitosTokenPage({
  params,
}: DireitosTokenPageProps) {
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

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav
        className="hidden lg:block text-sm text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground">
              Início
            </Link>
          </li>
          <li className="text-muted-foreground">/</li>
          <li className="text-foreground font-medium">Os meus direitos</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Os meus direitos RGPD</h1>
        <p className="text-muted-foreground text-lg">
          Exercer os teus direitos sob a regulamentação RGPD.
        </p>
      </div>

      {/* Grid of rights cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {rights.map((right) => {
          const Icon = right.icon
          return (
            <Link key={right.id} href={right.href(token)} className="group">
              <div className="bg-surface-secondary border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="flex gap-4">
                  <Icon className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-2">
                      {right.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {right.description}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="text-accent hover:text-accent hover:bg-accent/10"
                    >
                      <span>Continuar</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
