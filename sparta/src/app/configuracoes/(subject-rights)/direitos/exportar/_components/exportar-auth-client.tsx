'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CalmConfirmation } from '@/components/ui/calm-confirmation'
import { requestDataExportForSelf } from '@/lib/actions/data-rights'

type State = 'idle' | 'loading' | 'success-sync' | 'success-async' | 'error'

export function ExportarAuthClient() {
  const [state, setState] = useState<State>('idle')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleExport() {
    setState('loading')
    const result = await requestDataExportForSelf()
    if (!result.ok) {
      setErrorMsg(result.error.message)
      setState('error')
      return
    }
    if (result.data.async) {
      setState('success-async')
    } else {
      setDownloadUrl(result.data.url ?? null)
      setState('success-sync')
    }
  }

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <Button
        onClick={handleExport}
        disabled={state === 'loading'}
        aria-busy={state === 'loading'}
      >
        {state === 'loading' ? 'A preparar...' : 'Exportar os meus dados'}
      </Button>

      {state === 'success-sync' && downloadUrl && (
        <div className="flex flex-col gap-2">
          <a
            href={downloadUrl}
            download
            className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2"
          >
            Descarregar ficheiro
          </a>
          <p className="text-sm text-muted-foreground">Este link expira em 7 dias.</p>
          <CalmConfirmation message="O teu ficheiro está pronto!" />
        </div>
      )}

      {state === 'success-async' && (
        <CalmConfirmation
          message="A processar — vais receber um email com o link em alguns minutos"
          duration={4000}
        />
      )}

      {state === 'error' && errorMsg && (
        <p className="text-sm text-destructive" role="alert">{errorMsg}</p>
      )}
    </div>
  )
}
