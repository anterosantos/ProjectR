-- Migration: 000210_push_subscriptions
-- Purpose: Tabela de subscrições push para notificações Web Push (VAPID)
-- Stories: 4.7 — Push Subscription Infrastructure — VAPID Setup & Subscribe/Unsubscribe
-- Nota: chaves VAPID armazenadas no cliente via browser Web Push API;
--       chave privada VAPID nunca entra na DB (fica em Supabase Edge Function secrets)

-- =============================================================================
-- push_subscriptions — tabela principal
-- =============================================================================

CREATE TABLE push_subscriptions (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  club_id     uuid        NOT NULL REFERENCES clubs(id)    ON DELETE CASCADE,
  profile_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL,
  keys_json   jsonb       NOT NULL, -- { p256dh: string, auth: string }
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,         -- actualizado quando push é enviado (Story 4.8)
  is_active   boolean     NOT NULL DEFAULT true,

  CONSTRAINT push_subscriptions_pkey        PRIMARY KEY (id),
  CONSTRAINT unique_profile_endpoint        UNIQUE (profile_id, endpoint)
);

-- =============================================================================
-- Índices de performance
-- =============================================================================

-- Filtrar subscrições activas por jogador (uso frequente em Story 4.8)
CREATE INDEX idx_push_subscriptions_profile
  ON push_subscriptions(profile_id, is_active);

-- Apoio a limpeza de subscrições inactivas (manutenção)
CREATE INDEX idx_push_subscriptions_active
  ON push_subscriptions(is_active, created_at);

-- =============================================================================
-- Comentários de documentação
-- =============================================================================

COMMENT ON TABLE push_subscriptions IS
  'Subscrições Web Push por perfil de jogador. Rows mantidos com is_active=false para audit trail; nunca apagados.';

COMMENT ON COLUMN push_subscriptions.endpoint IS
  'Endpoint único da subscrição Web Push (fornecido pelo browser). Único por (profile_id, endpoint).';

COMMENT ON COLUMN push_subscriptions.keys_json IS
  'Chaves criptográficas da subscrição: { p256dh: string, auth: string }. Geridas pelo browser; a chave privada VAPID nunca entra aqui.';

COMMENT ON COLUMN push_subscriptions.last_used_at IS
  'Timestamp do último push enviado com sucesso. Actualizado pela Edge Function send-push (Story 4.8).';

COMMENT ON COLUMN push_subscriptions.is_active IS
  'false = jogador desativou ou subscrição expirou (410 Gone). Rows nunca apagados (audit trail).';

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Jogador selecciona e actualiza apenas as suas próprias subscrições
CREATE POLICY "player_select_own_subscriptions" ON push_subscriptions
  FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "player_update_own_subscriptions" ON push_subscriptions
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Jogador insere apenas para o seu próprio perfil e clube
CREATE POLICY "player_insert_own_subscriptions" ON push_subscriptions
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND club_id = (SELECT club_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Staff NÃO tem políticas de leitura de keys_json.
-- Acesso administrativo feito via service role (Edge Functions) apenas.
-- (Column-level security não aplicada aqui; RLS row-level é suficiente para MVP)

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE ON push_subscriptions TO authenticated;
