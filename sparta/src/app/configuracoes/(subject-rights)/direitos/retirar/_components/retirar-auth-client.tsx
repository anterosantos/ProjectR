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
import { withdrawConsent } from '@/lib/actions/data-rights'
import { db } from '@/lib/outbox/db'

type State = 'idle' | 'loading' | 'success' | 'error'

export function RetirarAuthClient() {
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
      const result = await withdrawConsent()

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
      setTimeout(() => router.push('/login'), 1500)
    } finally {
      pendingRef.current = false
    }
  }

  if (state === 'success') {
    return (
      <CalmConfirmation
        message="Consentimento retirado. Os teus dados estão a ser apagados."
        onDismiss={() => router.push('/login')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        role="note"
      >
        Ao retirar o consentimento, os teus dados serão apagados permanentemente.
        Esta ação é irreversível e terminará o teu acesso à plataforma.
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
            <DialogTitle>Retirar consentimento?</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Os teus dados serão apagados permanentemente
              e o teu acesso à plataforma será terminado.
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
