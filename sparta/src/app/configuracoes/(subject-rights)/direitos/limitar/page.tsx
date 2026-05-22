import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { getRestrictionStatus } from '@/lib/actions/data-rights'
import { LimitarAuthClient } from './_components/limitar-auth-client'

export default async function LimitarPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
    return null
  }

  const restrictionResult = await getRestrictionStatus()
  const restricted = restrictionResult.ok ? restrictionResult.data.restricted : false
  const restrictedAt = restrictionResult.ok ? restrictionResult.data.restrictedAt : null

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6 max-w-2xl mx-auto">
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
          <li>
            <Link href="/configuracoes/direitos" className="hover:text-foreground">
              Os meus direitos
            </Link>
          </li>
          <li className="text-muted-foreground">/</li>
          <li className="text-foreground font-medium">Limitar tratamento</li>
        </ol>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Limitar tratamento de dados</h1>
        <p className="text-muted-foreground">
          Pausa a recolha de novos dados enquanto o histórico é preservado (RGPD Art. 18).
        </p>
      </div>

      <LimitarAuthClient initialRestricted={restricted} initialRestrictedAt={restrictedAt} />
    </div>
  )
}
