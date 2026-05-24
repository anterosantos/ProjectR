import { Suspense } from 'react'
import { StickyHeader } from '@/components/patterns/StickyHeader'
import { NotificationsSettings } from './notifications-settings'

export const metadata = {
  title: 'Notificações',
}

export default function NotificacoesPage() {
  return (
    <main id="main-content">
      <StickyHeader title="Notificações" backHref="/configuracoes" />
      <div className="px-4 py-6 sm:px-6">
        <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">A carregar...</div>}>
          <NotificationsSettings />
        </Suspense>
      </div>
    </main>
  )
}
