'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CalmConfirmation } from '@/components/ui/calm-confirmation'
import { requestDataExportByToken } from '@/lib/actions/data-rights'

type State = 'idle' | 'loading' | 'success-sync' | 'success-async' | 'error'

interface ExportarTokenClientProps {
  token: string
  playerName: string
}

export function ExportarTokenClient({ token, playerName }: ExportarTokenClientProps) {
  const [state, setState] = useState<State>('idle')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleExport() {
    setState('loading')
    const result = await requestDataExportByToken(token)
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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Exportar dados de {playerName}</h1>
        <p className="text-muted-foreground">
          Descarrega uma cópia de todos os dados pessoais de {playerName} em formato CSV, conforme previsto no RGPD Art. 20.
        </p>
      </div>

      <Button
        onClick={handleExport}
        disabled={state === 'loading'}
        aria-busy={state === 'loading'}
      >
        {state === 'loading' ? 'A preparar...' : 'Exportar dados'}
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
