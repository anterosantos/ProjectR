'use client'

import { useState, useTransition } from 'react'
import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CalmConfirmation } from '@/components/ui/calm-confirmation'
import { Pagination } from '@/components/patterns/Pagination'
import { translateAction, translateTargetKind, translateRole } from '@/lib/i18n/audit-actions'
import { formatAuditLogDateTime } from '@/lib/format/date-time'
import type { AuditLogEntry, ActorInfo, AuditVisibilityResult } from '@/lib/actions/audit-visibility'

interface AuditLogListProps {
  initialData: AuditVisibilityResult
  pageSize?: number
  onLoadPage: (page: number) => Promise<AuditVisibilityResult>
  onExport?: () => Promise<void>
}

export function AuditLogList({ initialData, pageSize = 50, onLoadPage, onExport }: AuditLogListProps) {
  const [data, setData] = useState<AuditVisibilityResult>(initialData)
  const [currentPage, setCurrentPage] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [exportFeedback, setExportFeedback] = useState<string | null>(null)

  const isEmpty = data.entries.length === 0
  const totalPages = isEmpty ? 1 : Math.max(1, Math.ceil(data.totalCount / pageSize))

  function handlePageChange(page: number) {
    startTransition(async () => {
      try {
        const result = await onLoadPage(page)
        setData(result)
        setCurrentPage(page)
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'instant' : 'smooth' })
      } catch {
        // onLoadPage errors are surfaced as empty result by the caller wrapper; silent here
      }
    })
  }

  async function handleExport() {
    if (!onExport) return
    try {
      await onExport()
      setExportFeedback('Pedido de exportação submetido.')
    } catch {
      setExportFeedback('Falha ao exportar. Tenta novamente.')
    }
  }

  return (
    <section aria-label="Registos de acesso aos teus dados">
      {exportFeedback && (
        <CalmConfirmation
          message={exportFeedback}
          duration={3000}
          onDismiss={() => setExportFeedback(null)}
        />
      )}

      {isEmpty ? (
        <EmptyState
          icon={<ClipboardList className="w-8 h-8 text-muted-foreground" />}
          title="Sem acessos registados"
          description="Os teus dados ainda não foram consultados pelo staff."
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-busy={isPending}>
          {data.entries.map((entry) => (
            <li key={entry.id}>
              <AuditLogEntryCard
                entry={entry}
                actorInfo={entry.actor_id ? (data.actorMap[entry.actor_id] ?? null) : null}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-col items-center gap-4">
        {!isEmpty && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            isLoading={isPending}
          />
        )}

        {onExport && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="min-h-[44px] min-w-[44px]"
          >
            Exportar este histórico
          </Button>
        )}
      </div>
    </section>
  )
}

interface AuditLogEntryCardProps {
  entry: AuditLogEntry
  actorInfo: ActorInfo | null
}

function AuditLogEntryCard({ entry, actorInfo }: AuditLogEntryCardProps) {
  const actorName = entry.actor_id === null
    ? 'Tu próprio/a'
    : actorInfo
      ? `${actorInfo.full_name} (${translateRole(actorInfo.role)})`
      : 'Staff desconhecido'

  return (
    <article
      role="article"
      className="rounded-md border border-border p-4 hover:bg-muted/40 transition-colors"
    >
      <div className="flex flex-col gap-1 text-sm">
        <time
          dateTime={entry.occurred_at}
          className="text-muted-foreground text-xs"
        >
          {formatAuditLogDateTime(entry.occurred_at)}
        </time>
        <p className="font-medium text-foreground">{translateAction(entry.action)}</p>
        {entry.target_kind && (
          <p className="text-muted-foreground">{translateTargetKind(entry.target_kind)}</p>
        )}
        <p className="text-muted-foreground text-xs">{actorName}</p>
      </div>
    </article>
  )
}
