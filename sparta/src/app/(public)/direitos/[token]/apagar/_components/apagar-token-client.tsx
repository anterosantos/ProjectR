'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CalmConfirmation } from '@/components/ui/calm-confirmation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { requestDataErasureByToken } from '@/lib/actions/data-rights'

const CONFIRMATION_PHRASE = 'Confirmo o apagamento'

type State = 'idle' | 'confirmation-pending' | 'loading' | 'success' | 'error'

interface ApagarTokenClientProps {
  token: string
  playerName: string
}

export function ApagarTokenClient({ token, playerName }: ApagarTokenClientProps) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when dialog opens
  useEffect(() => {
    if (state === 'confirmation-pending') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [state])

  const isConfirmed = inputValue === CONFIRMATION_PHRASE

  function openDialog() {
    setInputValue('')
    setState('confirmation-pending')
  }

  function closeDialog() {
    setInputValue('')
    setState('idle')
  }

  async function handleErase() {
    if (!isConfirmed || state === 'loading') return // Guard against multiple clicks
    setState('loading')
    const result = await requestDataErasureByToken(token)
    if (!result.ok) {
      setState('error')
      return
    }
    setState('success')
  }

  function handleSuccessDismiss() {
    router.push(`/direitos/${token}`)
  }

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Apagar dados de {playerName} — Ação irreversível</h1>
        <p className="text-muted-foreground">
          Solicita o apagamento de todos os dados pessoais de {playerName} do SPARTA, conforme previsto no RGPD Art. 17.
        </p>
      </div>

      {/* Warning panel */}
      {(state === 'idle' || state === 'error') && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive"
            role="alert"
          >
            <p className="font-semibold mb-1">Esta ação é irreversível</p>
            <p className="text-sm">
              Esta ação vai apagar TODOS os dados de {playerName}. Não podes desfazer isto.
            </p>
          </div>

          {state === 'error' && (
            <div
              className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm"
              role="alert"
            >
              Algo correu mal. Por favor tenta mais tarde ou contacta o staff.
            </div>
          )}

          <Button
            variant="destructive"
            onClick={openDialog}
          >
            Apagar os dados de {playerName}
          </Button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={state === 'confirmation-pending' || state === 'loading'} onOpenChange={(open) => { if (!open && state === 'confirmation-pending') closeDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tem a certeza?</DialogTitle>
            <DialogDescription>
              Para apagar os dados de {playerName}, escreve:{' '}
              <strong className="text-foreground">{CONFIRMATION_PHRASE}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Escreve aqui"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              aria-label={`Escreve '${CONFIRMATION_PHRASE}' para confirmar`}
              disabled={state === 'loading'}
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={closeDialog}
              disabled={state === 'loading'}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleErase}
              disabled={!isConfirmed || state === 'loading'}
              aria-disabled={!isConfirmed || state === 'loading'}
              aria-busy={state === 'loading'}
            >
              {state === 'loading' ? 'A processar apagamento...' : 'Apagar para sempre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success: calm confirmation + redirect to token hub */}
      {state === 'success' && (
        <CalmConfirmation
          message={`Os dados de ${playerName} foram apagados.`}
          duration={2500}
          onDismiss={handleSuccessDismiss}
        />
      )}
    </div>
  )
}
