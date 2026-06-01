import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getReconfirmationByToken } from '@/lib/actions/reconfirmation'
import { ReconfirmationClient } from './ReconfirmationClient'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata = {
  title: 'Confirmação de Consentimento | SPARTA',
}

interface Props {
  params: Promise<{ token: string }>
}

export default async function ReconfirmacaoPage({ params }: Props) {
  const { token } = await params
  const result = await getReconfirmationByToken(token)

  if (!result.ok) {
    redirect(`/login?redirect_to=/reconfirmacao/${token}`)
  }

  const reconfirmation = result.data

  if (reconfirmation.status !== 'pending') {
    return (
      <main className="px-4 py-8 max-w-lg mx-auto">
        <EmptyState
          icon={<span aria-hidden="true">✓</span>}
          title="Ação já processada"
          description="Não há nada a confirmar."
        />
      </main>
    )
  }

  return (
    <main className="px-4 py-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Confirma o teu consentimento</h1>
      <p className="text-sm text-muted-foreground mb-2">
        Fizeste 18 anos. Como adulto, tens agora o direito de confirmar o teu próprio consentimento na plataforma SPARTA.
      </p>
      <Link
        href="/politica-privacidade"
        className="text-sm underline text-muted-foreground mb-6 block"
      >
        Ler política de privacidade na íntegra
      </Link>
      <ReconfirmationClient token={token} />
    </main>
  )
}
