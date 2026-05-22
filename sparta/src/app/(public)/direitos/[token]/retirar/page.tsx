import { XCircle } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { RetirarTokenClient } from './_components/retirar-token-client'
import { validateToken } from '@/lib/actions/data-rights'

interface RetirarTokenPageProps {
  params: Promise<{ token: string }>
}

export default async function RetirarTokenPage({ params }: RetirarTokenPageProps) {
  const { token } = await params
  const validationResult = await validateToken(token)

  if (!validationResult.ok || !validationResult.data.playerId) {
    const isTimeout = validationResult.ok === false && validationResult.error.code === 'token_validation_timeout'
    const isInfraError = validationResult.ok === false && validationResult.error.code === 'internal'

    const errorTitle = isTimeout ? 'Tempo limite' : 'Link inválido'
    const errorDescription = isTimeout
      ? 'A validação demorou muito tempo. Tenta novamente.'
      : isInfraError
        ? 'Não foi possível verificar o link. Tenta novamente mais tarde.'
        : 'Este link não é válido ou expirou.'

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

  const playerName = validationResult.data.playerName ?? 'Jogador'

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6 max-w-2xl mx-auto">
      <RetirarTokenClient token={token} playerName={playerName} />
    </div>
  )
}
