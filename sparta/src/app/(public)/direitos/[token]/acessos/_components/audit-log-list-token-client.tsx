'use client'

import { AuditLogList } from '@/components/domain/AuditLogList'
import { getAuditLogForSubjectByToken } from '@/lib/actions/audit-visibility'
import type { AuditVisibilityResult } from '@/lib/actions/audit-visibility'
import type { Result, AppError } from '@/lib/types'
import type { ExportResult } from '@/lib/actions/data-rights'

interface AuditLogListTokenClientProps {
  initialData: AuditVisibilityResult
  token: string
  pageSize: number
  exportAction: (token: string) => Promise<Result<ExportResult, AppError>>
}

export function AuditLogListTokenClient({
  initialData,
  token,
  pageSize,
  exportAction,
}: AuditLogListTokenClientProps) {
  async function loadPage(page: number): Promise<AuditVisibilityResult> {
    const result = await getAuditLogForSubjectByToken(token, page, pageSize)
    if (!result.ok) {
      return { entries: [], actorMap: {}, totalCount: initialData.totalCount, hasMore: false }
    }
    return result.data
  }

  async function handleExport(): Promise<void> {
    const result = await exportAction(token)
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
