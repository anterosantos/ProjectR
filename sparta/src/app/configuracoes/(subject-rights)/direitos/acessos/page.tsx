import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getAuditLogForSubject } from '@/lib/actions/audit-visibility'
import { requestDataExportForSelf } from '@/lib/actions/data-rights'
import { AuditLogListClient } from './_components/audit-log-list-client'

export default async function AcessosPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const PAGE_SIZE = 50
  const result = await getAuditLogForSubject(user.id, 1, PAGE_SIZE)

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
          <li>Configurações</li>
          <li>/</li>
          <li>Os meus direitos</li>
          <li>/</li>
          <li className="text-foreground font-medium">Acessos</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Quem consultou os teus dados?</h1>
        <p className="text-muted-foreground text-sm">
          Registos dos últimos 12 meses. Apenas acessos a dados de saúde.
        </p>
      </header>

      <main id="main-content">
        <AuditLogListClient
          initialData={initialData}
          subjectId={user.id}
          pageSize={PAGE_SIZE}
          exportAction={requestDataExportForSelf}
        />
      </main>
    </div>
  )
}
