import { db } from './db'
import type { FatigueResponseInput } from '@/lib/schemas/fatigue'
import { submitFatigueResponse } from '@/lib/actions/fatigue'
import { MatchEventInputSchema } from '@/lib/schemas/match-events'
import { submitMatchEvent } from '@/lib/actions/events'
import { registerSubstitution } from '@/lib/actions/substitutions'

interface SubstitutionDrainPayload {
  sessionId: string
  outPlayerId: string
  inPlayerId: string
  minute: number
}

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
 *
 * PATCH: Ordering contract (AC #7)
 * - Handlers DEVEM ser registados antes desta função ser chamada
 * - useMatchOutboxDrain.ts enforce ordering: lineup.substitution ANTES de match-event.submit
 * - Callers: se chamar drainPendingMutations() diretamente, respeitar ordem manual
 */
export async function drainPendingMutations(kind?: string): Promise<DrainResult> {
  if (draining) {
    console.warn('[outbox] drain already in progress, skipping concurrent call')
    return { drained: 0, failed: 0, errors: [] }
  }

  draining = true
  const updatePromises: Promise<unknown>[] = []

  try {
    let query = db.outbox.where('status').equals('pending')
    if (kind) {
      query = query.filter(m => m.kind === kind)
    }
    // PATCH 9 AC #2: Sort by occurred_at ascending to preserve event order
    const pending = await query.toArray()
    pending.sort((a, b) => {
      const aPayload = a.payload as Record<string, unknown> | undefined
      const bPayload = b.payload as Record<string, unknown> | undefined
      const aTime = aPayload?.['occurred_at'] ? new Date(aPayload['occurred_at'] as string).getTime() : 0
      const bTime = bPayload?.['occurred_at'] ? new Date(bPayload['occurred_at'] as string).getTime() : 0
      return aTime - bTime
    })
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
        // Each handler is responsible for validating its own payload.
        // The drain function is generic — it must not perform kind-specific validation here.
        await handler(mutation.payload)
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
          // PATCH: Exponential backoff com jitter: delay = 2^retryCount + random(0, 1s)
          // Note: Actual retry delay is enforced by caller (useMatchOutboxDrain checks intervals)
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

// Registar handlers — PATCH: Wrapar em try-catch para garantir registro mesmo se import falha
try {
  // Registar handler para match-event.submit
  registerHandler('match-event.submit', async (payload: unknown) => {
    const validated = MatchEventInputSchema.safeParse(payload)
    if (!validated.success) {
      const error = new Error(`Payload inválido: ${validated.error.message}`)
      ;(error as Error & { code: string }).code = 'VALIDATION_ERROR'
      throw error
    }
    const result = await submitMatchEvent(validated.data)
    if (!result.ok) {
      const error = new Error(result.error?.message ?? 'Falha ao submeter evento de jogo')
      ;(error as Error & { code: string }).code = result.error?.code ?? 'unknown'
      throw error
    }
  })

  // Registar handler para lineup.substitution
  // PATCH: Type guard before property access; preserve error codes
  registerHandler('lineup.substitution', async (payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) {
      const error = new Error('Payload de substituição inválido')
      ;(error as Error & { code: string }).code = 'VALIDATION_ERROR'
      throw error
    }
    const p = payload as Record<string, unknown>
    if (!p?.sessionId || !p?.outPlayerId || !p?.inPlayerId || typeof p?.minute !== 'number') {
      const error = new Error('Payload de substituição inválido')
      ;(error as Error & { code: string }).code = 'VALIDATION_ERROR'
      throw error
    }
    const result = await registerSubstitution(
      p.sessionId as string,
      p.outPlayerId as string,
      p.inPlayerId as string,
      p.minute as number
    )
    if (!result.ok) {
      const error = new Error(result.error?.message ?? 'Falha ao registar substituição offline')
      ;(error as Error & { code: string }).code = result.error?.code ?? 'unknown'
      throw error
    }
  })

  // Registar handler para fatigue.submit
  registerHandler('fatigue.submit', async (payload: unknown) => {
    const fatiguePayload = payload as FatigueResponseInput
    const result = await submitFatigueResponse(fatiguePayload)
    if (!result.ok) {
      const error = new Error(result.error?.message ?? 'Falha ao submeter fadiga')
      ;(error as Error & { code: string }).code = result.error?.code ?? 'unknown'
      throw error
    }
  })
} catch (err) {
  console.error('[outbox] Handler registration failed:', err)
}
