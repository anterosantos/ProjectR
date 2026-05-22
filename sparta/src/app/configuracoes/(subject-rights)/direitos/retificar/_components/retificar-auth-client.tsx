'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CalmConfirmation } from '@/components/ui/calm-confirmation'
import { submitRectificationRequest } from '@/lib/actions/data-rights'
import type { RectificationPayload } from '@/lib/actions/data-rights'

type State = 'idle' | 'loading' | 'success' | 'error'

const FIELD_OPTIONS: { value: RectificationPayload['fieldName']; label: string }[] = [
  { value: 'full_name', label: 'Nome completo' },
  { value: 'birthdate', label: 'Data de nascimento' },
  { value: 'jersey_num', label: 'Número de camisola' },
]

export function RetificarAuthClient() {
  const [state, setState] = useState<State>('idle')
  const [fieldName, setFieldName] = useState<RectificationPayload['fieldName']>('full_name')
  const [requestedValue, setRequestedValue] = useState('')
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'loading') return

    setState('loading')
    setErrorMessage('')

    const result = await submitRectificationRequest({ fieldName, requestedValue, reason: reason || undefined })

    if (!result.ok) {
      setErrorMessage(result.error.message ?? 'Algo correu mal. Tenta novamente.')
      setState('error')
      return
    }

    setState('success')
  }

  if (state === 'success') {
    return (
      <CalmConfirmation
        message="Pedido recebido — vais ter resposta em até 7 dias."
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" aria-live="polite" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="field-select" className="text-sm font-medium text-foreground">
          Campo a corrigir
        </label>
        <select
          id="field-select"
          aria-label="Selecionar campo a corrigir"
          value={fieldName}
          onChange={e => setFieldName(e.target.value as RectificationPayload['fieldName'])}
          disabled={state === 'loading'}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {FIELD_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="requested-value" className="text-sm font-medium text-foreground">
          Novo valor
        </label>
        <input
          id="requested-value"
          type="text"
          maxLength={500}
          required
          value={requestedValue}
          onChange={e => setRequestedValue(e.target.value)}
          disabled={state === 'loading'}
          placeholder="Escreve o valor correto"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="reason-textarea" className="text-sm font-medium text-foreground">
          Motivo <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <textarea
          id="reason-textarea"
          maxLength={1000}
          value={reason}
          onChange={e => setReason(e.target.value)}
          disabled={state === 'loading'}
          placeholder="Descreve porque este dado está incorreto"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
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
        type="submit"
        disabled={!requestedValue.trim() || state === 'loading'}
        aria-busy={state === 'loading'}
        aria-disabled={!requestedValue.trim() || state === 'loading'}
      >
        {state === 'loading' ? 'A enviar...' : 'Enviar pedido'}
      </Button>
    </form>
  )
}
