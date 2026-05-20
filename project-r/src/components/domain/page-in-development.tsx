'use client'

import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface PageInDevelopmentProps {
  title: string
  description?: string
  showBackButton?: boolean
}

export function PageInDevelopment({
  title,
  description,
  showBackButton = true,
}: PageInDevelopmentProps) {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6 max-w-2xl mx-auto">
      {showBackButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="self-start gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Button>
      )}

      <div className="flex flex-col gap-6 py-12 text-center">
        <h1 className="text-3xl font-bold">{title}</h1>

        {description && (
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            {description}
          </p>
        )}

        <div className="flex flex-col gap-3 items-center pt-4">
          <p className="text-sm text-muted-foreground">
            Esta funcionalidade será implementada na próxima semana.
          </p>
          <p className="text-xs text-muted-foreground">
            Obrigado pela paciência.
          </p>
        </div>
      </div>
    </div>
  )
}
