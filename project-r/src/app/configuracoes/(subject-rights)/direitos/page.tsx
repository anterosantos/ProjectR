import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Download,
  Trash2,
  Edit,
  Lock,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const rights = [
  {
    id: 'export',
    icon: Download,
    title: 'Exportar os meus dados',
    description: 'Descarrega uma cópia dos teus dados',
    href: '/configuracoes/direitos/exportar',
  },
  {
    id: 'erase',
    icon: Trash2,
    title: 'Apagar os meus dados',
    description: 'Solicita o apagamento de todos os teus dados',
    href: '/configuracoes/direitos/apagar',
  },
  {
    id: 'rectify',
    icon: Edit,
    title: 'Retificar dados pessoais',
    description: 'Pede correção a dados teus',
    href: '/configuracoes/direitos/retificar',
  },
  {
    id: 'restrict',
    icon: Lock,
    title: 'Limitar tratamento',
    description: 'Pausa a recolha de novos dados',
    href: '/configuracoes/direitos/limitar',
  },
  {
    id: 'withdraw',
    icon: XCircle,
    title: 'Retirar consentimento',
    description: 'Remove o teu consentimento — sem volta atrás',
    href: '/configuracoes/direitos/retirar',
  },
]

export default async function DireitosPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Age gate is enforced by the parent (subject-rights) layout;
  // this page only handles the authenticated adult titular case.

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Os meus direitos RGPD</h1>
        <p className="text-muted-foreground text-lg">
          Aqui podes exercer todos os teus direitos sob a regulamentação RGPD.
        </p>
      </div>

      {/* Grid of rights cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {rights.map((right) => {
          const Icon = right.icon
          return (
            <Link
              key={right.id}
              href={right.href}
              className="group"
            >
              <div className="bg-surface-secondary border border-border rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="flex gap-4">
                  <Icon className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-base mb-2">
                      {right.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {right.description}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="text-accent hover:text-accent hover:bg-accent/10"
                    >
                      <span>Continuar</span>
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
