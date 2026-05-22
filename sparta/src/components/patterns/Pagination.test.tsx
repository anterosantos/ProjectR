import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('renders page counter', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />)
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
  })

  it('renders Anterior and Próxima buttons', () => {
    render(<Pagination currentPage={2} totalPages={3} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /anterior/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /próxima/i })).toBeInTheDocument()
  })

  it('disables Anterior on first page', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled()
  })

  it('disables Próxima on last page', () => {
    render(<Pagination currentPage={3} totalPages={3} onPageChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /próxima/i })).toBeDisabled()
  })

  it('calls onPageChange with page - 1 when Anterior clicked', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={2} totalPages={3} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole('button', { name: /anterior/i }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('calls onPageChange with page + 1 when Próxima clicked', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={2} totalPages={3} onPageChange={onPageChange} />)
    fireEvent.click(screen.getByRole('button', { name: /próxima/i }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('does not render when totalPages <= 1', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('has role="navigation" and aria-label="Paginação"', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByRole('navigation', { name: 'Paginação' })).toBeInTheDocument()
  })
})
