'use client'

import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  const handleRetry = () => {
    location.reload()
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold text-text-primary">Sem ligação à internet</h1>
      <p className="text-text-secondary">
        Não conseguimos carregar esta página. Verifica a tua ligação e tenta novamente.
      </p>
      <Button onClick={handleRetry} variant="primary">
        Tentar novamente
      </Button>
    </main>
  )
}
