'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CalmConfirmation } from '@/components/ui/calm-confirmation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { withdrawConsentByToken } from '@/lib/actions/data-rights'
import { db } from '@/lib/outbox/db'

interface RetirarTokenClientProps {
  token: string
  playerName: string
}

type State = 'idle' | 'loading' | 'success' | 'error'

export function RetirarTokenClient({ token, playerName }: RetirarTokenClientProps) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const pendingRef = useRef(false)

  const isLoading = state === 'loading'

  async function handleWithdraw() {
    if (pendingRef.current) return
    pendingRef.current = true
    setState('loading')
    setErrorMessage('')

    try {
      const result = await withdrawConsentByToken(token)

      if (!result.ok) {
        setErrorMessage(result.error.message ?? 'Algo correu mal. Tenta novamente.')
        setState('error')
        setIsDialogOpen(false)
        return
      }

      try {
        await db.outbox.where('status').equals('pending').delete()
      } catch {
        // Não bloquear o fluxo se a limpeza falhar
      }

      setIsDialogOpen(false)
      setState('success')
    } finally {
      pendingRef.current = false
    }
  }

  if (state === 'success') {
    return (
      <CalmConfirmation
        message={`Consentimento de ${playerName} retirado. Os dados estão a ser apagados.`}
        onDismiss={() => router.push('/direitos')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Retirar consentimento de {playerName}</h1>
        <p className="text-muted-foreground">
          Remove o consentimento e apaga os dados permanentemente (RGPD Art. 21).
        </p>
      </div>

      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        role="note"
      >
        Ao retirar o consentimento, os dados de {playerName} serão apagados permanentemente.
        Esta ação é irreversível.
      </div>

      {state === 'error' && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm"
        >
          {errorMessage}
        </div>
      )}

      <Button
        variant="destructive"
        onClick={() => setIsDialogOpen(true)}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        Retirar consentimento
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirar consentimento de {playerName}?</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Os dados de {playerName} serão apagados permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleWithdraw}
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? 'A processar...' : 'Confirmar retirada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
