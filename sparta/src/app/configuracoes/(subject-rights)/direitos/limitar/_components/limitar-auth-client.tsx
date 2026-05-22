'use client'

import { useEffect, useRef, useState } from 'react'
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
import { restrictProcessing, unrestrictProcessing, type RestrictionResult } from '@/lib/actions/data-rights'
import type { Result, AppError } from '@/lib/types'

interface LimitarAuthClientProps {
  initialRestricted: boolean
  initialRestrictedAt: string | null
}

type State = 'idle' | 'loading' | 'success-on' | 'success-off' | 'error'

function formatDate(iso: string | null, locale: string = 'pt-PT'): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function LimitarAuthClient({ initialRestricted, initialRestrictedAt }: LimitarAuthClientProps) {
  const locale = 'pt-PT'
  const [restricted, setRestricted] = useState(initialRestricted)
  const [restrictedAt, setRestrictedAt] = useState(initialRestrictedAt)
  const [state, setState] = useState<State>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [isRestrictDialogOpen, setIsRestrictDialogOpen] = useState(false)
  const [isUnrestrictDialogOpen, setIsUnrestrictDialogOpen] = useState(false)
  const pendingRequestRef = useRef<Promise<Result<RestrictionResult, AppError>> | null>(null)

  const isLoading = state === 'loading'

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (state === 'error') {
      const timer = setTimeout(() => setState('idle'), 5000)
      return () => clearTimeout(timer)
    }
  }, [state])

  // Cleanup dialogs on unmount
  useEffect(() => {
    return () => {
      setIsRestrictDialogOpen(false)
      setIsUnrestrictDialogOpen(false)
    }
  }, [])

  async function handleRestrict() {
    // Prevent race condition: ignore if request already pending
    if (pendingRequestRef.current) return

    setState('loading')
    setErrorMessage('')

    try {
      pendingRequestRef.current = restrictProcessing()
      const result = await pendingRequestRef.current

      if (!result.ok) {
        setErrorMessage(result.error.message ?? 'Algo correu mal. Tenta novamente.')
        setState('error')
        setIsRestrictDialogOpen(false)
        return
      }

      // Use server state instead of optimistic timestamp
      setRestricted(true)
      setRestrictedAt(result.data.restrictedAt ?? new Date().toISOString())
      setIsRestrictDialogOpen(false)
      setState('success-on')
    } finally {
      pendingRequestRef.current = null
    }
  }

  async function handleUnrestrict() {
    // Prevent race condition: ignore if request already pending
    if (pendingRequestRef.current) return

    setState('loading')
    setErrorMessage('')

    try {
      pendingRequestRef.current = unrestrictProcessing()
      const result = await pendingRequestRef.current

      if (!result.ok) {
        setErrorMessage(result.error.message ?? 'Algo correu mal. Tenta novamente.')
        setState('error')
        setIsUnrestrictDialogOpen(false)
        return
      }

      setRestricted(false)
      setRestrictedAt(null)
      setIsUnrestrictDialogOpen(false)
      setState('success-off')
    } finally {
      pendingRequestRef.current = null
    }
  }

  if (state === 'success-on') {
    return (
      <CalmConfirmation
        message="Tratamento limitado a partir de agora. O histórico foi preservado."
        onDismiss={() => setState('idle')}
      />
    )
  }

  if (state === 'success-off') {
    return (
      <CalmConfirmation
        message="Limitação removida. Os teus dados voltam a ser processados normalmente."
        onDismiss={() => setState('idle')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      {restricted ? (
        <div
          className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"
          role="status"
        >
          <p className="font-medium">Tratamento limitado{restrictedAt ? ` desde ${formatDate(restrictedAt, locale)}` : ''}.</p>
          <p className="mt-1">Não estão a ser recolhidos novos dados para a tua conta.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>
            Ao limitar o tratamento, o SPARTA deixa de recolher novos dados teus.
            O histórico existente é mantido. Podes remover esta limitação a qualquer momento.
          </p>
        </div>
      )}

      {state === 'error' && (
        <div
          role="alert"
          className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm"
        >
          {errorMessage}
        </div>
      )}

      {restricted ? (
        <Button
          variant="ghost"
          onClick={() => setIsUnrestrictDialogOpen(true)}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          Remover limitação
        </Button>
      ) : (
        <Button
          variant="destructive"
          onClick={() => setIsRestrictDialogOpen(true)}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          Limitar o meu tratamento
        </Button>
      )}

      {/* Dialog — activar limitação */}
      <Dialog open={isRestrictDialogOpen} onOpenChange={setIsRestrictDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limitar tratamento?</DialogTitle>
            <DialogDescription>
              O SPARTA deixa de recolher novos dados teus. O histórico existente é mantido.
              Podes remover esta limitação a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsRestrictDialogOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestrict}
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? 'A processar...' : 'Confirmar limitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — remover limitação */}
      <Dialog open={isUnrestrictDialogOpen} onOpenChange={setIsUnrestrictDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover limitação?</DialogTitle>
            <DialogDescription>
              Os teus dados voltarão a ser processados normalmente pelo SPARTA.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsUnrestrictDialogOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUnrestrict}
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? 'A processar...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
