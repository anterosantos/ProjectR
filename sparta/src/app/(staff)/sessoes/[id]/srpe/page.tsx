import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StickyHeader } from '@/components/patterns/StickyHeader'
import { SrpePanel } from './srpe-panel'
import { getSessionSrpeData } from '@/lib/actions/session-srpe'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SrpePage({ params }: PageProps) {
  const { id: sessionId } = await params

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, club_id')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.club_id || (profile.role !== 'coach' && profile.role !== 'analyst')) {
    redirect('/login')
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('id, club_id, type, scheduled_at, duration_min')
    .eq('id', sessionId)
    .eq('club_id', profile.club_id)
    .single()

  if (!session) {
    redirect('/sessoes')
  }

  const dataResult = await getSessionSrpeData(sessionId)
  const { players, duration_min } = dataResult.ok
    ? dataResult.data
    : { players: [], duration_min: session.duration_min ?? 90 }

  return (
    <main id="main-content" className="flex flex-col min-h-screen">
      <StickyHeader title="Registar sRPE" backHref={`/sessoes/${sessionId}`} />
      <p className="text-sm text-muted-foreground px-4 pt-2">
        Duração da sessão: <strong>{duration_min} min</strong>
      </p>
      <SrpePanel players={players} sessionId={sessionId} durationMin={duration_min} />
    </main>
  )
}
