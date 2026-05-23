'use client'

import { AuditLogList } from '@/components/domain/AuditLogList'
import { getAuditLogForSubject } from '@/lib/actions/audit-visibility'
import type { AuditVisibilityResult } from '@/lib/actions/audit-visibility'
import type { Result, AppError } from '@/lib/types'
import type { ExportResult } from '@/lib/actions/data-rights'

interface AuditLogListClientProps {
  initialData: AuditVisibilityResult
  subjectId: string
  pageSize: number
  exportAction: () => Promise<Result<ExportResult, AppError>>
}

export function AuditLogListClient({
  initialData,
  subjectId,
  pageSize,
  exportAction,
}: AuditLogListClientProps) {
  async function loadPage(page: number): Promise<AuditVisibilityResult> {
    const result = await getAuditLogForSubject(subjectId, page, pageSize)
    if (!result.ok) {
      return { entries: [], actorMap: {}, totalCount: initialData.totalCount, hasMore: false }
    }
    return result.data
  }

  async function handleExport(): Promise<void> {
    const result = await exportAction()
    if (!result.ok) throw new Error(result.error.message)
  }

  return (
    <AuditLogList
      initialData={initialData}
      pageSize={pageSize}
      onLoadPage={loadPage}
      onExport={handleExport}
    />
  )
}
