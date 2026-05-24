import { Suspense } from 'react'
import { StickyHeader } from '@/components/patterns/StickyHeader'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NotificationSettingsForm } from './notification-settings-form'

export const metadata = {
  title: 'Definições de Notificações do Clube',
}

export default async function NotificacoesClubeStaffPage() {
  // Ensure staff role (done by (staff) layout, but double-check for safety)
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role || !['coach', 'analyst'].includes(profile.role)) {
    redirect('/hoje')
  }

  return (
    <main id="main-content" className="px-4 py-6 sm:px-6">
      <StickyHeader
        title="Notificações do Clube"
        backHref="/prontidao"
      />
      <div className="mx-auto max-w-2xl space-y-6 pt-6">
        <Suspense
          fallback={
            <div className="py-8 text-center text-sm text-muted-foreground">
              A carregar definições...
            </div>
          }
        >
          <NotificationSettingsForm />
        </Suspense>
      </div>
    </main>
  )
}
