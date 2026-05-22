import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { RetificarAuthClient } from './_components/retificar-auth-client'

export default async function RetificarPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
    return null
  }

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
          <li className="text-foreground font-medium">Retificar dados</li>
        </ol>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Retificar dados pessoais</h1>
        <p className="text-muted-foreground">
          Pede a correção de dados teus que possam estar incorretos. O staff responde em até 7 dias.
        </p>
      </div>

      <RetificarAuthClient />
    </div>
  )
}
