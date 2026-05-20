-- Multi-tenant seed data for Story 1.6 RLS integration tests
-- Creates 2 clubs × 3 roles × 2 users = 12 test accounts.
-- Run after: supabase db reset

-- =============================================================================
-- CLUBS
-- =============================================================================

INSERT INTO public.clubs (id, name, country, created_at) VALUES
  ('00000000-0000-7000-a000-000000000001', 'Club Alpha', 'PT', now()),
  ('00000000-0000-7000-a000-000000000002', 'Club Beta',  'PT', now())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- AUTH USERS (service-role only — created via Supabase Admin API in real tests)
-- These UUIDs are deterministic for repeatable test fixtures.
-- =============================================================================

-- Club Alpha users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-7000-b000-000000000001', 'coach-a@test.test',   crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-7000-b000-000000000002', 'analyst-a@test.test', crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-7000-b000-000000000003', 'player-a@test.test',  crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
-- Club Beta users
  ('00000000-0000-7000-b000-000000000004', 'coach-b@test.test',   crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-7000-b000-000000000005', 'analyst-b@test.test', crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-7000-b000-000000000006', 'player-b@test.test',  crypt('Test1234!', gen_salt('bf')), now(), now(), now(), '{}', '{}')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PROFILES (created by service-role, mirrors auth hook behaviour)
-- =============================================================================

INSERT INTO public.profiles (id, club_id, role, full_name, created_at, updated_at) VALUES
  ('00000000-0000-7000-b000-000000000001', '00000000-0000-7000-a000-000000000001', 'coach',   'Coach Alpha',   now(), now()),
  ('00000000-0000-7000-b000-000000000002', '00000000-0000-7000-a000-000000000001', 'analyst', 'Analyst Alpha', now(), now()),
  ('00000000-0000-7000-b000-000000000003', '00000000-0000-7000-a000-000000000001', 'player',  'Player Alpha',  now(), now()),
  ('00000000-0000-7000-b000-000000000004', '00000000-0000-7000-a000-000000000002', 'coach',   'Coach Beta',    now(), now()),
  ('00000000-0000-7000-b000-000000000005', '00000000-0000-7000-a000-000000000002', 'analyst', 'Analyst Beta',  now(), now()),
  ('00000000-0000-7000-b000-000000000006', '00000000-0000-7000-a000-000000000002', 'player',  'Player Beta',   now(), now())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- PRIVACY POLICIES (Story 3.1)
-- =============================================================================

INSERT INTO public.privacy_policies (version, effective_from, body_full_md, body_u14_md, is_current)
VALUES (
  '1.0.0',
  '2026-05-20',
  $body_full$
## Política de Privacidade

**Versão 1.0.0 — em vigor desde 20 de maio de 2026**

### O que são os teus dados?

Os teus dados pessoais são informações que te identificam.
Nesta aplicação, recolhemos o teu nome, email e métricas físicas como peso e altura.
Recolhemos também informações sobre o teu estado físico antes e depois dos treinos.

### Porquê usamos os teus dados?

Usamos os teus dados para apoiar a gestão do teu desempenho desportivo.
O teu treinador e analista usam estes dados para tomar decisões de treino.
Nunca vendemos os teus dados a terceiros.

### Quem vê os teus dados?

O treinador e o analista do teu clube têm acesso aos teus dados.
Ninguém fora do teu clube pode ver as tuas informações.
Os dados são armazenados em servidores seguros na União Europeia.

### Os teus direitos

Tens o direito de:
- Pedir uma cópia dos teus dados (exportação CSV)
- Pedir que apaguemos os teus dados
- Pedir a correção de dados incorretos
- Limitar o uso dos teus dados
- Retirar o teu consentimento a qualquer momento

Para exercer estes direitos, vai a **Definições → Os meus direitos**.

### Segurança

Usamos encriptação em todos os dados de saúde.
Armazenamos os teus dados em servidores na União Europeia.
Fazemos cópias de segurança semanais dos dados.

### Contacto

Para questões sobre privacidade, fala com o teu clube.
  $body_full$,
  $body_u14$
## A tua privacidade

**Versão simplificada para jovens atletas**

Esta aplicação guarda dados pessoais teus para ajudar o teu treinador.
Seguimos o RGPD, a lei europeia que protege os teus dados.

### O que guardamos?

- O teu nome e email
- O teu peso e altura
- Como te sentiste antes e depois dos treinos

### Quem vê os dados?

Só o treinador e o analista do teu clube.
Mais ninguém fora do clube pode ver as tuas informações.

### Os teus direitos

Podes pedir para:
- Ver os teus dados
- Apagar os teus dados
- Corrigir dados errados

Fala com o teu encarregado de educação para usar estes direitos.

### Glossário

- **RGPD** — A lei europeia que protege os teus dados pessoais
- **Dados pessoais** — Coisas que te identificam, como o teu nome ou email
- **Consentimento** — Quando o teu encarregado de educação disse "sim" para guardarmos os teus dados
  $body_u14$,
  true
)
ON CONFLICT DO NOTHING;
