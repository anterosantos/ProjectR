'use client'
import { useEffect, useState } from 'react'
import { registerDrainTriggers } from '@/lib/outbox/triggers'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function OutboxProvider({ children }: { children: React.ReactNode }) {
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    try {
      return registerDrainTriggers()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[outbox] Failed to register drain triggers:', message)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSyncError(message)
    }
  }, [])

  return (
    <>
      {syncError && (
        <Alert variant="destructive" className="m-4">
          <AlertTitle>Sincronização desativada</AlertTitle>
          <AlertDescription>
            Não conseguimos ativar a sincronização automática. Os teus dados offline podem não ser enviados.
          </AlertDescription>
        </Alert>
      )}
      {children}
    </>
  )
}
