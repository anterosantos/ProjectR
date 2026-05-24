import { db } from './db'
import { newId } from '@/lib/uuid'
import type { FatigueResponseInput } from '@/lib/schemas/fatigue'

export async function enqueueMutation(kind: string, payload: unknown): Promise<string> {
  const id = newId()
  await db.outbox.add({
    id,
    kind,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
  })
  return id
}

/**
 * enqueueFatigueSubmit — Enfileira uma submissão de fadiga offline.
 * Gera UUIDv7 para idempotência no servidor (NFR48).
 * Valida payload com Zod antes de armazenar para evitar corrupção de dados.
 * NOTA: Promise resolve antes de IndexedDB write físico ser committed. Limitação: dados podem ser perdidos se browser fechar imediatamente.
 * Retorna { id, status } para feedback ao user.
 */
export async function enqueueFatigueSubmit(
  payload: Omit<FatigueResponseInput, 'id' | 'submitted_via'>
): Promise<{ id: string; status: 'queued' }> {
  // Validar payload com Zod antes de adicionar ao banco
  const { FatigueResponseSchema } = await import('@/lib/schemas/fatigue')
  const validated = FatigueResponseSchema.omit({ id: true, submitted_via: true }).safeParse(payload)

  if (!validated.success) {
    throw new Error(`Payload inválido: ${validated.error.message}`)
  }

  const id = newId()
  try {
    const payloadWithMeta = { ...payload, id, submitted_via: 'offline-drain' }

    // Re-validar payload completo após adicionar metadados
    const fullValidated = FatigueResponseSchema.safeParse(payloadWithMeta)
    if (!fullValidated.success) {
      throw new Error(`Payload com metadados inválido: ${fullValidated.error.message}`)
    }

    await db.outbox.add({
      id,
      kind: 'fatigue.submit',
      payload: payloadWithMeta,
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
      submitted_via: 'offline-drain',
    })
    return { id, status: 'queued' }
  } catch (err) {
    // Graceful fallback — log erro mas não lance exceção
    console.error('[outbox] Failed to enqueue fatigue submit:', err)
    throw new Error('Falha ao guardar offline. Tenta novamente.')
  }
}
