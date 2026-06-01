'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CalmConfirmation } from '@/components/ui/calm-confirmation'
import { confirmReconfirmation, eraseDataViaReconfirmation } from '@/lib/actions/reconfirmation'

type State = 'idle' | 'confirmed' | 'warn-erase' | 'erasing' | 'error'

interface Props {
  token: string
}

export function ReconfirmationClient({ token }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await confirmReconfirmation(token)
      if (!result.ok) {
        setErrorMsg(result.error.message)
        setState('error')
        return
      }
      setState('confirmed')
    })
  }

  function handleConfirmedDismiss() {
    router.push('/hoje')
  }

  function handleEraseClick() {
    setState('warn-erase')
  }

  function handleEraseConfirmed() {
    setState('erasing')
    startTransition(async () => {
      const result = await eraseDataViaReconfirmation(token)
      if (!result.ok) {
        setErrorMsg(result.error.message)
        setState('error')
        return
      }
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {
        // Sign out failure is non-fatal — user data already erased
      }
      router.push('/')
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {state === 'error' && (
        <div
          className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm"
          role="alert"
        >
          {errorMsg ?? 'Ocorreu um erro. Por favor tenta mais tarde.'}
        </div>
      )}

      {(state === 'idle' || state === 'error') && (
        <>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? 'A processar...' : 'Confirmo o consentimento próprio'}
          </Button>

          <Button
            variant="destructive"
            onClick={handleEraseClick}
            disabled={isPending}
          >
            Apagar os meus dados
          </Button>
        </>
      )}

      {state === 'warn-erase' && (
        <CalmConfirmation
          message="Esta ação é irreversível. Os teus dados serão apagados permanentemente."
          duration={3000}
          onDismiss={handleEraseConfirmed}
        />
      )}

      {state === 'erasing' && (
        <p className="text-sm text-muted-foreground" aria-live="polite" aria-busy="true">
          A apagar os teus dados...
        </p>
      )}

      {state === 'confirmed' && (
        <CalmConfirmation
          message="Consentimento confirmado. Obrigado!"
          duration={2000}
          onDismiss={handleConfirmedDismiss}
        />
      )}
    </div>
  )
}
