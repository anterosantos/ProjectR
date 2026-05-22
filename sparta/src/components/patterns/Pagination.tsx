'use client'

import { Button } from '@/components/ui/button'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function Pagination({ currentPage, totalPages, onPageChange, isLoading = false }: PaginationProps) {
  if (totalPages <= 1) return null

  const isFirst = currentPage <= 1
  const isLast = currentPage >= totalPages

  return (
    <nav
      role="navigation"
      aria-label="Paginação"
      className="flex items-center justify-center gap-4 py-4"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={isFirst || isLoading}
        aria-disabled={isFirst || isLoading}
        aria-label="Página anterior"
        className="min-h-[44px] min-w-[44px]"
      >
        Anterior
      </Button>

      <span className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
        Página {currentPage} de {totalPages}
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={isLast || isLoading}
        aria-disabled={isLast || isLoading}
        aria-label="Próxima página"
        className="min-h-[44px] min-w-[44px]"
      >
        Próxima
      </Button>
    </nav>
  )
}
