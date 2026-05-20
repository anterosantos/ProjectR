import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default async function SubjectRightsLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: player, error } = await supabase
    .from('players')
    .select('age_group')
    .eq('profile_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (expected for non-player users like staff)
    console.error('Failed to query player age_group', { code: error.code })
  }

  // AC #3: players <16 see EmptyState, not the rights hub
  if (player?.age_group && ['u14', 'u15'].includes(player.age_group)) {
    return (
      <div className="flex flex-col gap-8 p-4 lg:p-6">
        <EmptyState
          icon={<Users className="w-8 h-8 text-muted-foreground" />}
          title="Os teus direitos estão com o teu encarregado"
          description="As tuas opções estão com o teu encarregado de educação. Pede-lhe para abrir o email mais recente da Project R."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Breadcrumb for desktop */}
      <nav
        className="hidden lg:block px-4 py-3 text-sm text-muted-foreground border-b"
        aria-label="Breadcrumb"
      >
        <ol className="flex items-center gap-2">
          <li>
            <a href="/configuracoes" className="hover:text-foreground">
              Configurações
            </a>
          </li>
          <li className="text-muted-foreground">/</li>
          <li className="text-foreground font-medium">Os meus direitos</li>
        </ol>
      </nav>

      {children}
    </div>
  )
}
