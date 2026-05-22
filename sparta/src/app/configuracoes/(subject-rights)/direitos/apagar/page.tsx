import { redirect } from 'next/navigation'
import Link from 'next/link'
import { XCircle } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui/empty-state'
import { ApagarAuthClient } from './_components/apagar-auth-client'

export default async function ApagarPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is a minor without active parental consent (UX guard — security enforced by action)
  // Guard for test compatibility: redirect() mock doesn't throw, so user may be null at runtime in tests
  const { data: player } = user ? await supabase
    .from('players')
    .select('id, birthdate')
    .eq('profile_id', user.id)
    .maybeSingle() : { data: null }

  if (player) {
    const dob = player.birthdate as string | null
    if (dob) {
      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - 16)
      const isMinor = new Date(dob) > cutoff

      if (isMinor) {
        const { data: consent } = await supabase
          .from('parental_consents')
          .select('id, confirmed_at')
          .eq('player_id', player.id)
          .not('confirmed_at', 'is', null)
          .maybeSingle()

        if (!consent) {
          return (
            <div className="flex items-center justify-center min-h-screen p-4">
              <EmptyState
                icon={<XCircle className="w-8 h-8 text-muted-foreground" />}
                title="Ação não disponível"
                description="Menor não pode apagar dados sem mediação de Encarregado de Educação."
              />
            </div>
          )
        }
      }
    }
  }

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6 max-w-2xl mx-auto">
      {/* Breadcrumb */}
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
          <li className="text-foreground font-medium">Apagar dados</li>
        </ol>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Apagar os meus dados — Ação irreversível</h1>
        <p className="text-muted-foreground">
          Solicita o apagamento de todos os teus dados pessoais do SPARTA, conforme previsto no RGPD Art. 17.
        </p>
      </div>

      <ApagarAuthClient />
    </div>
  )
}
