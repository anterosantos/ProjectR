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
import { restrictProcessingByToken, unrestrictProcessingByToken } from '@/lib/actions/data-rights'

interface LimitarTokenClientProps {
  token: string
  playerName: string
  initialRestricted: boolean
}

type State = 'idle' | 'loading' | 'success-on' | 'success-off' | 'error' | 'cooldown'

export function LimitarTokenClient({ token, playerName, initialRestricted }: LimitarTokenClientProps) {
  const [restricted, setRestricted] = useState(initialRestricted)
  const [state, setState] = useState<State>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [isRestrictDialogOpen, setIsRestrictDialogOpen] = useState(false)
  const [isUnrestrictDialogOpen, setIsUnrestrictDialogOpen] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const pendingRequestRef = useRef<Promise<any> | null>(null)

  const isLoading = state === 'loading'
  const isCoolingDown = state === 'cooldown' && cooldownSeconds > 0

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (state === 'error') {
      const timer = setTimeout(() => setState('idle'), 5000)
      return () => clearTimeout(timer)
    }
  }, [state])

  // Cooldown timer (5 seconds after successful toggle)
  useEffect(() => {
    if (state !== 'cooldown') return
    if (cooldownSeconds === 0) {
      setTimeout(() => setState('idle'), 0)
      return
    }
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => setCooldownSeconds(s => s - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [state, cooldownSeconds])

  // Cleanup dialogs on unmount
  useEffect(() => {
    return () => {
      setIsRestrictDialogOpen(false)
      setIsUnrestrictDialogOpen(false)
    }
  }, [])

  async function handleRestrict() {
    if (pendingRequestRef.current) return
    if (isCoolingDown) return

    setState('loading')
    setErrorMessage('')

    try {
      pendingRequestRef.current = restrictProcessingByToken(token)
      const result = await pendingRequestRef.current

      if (!result.ok) {
        setErrorMessage(result.error.message ?? 'Algo correu mal. Tenta novamente.')
        setState('error')
        setIsRestrictDialogOpen(false)
        return
      }

      setRestricted(true)
      setIsRestrictDialogOpen(false)
      setState('success-on')

      // Start 5-second cooldown after success
      setTimeout(() => {
        setCooldownSeconds(5)
        setState('cooldown')
      }, 2000)
    } finally {
      pendingRequestRef.current = null
    }
  }

  async function handleUnrestrict() {
    if (pendingRequestRef.current) return
    if (isCoolingDown) return

    setState('loading')
    setErrorMessage('')

    try {
      pendingRequestRef.current = unrestrictProcessingByToken(token)
      const result = await pendingRequestRef.current

      if (!result.ok) {
        setErrorMessage(result.error.message ?? 'Algo correu mal. Tenta novamente.')
        setState('error')
        setIsUnrestrictDialogOpen(false)
        return
      }

      setRestricted(false)
      setIsUnrestrictDialogOpen(false)
      setState('success-off')

      // Start 5-second cooldown after success
      setTimeout(() => {
        setCooldownSeconds(5)
        setState('cooldown')
      }, 2000)
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
        message="Limitação removida. Os dados voltam a ser processados normalmente."
        onDismiss={() => setState('idle')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Limitar tratamento de {playerName}</h1>
        <p className="text-muted-foreground">
          Pausa a recolha de novos dados enquanto o histórico é preservado (RGPD Art. 18).
        </p>
      </div>

      {restricted ? (
        <div
          className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"
          role="status"
        >
          <p className="font-medium">Tratamento de {playerName} está actualmente limitado.</p>
          <p className="mt-1">Não estão a ser recolhidos novos dados.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>
            Ao limitar o tratamento, o SPARTA deixa de recolher novos dados de {playerName}.
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
          disabled={isLoading || isCoolingDown}
          aria-busy={isLoading}
          title={isCoolingDown ? `Aguardar ${cooldownSeconds}s antes da próxima ação` : ''}
        >
          {isCoolingDown ? `Aguardar ${cooldownSeconds}s` : 'Remover limitação'}
        </Button>
      ) : (
        <Button
          variant="destructive"
          onClick={() => setIsRestrictDialogOpen(true)}
          disabled={isLoading || isCoolingDown}
          aria-busy={isLoading}
          title={isCoolingDown ? `Aguardar ${cooldownSeconds}s antes da próxima ação` : ''}
        >
          {isCoolingDown ? `Aguardar ${cooldownSeconds}s` : `Limitar tratamento de ${playerName}`}
        </Button>
      )}

      {/* Dialog — activar limitação */}
      <Dialog open={isRestrictDialogOpen} onOpenChange={setIsRestrictDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limitar tratamento de {playerName}?</DialogTitle>
            <DialogDescription>
              O SPARTA deixa de recolher novos dados de {playerName}. O histórico existente é mantido.
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
            <DialogTitle>Remover limitação de {playerName}?</DialogTitle>
            <DialogDescription>
              Os dados de {playerName} voltarão a ser processados normalmente pelo SPARTA.
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
