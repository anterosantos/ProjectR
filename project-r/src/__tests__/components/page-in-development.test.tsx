import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageInDevelopment } from '@/components/domain/page-in-development'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: vi.fn(),
  }),
}))

describe('PageInDevelopment Component', () => {
  it('renders title and development message', () => {
    render(
      <PageInDevelopment
        title="Exportar os meus dados"
        description="Descarrega uma cópia dos teus dados em formato CSV."
      />
    )

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Exportar os meus dados'
    )
    expect(
      screen.getByText('Descarrega uma cópia dos teus dados em formato CSV.')
    ).toBeDefined()
    expect(
      screen.getByText('Esta funcionalidade será implementada na próxima semana.')
    ).toBeDefined()
  })

  it('renders back button by default', () => {
    render(<PageInDevelopment title="Limitar tratamento" />)

    expect(screen.getByRole('button', { name: /Voltar/i })).toBeDefined()
  })

  it('hides back button when showBackButton is false', () => {
    render(
      <PageInDevelopment title="Retirar consentimento" showBackButton={false} />
    )

    expect(screen.queryByRole('button', { name: /Voltar/i })).toBeNull()
  })

  it('renders without description (optional prop)', () => {
    render(<PageInDevelopment title="Apagar os meus dados" />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Apagar os meus dados'
    )
  })
})
