import { parseISO, format } from 'date-fns'
import { pt } from 'date-fns/locale'

/**
 * Format an ISO 8601 timestamp for display in the audit log.
 * Output example: "22 de maio de 2026 às 10:30"
 */
export function formatAuditLogDateTime(isoString: string): string {
  try {
    const date = parseISO(isoString)
    const datePart = format(date, "d 'de' MMMM 'de' yyyy", { locale: pt })
    const timePart = format(date, 'HH:mm', { locale: pt })
    return `${datePart} às ${timePart}`
  } catch {
    return isoString
  }
}
