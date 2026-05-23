const AUDIT_ACTION_TRANSLATIONS: Record<string, string> = {
  'viewed_fatigue_response': 'Consultou questionário de fadiga',
  'read_match_events': 'Consultou eventos de jogo',
  'read_readiness_snapshot': 'Consultou painel de prontidão',
  'read_session_metrics': 'Consultou métricas da sessão',
  'subject.exported': 'Solicitou exportação de dados',
  'subject.withdrew': 'Retirou consentimento',
  'subject.restricted': 'Limitou o tratamento de dados',
  'subject.unrestricted': 'Removeu limitação de tratamento',
  'subject.rectified': 'Solicitou retificação de dados',
  'health_data.read': 'Consultou dados de saúde',
  'fatigue.submitted': 'Submeteu questionário de fadiga',
  'event.recorded': 'Registou evento de jogo',
  'decision.marked': 'Marcou decisão de prontidão',
  'export.requested': 'Pediu exportação de dados',
  'erasure.requested': 'Pediu apagamento de dados',
  'consent.initiate': 'Iniciou processo de consentimento',
  'consent.confirmed': 'Confirmou consentimento',
  'consent.withdrawn': 'Retirou consentimento',
}

const TARGET_KIND_TRANSLATIONS: Record<string, string> = {
  'fatigue_response': 'Questionário de fadiga',
  'match_event': 'Evento de jogo',
  'readiness_snapshot': 'Painel de prontidão',
  'session_metrics': 'Métricas da sessão',
  'player': 'Perfil',
  'profile': 'Perfil',
  'decision': 'Decisão',
  'export': 'Exportação',
}

const ROLE_TRANSLATIONS: Record<string, string> = {
  'coach': 'Treinador',
  'analyst': 'Analista',
  'player': 'Jogador',
  'admin': 'Administrador',
}

export function translateAction(action: string): string {
  return AUDIT_ACTION_TRANSLATIONS[action] ?? action
}

export function translateTargetKind(kind: string): string {
  return TARGET_KIND_TRANSLATIONS[kind] ?? kind
}

export function translateRole(role: string): string {
  return ROLE_TRANSLATIONS[role] ?? 'Staff'
}
