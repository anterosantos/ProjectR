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

  const totalPages = Math.max(1, Math.ceil(data.totalCount / pageSize))

  function handlePageChange(page: number) {
    startTransition(async () => {
      const result = await onLoadPage(page)
      setData(result)
      setCurrentPage(page)
      window.scrollTo({ top: 0, behavior: 'smooth' })
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

  if (data.entries.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="w-8 h-8 text-muted-foreground" />}
        title="Sem acessos registados"
        description="Os teus dados ainda não foram consultados pelo staff."
      />
    )
  }

  return (
    <section aria-label="Registos de acesso aos teus dados">
      {exportFeedback && (
        <CalmConfirmation
          message={exportFeedback}
          onDismiss={() => setExportFeedback(null)}
        />
      )}

      <ul className="flex flex-col gap-3" aria-busy={isPending}>
        {data.entries.map((entry) => (
          <AuditLogEntry
            key={entry.id}
            entry={entry}
            actorInfo={entry.actor_id ? (data.actorMap[entry.actor_id] ?? null) : null}
          />
        ))}
      </ul>

      <div className="mt-6 flex flex-col items-center gap-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isLoading={isPending}
        />

        {onExport && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="min-h-[44px]"
            aria-label="Exportar histórico de acessos"
          >
            Exportar este histórico
          </Button>
        )}
      </div>
    </section>
  )
}

interface AuditLogEntryProps {
  entry: AuditLogEntry
  actorInfo: ActorInfo | null
}

function AuditLogEntry({ entry, actorInfo }: AuditLogEntryProps) {
  const actorName = actorInfo
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
