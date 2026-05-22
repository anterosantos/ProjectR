'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { approveRectification, rejectRectification } from '@/lib/actions/data-rights'

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Nome completo',
  birthdate: 'Data de nascimento',
  jersey_num: 'Número de camisola',
}

interface RectificationRequest {
  id: string
  player_id: string
  field_name: string
  requested_value: string
  current_value: string | null
  reason: string | null
  created_at: string
  player_name: string
}

interface PendingRequestsListProps {
  requests: RectificationRequest[]
}

type RequestState = 'idle' | 'approving' | 'rejecting' | 'done'

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export function PendingRequestsList({ requests: initialRequests }: PendingRequestsListProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [requestStates, setRequestStates] = useState<Record<string, RequestState>>({})
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({})

  function setStateFor(id: string, state: RequestState) {
    setRequestStates(prev => ({ ...prev, [id]: state }))
  }

  function setErrorFor(id: string, msg: string) {
    setErrorMessages(prev => ({ ...prev, [id]: msg }))
  }

  async function handleApprove(requestId: string) {
    setStateFor(requestId, 'approving')
    setErrorFor(requestId, '')

    const result = await approveRectification(requestId)

    if (!result.ok) {
      setErrorFor(requestId, result.error.message ?? 'Erro ao aprovar pedido.')
      setStateFor(requestId, 'idle')
      return
    }

    setStateFor(requestId, 'done')
    setRequests(prev => prev.filter(r => r.id !== requestId))
  }

  function openRejectDialog(requestId: string) {
    setRejectReason('')
    setRejectDialogId(requestId)
  }

  function closeRejectDialog() {
    setRejectDialogId(null)
    setRejectReason('')
  }

  async function handleReject() {
    if (!rejectDialogId || !rejectReason.trim()) return

    const id = rejectDialogId
    closeRejectDialog()
    setStateFor(id, 'rejecting')
    setErrorFor(id, '')

    const result = await rejectRectification(id, rejectReason.trim())

    if (!result.ok) {
      setErrorFor(id, result.error.message ?? 'Erro ao rejeitar pedido.')
      setStateFor(id, 'idle')
      return
    }

    setStateFor(id, 'done')
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  if (requests.length === 0) {
    return null
  }

  return (
    <>
      <ul className="flex flex-col gap-4" aria-label="Lista de pedidos pendentes">
        {requests.map(request => {
          const requestState = requestStates[request.id] ?? 'idle'
          const errorMsg = errorMessages[request.id]
          const fieldLabel = FIELD_LABELS[request.field_name] ?? request.field_name
          const days = daysSince(request.created_at)
          const createdDate = new Date(request.created_at).toLocaleDateString('pt-PT')
          const isProcessing = requestState === 'approving' || requestState === 'rejecting'

          return (
            <li
              key={request.id}
              className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{request.player_name}</span>
                  <span className="text-xs text-muted-foreground">{createdDate} · {days} {days === 1 ? 'dia' : 'dias'}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{fieldLabel}</span>
                  {request.current_value && (
                    <> · atual: <span className="font-mono">{request.current_value}</span></>
                  )}
                  {' '}→ pedido: <span className="font-mono font-medium">{request.requested_value}</span>
                </div>
                {request.reason && (
                  <p className="text-sm text-muted-foreground italic">&ldquo;{request.reason}&rdquo;</p>
                )}
              </div>

              {errorMsg && (
                <div role="alert" className="text-sm text-destructive">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(request.id)}
                  disabled={isProcessing}
                  aria-busy={requestState === 'approving'}
                >
                  {requestState === 'approving' ? 'A aprovar...' : 'Aprovar'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openRejectDialog(request.id)}
                  disabled={isProcessing}
                  className="text-destructive hover:text-destructive"
                >
                  Rejeitar
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Dialog de rejeição */}
      <Dialog open={rejectDialogId !== null} onOpenChange={(open) => { if (!open) closeRejectDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar pedido</DialogTitle>
            <DialogDescription>
              Indica o motivo da rejeição. Este motivo será comunicado ao titular.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="reject-reason" className="text-sm font-medium">
              Motivo da rejeição
            </label>
            <textarea
              id="reject-reason"
              required
              maxLength={1000}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Descreve o motivo da rejeição"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeRejectDialog}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              aria-disabled={!rejectReason.trim()}
            >
              Confirmar rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
