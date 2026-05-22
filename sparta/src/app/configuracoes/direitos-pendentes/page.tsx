import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { getPendingRectifications } from '@/lib/actions/data-rights'
import { EmptyState } from '@/components/ui/empty-state'
import { PendingRequestsList } from './_components/pending-requests-list'

export default async function DireitosPendentesPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
    return null
  }

  const result = await getPendingRectifications()

  if (!result.ok) {
    redirect('/configuracoes')
    return null
  }

  if (!result.data.isStaff) {
    redirect('/configuracoes')
    return null
  }

  const { requests } = result.data

  // Calcular banner SLA dia 5
  const fiveDaysAgo = new Date()
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

  const overdueCount = requests.filter(
    r => new Date(r.created_at) <= fiveDaysAgo
  ).length

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6 max-w-4xl mx-auto">
      <nav
        className="hidden lg:block text-sm text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/configuracoes" className="hover:text-foreground">
              Configurações
            </Link>
          </li>
          <li className="text-muted-foreground">/</li>
          <li className="text-foreground font-medium">Direitos pendentes</li>
        </ol>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Pedidos de retificação pendentes</h1>
        <p className="text-muted-foreground">
          Pedidos de correção de dados pessoais submetidos pelos titulares do clube.
        </p>
      </div>

      {overdueCount > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 text-amber-800 dark:text-amber-300 text-sm"
        >
          Existem {overdueCount} {overdueCount === 1 ? 'pedido' : 'pedidos'} de retificação com mais de 5 dias por responder.
          O prazo legal é de 7 dias (RGPD Art. 16).
        </div>
      )}

      {requests.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="w-8 h-8 text-muted-foreground" />}
          title="Sem pedidos pendentes"
          description="Não existem pedidos de retificação por processar neste momento."
        />
      ) : (
        <PendingRequestsList requests={requests} />
      )}
    </div>
  )
}
