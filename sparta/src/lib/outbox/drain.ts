import { db } from './db'
import type { FatigueResponseInput } from '@/lib/schemas/fatigue'
import { submitFatigueResponse } from '@/lib/actions/fatigue'

type MutationHandler = (payload: unknown) => Promise<void>

const handlers = new Map<string, MutationHandler>()
let draining = false

export function registerHandler(kind: string, handler: MutationHandler): void {
  handlers.set(kind, handler)
}

export interface DrainResult {
  drained: number
  failed: number
  errors: string[]
}

/**
 * drainPendingMutations — Drena todas as mutações pendentes do outbox.
 * Pode filtrar por kind específico (ex: 'fatigue.submit').
 * Executa com fire-and-forget pattern — erros não propagam para UI.
 */
export async function drainPendingMutations(kind?: string): Promise<DrainResult> {
  if (draining) {
    console.warn('[outbox] drain already in progress, skipping concurrent call')
    return { drained: 0, failed: 0, errors: [] }
  }

  draining = true
  const updatePromises: Promise<void>[] = []

  try {
    let query = db.outbox.where('status').equals('pending')
    if (kind) {
      query = query.filter(m => m.kind === kind)
    }
    const pending = await query.toArray()
    let drained = 0
    let failed = 0
    const errors: string[] = []

    for (const mutation of pending) {
      const handler = handlers.get(mutation.kind)
      if (!handler) {
        // Handler não registado — verificar retry count para evitar estar stuck forever
        const newRetryCount = mutation.retryCount + 1
        if (newRetryCount >= 3) {
          const updatePromise = db.outbox.update(mutation.id, { status: 'failed' }).catch(err => {
            console.error(`[outbox] failed to mark as failed for ${mutation.id}:`, err)
          })
          updatePromises.push(updatePromise)
          failed++
          errors.push(`No handler registered for kind=${mutation.kind}`)
        } else {
          const updatePromise = db.outbox.update(mutation.id, { retryCount: newRetryCount }).catch(err => {
            console.error(`[outbox] failed to update retry count for ${mutation.id}:`, err)
          })
          updatePromises.push(updatePromise)
        }
        continue
      }

      try {
        // Validar payload com Zod antes de chamar handler
        const fatigueSchema = await import('@/lib/schemas/fatigue').then(m => m.FatigueResponseInputSchema)
        const validated = fatigueSchema.safeParse(mutation.payload)
        if (!validated.success) {
          throw new Error(`Invalid payload: ${validated.error.message}`)
        }

        await handler(validated.data)
        const updatePromise = db.outbox.update(mutation.id, { status: 'synced' })
          .then(() => { drained++ })
          .catch(err => {
            const errorMsg = err instanceof Error ? err.message : String(err)
            console.error(`[outbox] failed to update status for ${mutation.id}:`, err)
            errors.push(errorMsg)
            failed++
          })
        updatePromises.push(updatePromise)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[outbox] handler error for kind=${mutation.kind}, id=${mutation.id}:`, err)

        // Usar .code property se disponível (estruturado), senão usar mensagem como fallback
        const errorCode = err instanceof Error && 'code' in err ? (err as Error & { code: unknown }).code : undefined
        const isValidationError = errorCode === 'VALIDATION_ERROR' ||
                                  errorCode === 'FORBIDDEN' ||
                                  errorCode === 'NOT_FOUND' ||
                                  errorCode === 'PROCESSING_RESTRICTED' ||
                                  errorMsg.includes('Invalid payload')

        const newRetryCount = mutation.retryCount + 1

        // Se já atingiu max retries ou é erro de validação, marcar como failed
        if (isValidationError || newRetryCount >= 3) {
          const updatePromise = db.outbox.update(mutation.id, {
            retryCount: newRetryCount,
            status: 'failed',
          }).catch(updateErr => {
            console.error(`[outbox] failed to update retry count for ${mutation.id}:`, updateErr)
          })
          updatePromises.push(updatePromise)
        } else {
          // Aplicar exponential backoff na lógica de retries (não implementado aqui, apenas flag)
          const updatePromise = db.outbox.update(mutation.id, {
            retryCount: newRetryCount,
            status: 'pending',
          }).catch(updateErr => {
            console.error(`[outbox] failed to update retry count for ${mutation.id}:`, updateErr)
          })
          updatePromises.push(updatePromise)
        }
        errors.push(errorMsg)
        failed++
      }
    }

    // Aguardar todas as atualizações antes de retornar
    await Promise.allSettled(updatePromises)

    return { drained, failed, errors }
  } finally {
    // draining = false é garantido de executar aqui, mesmo em caso de erro
    draining = false
  }
}

/**
 * drainOutbox — Compatibilidade com API anterior.
 * Drena todos os outbox sem filtro de kind.
 */
export async function drainOutbox(): Promise<{ synced: number; failed: number }> {
  const result = await drainPendingMutations()
  return { synced: result.drained, failed: result.failed }
}

// Registar handler para fatigue.submit
registerHandler('fatigue.submit', async (payload: unknown) => {
  const fatiguePayload = payload as FatigueResponseInput
  const result = await submitFatigueResponse(fatiguePayload)
  if (!result.ok) {
    throw new Error(result.error.message ?? 'Falha ao submeter fadiga')
  }
})
