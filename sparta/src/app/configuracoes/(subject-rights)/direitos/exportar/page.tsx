import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { ExportarAuthClient } from './_components/exportar-auth-client'

export default async function ExportarPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex flex-col gap-8 p-4 lg:p-6 max-w-2xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Exportar os meus dados</h1>
        <p className="text-muted-foreground">
          Descarrega uma cópia de todos os teus dados pessoais em formato CSV, conforme previsto no RGPD Art. 20.
        </p>
      </div>
      <ExportarAuthClient />
    </div>
  )
}
