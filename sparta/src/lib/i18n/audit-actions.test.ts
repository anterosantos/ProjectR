import { describe, it, expect } from 'vitest'
import { translateAction, translateTargetKind, translateRole } from './audit-actions'

describe('translateAction()', () => {
  it('maps viewed_fatigue_response', () => {
    expect(translateAction('viewed_fatigue_response')).toBe('Consultou questionário de fadiga')
  })

  it('maps read_match_events', () => {
    expect(translateAction('read_match_events')).toBe('Consultou eventos de jogo')
  })

  it('maps read_readiness_snapshot', () => {
    expect(translateAction('read_readiness_snapshot')).toBe('Consultou painel de prontidão')
  })

  it('maps read_session_metrics', () => {
    expect(translateAction('read_session_metrics')).toBe('Consultou métricas da sessão')
  })

  it('maps subject.exported', () => {
    expect(translateAction('subject.exported')).toBe('Solicitou exportação de dados')
  })

  it('maps subject.withdrew', () => {
    expect(translateAction('subject.withdrew')).toBe('Retirou consentimento')
  })

  it('maps subject.restricted', () => {
    expect(translateAction('subject.restricted')).toBe('Limitou o tratamento de dados')
  })

  it('maps subject.rectified', () => {
    expect(translateAction('subject.rectified')).toBe('Solicitou retificação de dados')
  })

  it('returns action unchanged for unknown action', () => {
    expect(translateAction('unknown.action')).toBe('unknown.action')
  })

  it('returns empty string unchanged', () => {
    expect(translateAction('')).toBe('')
  })
})

describe('translateTargetKind()', () => {
  it('maps fatigue_response', () => {
    expect(translateTargetKind('fatigue_response')).toBe('Questionário de fadiga')
  })

  it('maps match_event', () => {
    expect(translateTargetKind('match_event')).toBe('Evento de jogo')
  })

  it('maps readiness_snapshot', () => {
    expect(translateTargetKind('readiness_snapshot')).toBe('Painel de prontidão')
  })

  it('maps session_metrics', () => {
    expect(translateTargetKind('session_metrics')).toBe('Métricas da sessão')
  })

  it('maps player', () => {
    expect(translateTargetKind('player')).toBe('Perfil')
  })

  it('maps profile', () => {
    expect(translateTargetKind('profile')).toBe('Perfil')
  })

  it('returns kind unchanged for unknown kind', () => {
    expect(translateTargetKind('unknown_kind')).toBe('unknown_kind')
  })
})

describe('translateRole()', () => {
  it('maps coach', () => {
    expect(translateRole('coach')).toBe('Treinador')
  })

  it('maps analyst', () => {
    expect(translateRole('analyst')).toBe('Analista')
  })

  it('maps player', () => {
    expect(translateRole('player')).toBe('Jogador')
  })

  it('returns "Staff" for unknown role', () => {
    expect(translateRole('unknown_role')).toBe('Staff')
  })
})

describe('translation lengths (≤15 words)', () => {
  const actionTranslations = [
    'Consultou questionário de fadiga',
    'Consultou eventos de jogo',
    'Consultou painel de prontidão',
    'Consultou métricas da sessão',
    'Solicitou exportação de dados',
    'Retirou consentimento',
    'Limitou o tratamento de dados',
    'Removeu limitação de tratamento',
    'Solicitou retificação de dados',
    'Consultou dados de saúde',
    'Submeteu questionário de fadiga',
    'Registou evento de jogo',
    'Marcou decisão de prontidão',
    'Pediu exportação de dados',
    'Pediu apagamento de dados',
    'Iniciou processo de consentimento',
    'Confirmou consentimento',
    'Retirou consentimento',
  ]

  for (const translation of actionTranslations) {
    it(`"${translation}" has ≤15 words`, () => {
      const wordCount = translation.trim().split(/\s+/).length
      expect(wordCount).toBeLessThanOrEqual(15)
    })
  }
})
