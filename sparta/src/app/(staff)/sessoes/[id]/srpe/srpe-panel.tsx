'use client'

import { useState, useCallback } from 'react'
import { Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PendingBadge } from '@/components/domain/pending-badge'
import { FatigueSlider } from '@/components/ui/fatigue-slider'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { upsertSessionSrpe } from '@/lib/actions/session-srpe'
import { enqueueMutation } from '@/lib/outbox/enqueue'
import { newId } from '@/lib/uuid'
import { useOutboxStatus } from '@/lib/outbox/status'
import type { PlayerSrpeEntry } from '@/lib/schemas/session-srpe'

interface SrpePanelProps {
  players: PlayerSrpeEntry[]
  sessionId: string
  durationMin: number
}

const POSITION_ORDER: Record<string, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
}

export function SrpePanel({ players, sessionId, durationMin }: SrpePanelProps) {
  const { isOnline } = useOnlineStatus()
  const { pendingCount } = useOutboxStatus()

  const initialSrpeValues = useCallback(() => {
    const m = new Map<string, number>()
    for (const p of players) {
      const initial = p.existing_analyst_srpe ?? p.player_submitted_srpe
      if (initial != null) m.set(p.player_id, initial)
    }
    return m
  }, [players])

  const [srpeValues, setSrpeValues] = useState<Map<string, number>>(initialSrpeValues)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSliderChange = useCallback((playerId: string, value: number) => {
    setSrpeValues((prev) => new Map(prev).set(playerId, value))
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    setSuccessMsg(null)

    try {
      // Filter: only non-absent players with values defined
      const playersToSave = players.filter(
        (p) => p.attendance_status !== 'absent' && srpeValues.has(p.player_id)
      )

      if (playersToSave.length === 0) {
        setError('Nenhum jogador com sRPE para guardar')
        setIsSaving(false)
        return
      }

      if (isOnline) {
        const results = await Promise.all(
          playersToSave.map((p) =>
            upsertSessionSrpe({
              id: newId(),
              session_id: sessionId,
              player_id: p.player_id,
              srpe_value: srpeValues.get(p.player_id)!,
              duration_min: durationMin,
            })
          )
        )

        const failed = results.filter((r) => !r.ok)
        if (failed.length > 0) {
          setError('Erro ao guardar alguns registos de sRPE. Tente novamente.')
        } else {
          setSuccessMsg('sRPE guardado')
        }
      } else {
        const payloads = playersToSave.map((p) => ({
          id: newId(),
          session_id: sessionId,
          player_id: p.player_id,
          srpe_value: srpeValues.get(p.player_id)!,
          duration_min: durationMin,
        }))

        await Promise.all(payloads.map((payload) => enqueueMutation('srpe.upsert', payload)))

        setSuccessMsg(`${payloads.length} registos de sRPE em fila para sincronização`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setIsSaving(false)
    }
  }, [isOnline, players, srpeValues, sessionId, durationMin])

  if (players.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <EmptyState
          icon={<Gauge className="h-8 w-8 text-muted-foreground" />}
          title="Sem jogadores no plantel"
          description="Adiciona jogadores em /plantel antes de registar sRPE."
        />
      </div>
    )
  }

  // Group players by position
  const playersByPosition: Record<string, PlayerSrpeEntry[]> = {}
  for (const player of players) {
    const pos = player.primary_position ?? 'Indefinido'
    if (!playersByPosition[pos]) playersByPosition[pos] = []
    playersByPosition[pos]!.push(player)
  }

  const sortedPositionEntries = Object.entries(playersByPosition).sort(([a], [b]) => {
    return (POSITION_ORDER[a] ?? 999) - (POSITION_ORDER[b] ?? 999)
  })

  return (
    <div className="flex flex-col flex-1 p-4 gap-4">
      {pendingCount > 0 && (
        <PendingBadge count={pendingCount} label="registos de sRPE pendentes" />
      )}

      {error && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div role="status" aria-live="polite" className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      <ul className="flex flex-col gap-4 list-none p-0 m-0">
        {sortedPositionEntries.map(([position, groupPlayers]) => (
          <li key={position}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              {position}
            </h2>
            <ul className="flex flex-col gap-4 list-none p-0 m-0">
              {groupPlayers.map((player) => {
                const isAbsent = player.attendance_status === 'absent'
                const showPlayerSubmittedLabel =
                  player.player_submitted_srpe != null && player.existing_analyst_srpe == null

                return (
                  <li key={player.player_id}>
                    {isAbsent ? (
                      <div className="flex items-center gap-2 opacity-50">
                        <span className="text-sm font-medium">
                          #{player.jersey_num ?? 0} {player.full_name}
                        </span>
                        <span className="text-xs text-muted-foreground">Ausente — sem sRPE</span>
                        <FatigueSlider
                          id={`srpe-${player.player_id}`}
                          label="sRPE"
                          minLabel="Muito fácil"
                          maxLabel="Máximo"
                          min={1}
                          max={10}
                          value={null}
                          onChange={() => {}}
                          disabled
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium">
                            #{player.jersey_num ?? 0} {player.full_name}
                          </span>
                          {showPlayerSubmittedLabel && (
                            <span className="text-xs text-muted-foreground">Submetido pelo jogador</span>
                          )}
                        </div>
                        <FatigueSlider
                          id={`srpe-${player.player_id}`}
                          label="sRPE"
                          minLabel="Muito fácil"
                          maxLabel="Máximo"
                          min={1}
                          max={10}
                          value={srpeValues.get(player.player_id) ?? null}
                          onChange={(v) => handleSliderChange(player.player_id, v)}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-0 pt-4 pb-safe bg-background/95 backdrop-blur-sm border-t border-border mt-auto">
        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={isSaving || players.length === 0}
          onClick={handleSave}
          aria-label="Guardar sRPE da sessão"
        >
          {isSaving ? 'A guardar…' : 'Guardar sRPE'}
        </Button>
      </div>
    </div>
  )
}
