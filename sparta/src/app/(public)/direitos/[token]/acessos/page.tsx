import { XCircle } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { getAuditLogForSubjectByToken } from '@/lib/actions/audit-visibility'
import { requestDataExportByToken, validateToken } from '@/lib/actions/data-rights'
import { AuditLogListTokenClient } from './_components/audit-log-list-token-client'

interface AcessosTokenPageProps {
  params: Promise<{ token: string }>
}

export default async function AcessosTokenPage({ params }: AcessosTokenPageProps) {
  const { token } = await params

  const validationResult = await validateToken(token)

  if (!validationResult.ok) {
    const isTimeout = validationResult.error.code === 'token_validation_timeout'

    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <EmptyState
          icon={<XCircle className="w-8 h-8 text-muted-foreground" />}
          title={isTimeout ? 'Não foi possível verificar o link' : 'Link expirado ou inválido'}
          description={
            isTimeout
              ? 'Tenta novamente mais tarde.'
              : 'Este link não é válido. Pede um novo ao staff de SPARTA.'
          }
        />
      </div>
    )
  }

  const playerName = validationResult.data.playerName ?? 'Jogador'
  const PAGE_SIZE = 50

  const result = await getAuditLogForSubjectByToken(token, 1, PAGE_SIZE)

  const initialData = result.ok
    ? result.data
    : { entries: [], actorMap: {}, totalCount: 0, hasMore: false }

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6 max-w-2xl mx-auto">
      <nav
        className="hidden lg:block text-sm text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <ol className="flex items-center gap-2">
          <li>Os meus direitos</li>
          <li>/</li>
          <li className="text-foreground font-medium">Acessos</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">
          Quem consultou os dados de {playerName}?
        </h1>
        <p className="text-muted-foreground text-sm">
          Registos dos últimos 12 meses. Apenas acessos a dados de saúde.
        </p>
      </header>

      <main id="main-content">
        <AuditLogListTokenClient
          initialData={initialData}
          token={token}
          pageSize={PAGE_SIZE}
          exportAction={requestDataExportByToken}
        />
      </main>
    </div>
  )
}
