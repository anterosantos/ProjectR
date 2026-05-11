---
title: Architecture Expansion — Wellness & Analytics Requirements
date: 2026-05-09
author: Winston (System Architect)
status: Ready for Technical Review
audience: Backend, Frontend, DevOps
baseDocument: architecture.md (2026-05-07)
---

# 🏗️ Arquitectura Expandida — Wellness & Analytics

Este documento é um **addendum** ao Architecture Decision Document (2026-05-07). Estende o design atual com 17 novos requisitos sem quebrar constraints ou patterns estabelecidos.

**Objetivo:** Validar que Wellness (6 campos) + Analytics (11 métricas) cabem no MVP com cost €0/mês, Painel ≤2s, offline-first, e zero integrações externas.

---

## 1. Data Model Expansion

### 1.1 Wellness Schema Extension

**Tabela expandida: `fatigue_responses`**

```sql
-- ANTES: 5 campos (dimensões base) + session_id
CREATE TABLE fatigue_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id),
  session_id uuid NOT NULL REFERENCES sessions(id),
  phase text NOT NULL CHECK (phase IN ('pre', 'post')),
  -- 5 dimensões originais (1–5 scale)
  energy_score int NOT NULL CHECK (energy_score BETWEEN 1 AND 5),
  concentration_score int NOT NULL,
  sleep_quality_score int NOT NULL,
  muscle_discomfort_score int NOT NULL,
  emotional_state_score int NOT NULL,
  -- Novos campos (WELLNESS EXPANSION)
  mood_score int CHECK (mood_score BETWEEN 1 AND 5),  -- emoji scale: 😢=1 ... 😃=5, PHASE=pre only
  muscle_pain_zones jsonb,  -- Array: ["joelho", "tornozelo"] — JSON chosen (Q1 Recomendação A)
  has_exams_this_week boolean DEFAULT false,  -- PHASE=pre only, semanal (Q3 Recomendação A)
  -- Existentes
  sRPE_value int CHECK (sRPE_value BETWEEN 1 AND 10),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT fk_club FOREIGN KEY (club_id) REFERENCES clubs(id),
  CONSTRAINT muscle_pain_valid CHECK (
    CASE WHEN phase = 'post' THEN muscle_pain_zones IS NOT NULL ELSE true END
  )
);

-- Índices
CREATE INDEX idx_fatigue_responses_player_session 
  ON fatigue_responses(player_id, session_id, phase);
CREATE INDEX idx_fatigue_responses_mood_date 
  ON fatigue_responses(player_id, created_at) WHERE phase = 'pre';
CREATE INDEX idx_muscle_pain_zones 
  ON fatigue_responses USING GIN(muscle_pain_zones) WHERE phase = 'post';
```

**Dados historicamente capturados:**

- **Humor (mood_score):** pré-sessão apenas. Escala 1–5 (emojis). Permite análise "humor baixo → desempenho"
- **Dores (muscle_pain_zones):** JSON array de zonas selecionadas. Enum validado em frontend: `["pescoço", "ombro", "cotovelo", "punho", "costas", "anca", "joelho", "tornozelo", "tendão_de_aquiles", "outra"]`
- **Exames (has_exams_this_week):** boolean semanal (registado uma vez por semana, aplica a TODOS os treinos da semana seguinte)

**Sync Offline (sem mudança de pattern):**
- Outbox `(Dexie)` + drain existente suportam novos campos atomicamente
- UUIDv7 client-generated mantém-se
- Zero mudança em `enqueue.ts` ou `drain.ts` — apenas nova payload

---

### 1.2 Analytics Schema: Performance Events Polimórficos

**Problema:** Requisito original tinha 7 ações simples (perdas, recuperações, remates, etc). Expansão requer 15+ tipos de eventos, cada um com contextos diferentes (cantos precisam lado+parte; golos precisam tipo de jogada+período; cartões precisam infração_type).

**Solução:** Events polimórficos via **JSON context** (Q8 Recomendação A).

```sql
-- ANTES: performance_events tinha event_type=loss|recovery|shot|... com zona fixa
-- DEPOIS: event_type pode ser qualquer coisa; contexto em JSON

CREATE TABLE performance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id),
  session_id uuid NOT NULL REFERENCES sessions(id),
  player_id uuid REFERENCES players(id),  -- NULL para eventos coletivos (cantos)
  event_type text NOT NULL,  -- loss, recovery, shot, corner, goal, card, entry_opp_area, entry_own_area
  field_zone field_zone_enum NOT NULL,  -- 6 zonas universais (Q11)
  -- Contexto polimórfico — esperamos Q8 decisão FINAL
  context jsonb,  -- {tipo_jogada, periodo, lado, infraction_type, etc}
  occurred_at timestamp NOT NULL,
  created_at timestamp DEFAULT now(),
  CONSTRAINT chk_event_type CHECK (
    event_type IN ('loss','recovery','shot','pass','pressure','defensive_action','offensive_action',
                   'corner','goal','card','entry_opp_area','entry_own_area')
  ),
  CONSTRAINT chk_player_for_individual (
    CASE WHEN event_type IN ('corner','entry_opp_area','entry_own_area') 
         THEN player_id IS NULL 
         ELSE player_id IS NOT NULL 
    END
  )
);

-- Índices
CREATE INDEX idx_perf_events_session 
  ON performance_events(session_id, occurred_at);
CREATE INDEX idx_perf_events_player 
  ON performance_events(player_id, session_id) WHERE player_id IS NOT NULL;
CREATE INDEX idx_perf_events_context 
  ON performance_events USING GIN(context);  -- JSONB queries rápidas
```

**Field Zones: 6 universais (Q11 Decisão)**

```sql
CREATE TYPE field_zone_enum AS ENUM (
  'defense_left',      -- esquerda defesa
  'defense_center',    -- centro defesa
  'defense_right',     -- direita defesa
  'attack_left',       -- esquerda ataque
  'attack_center',     -- centro ataque
  'attack_right'       -- direita ataque
);
```

**Context JSON Exemplos:**

```json
-- Loss com zona de construção
{loss, defense_left} com context: {construction_zone: "zone_1"}

-- Corner
{corner, defense_left} com context: {side: "left", period: "H1"}

-- Golo
{goal, attack_center} com context: {play_type: "corner|open_play|free_kick", period: "H2_min75", team_scored: "us"|"opponent", scorer_id?: "uuid"}

-- Cartão
{card, defense_center} com context: {color: "yellow"|"red", infraction_type: "word"|"foul", player_id: "uuid"}

-- Entradas na área
{entry_opp_area, null_zone} — nenhuma zona (evento coletivo)
{entry_own_area, null_zone}
```

**Trade-offs Justificados:**

| Aspecto | Polimórfico JSON (A) | Normalizado (B) | NULL fields (C) |
|--------|---|---|---|
| Flexibilidade futura | ⭐⭐⭐ | ⭐ | ⭐⭐ |
| Query complexity | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Index performance | ⭐⭐⭐ (GIN) | ⭐⭐⭐ | ⭐⭐ |
| Evolução sem migração | ⭐⭐⭐ | ❌ | ⭐ |
| **Eleito para MVP** | ✅ A | — | — |

**Porquê A (JSON):**
- Novos tipos de eventos/contextos surgem sem migration (`ALTER TABLE`)
- JSONB tem índices GIN performantes (v. architecture.md caching)
- Queries `context @> '{"play_type": "corner"}'` legíveis
- Suporta future (ex: adicionar `video_timestamp` sem schema change)

---

### 1.3 New Aggregation Tables (Materializado)

**Problema:** % convocatórias e % minutos requerem agregações históricas (Q15). Real-time via JOINs seria N+1 para dashboard 40 jogadores.

**Solução:** View materializada, atualizada via trigger (Q15 Recomendação B).

```sql
-- View materiali para agregações por época
CREATE MATERIALIZED VIEW v_athlete_stats_per_season AS
SELECT
  p.id AS player_id,
  p.club_id,
  s.id AS season_id,
  COUNT(DISTINCT g.id) AS games_in_season,
  SUM(CASE WHEN ml.player_id IS NOT NULL THEN 1 ELSE 0 END) AS games_convoked,
  ROUND(
    100.0 * SUM(CASE WHEN ml.player_id IS NOT NULL THEN 1 ELSE 0 END) 
    / COUNT(DISTINCT g.id),
    1
  ) AS convocation_percentage,
  COALESCE(SUM(
    CASE WHEN ml.started_minute IS NOT NULL 
      THEN (COALESCE(ml.ended_minute, 90) - COALESCE(ml.started_minute, 0))
      ELSE 0 
    END
  ), 0) AS total_minutes_played,
  ROUND(
    100.0 * COALESCE(SUM(
      CASE WHEN ml.started_minute IS NOT NULL 
        THEN (COALESCE(ml.ended_minute, 90) - COALESCE(ml.started_minute, 0))
        ELSE 0 
      END
    ), 0) / (COUNT(DISTINCT g.id) * 90),
    1
  ) AS minutes_percentage
FROM players p
JOIN seasons s ON p.club_id = s.club_id
LEFT JOIN sessions g ON s.id = g.season_id AND g.club_id = p.club_id
LEFT JOIN match_lineups ml ON g.id = ml.session_id AND p.id = ml.player_id
GROUP BY p.id, p.club_id, s.id;

CREATE UNIQUE INDEX idx_athlete_stats_season 
  ON v_athlete_stats_per_season(player_id, season_id);

-- Trigger para refresh incremental pós-substituição
CREATE OR REPLACE FUNCTION refresh_athlete_stats_trigger()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_athlete_stats_per_season;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_athlete_stats
AFTER INSERT OR UPDATE ON match_lineups
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_athlete_stats_trigger();
```

**Clean Sheet Agregação:**

```sql
CREATE MATERIALIZED VIEW v_clean_sheets AS
SELECT
  session_id,
  COUNT(*) FILTER (WHERE context->>'team_scored' = 'opponent') AS goals_conceded,
  CASE WHEN COUNT(*) FILTER (WHERE context->>'team_scored' = 'opponent') = 0
    THEN 90  -- assumir 90 minutos se sem golos contra
    ELSE 90  -- depois derivar minutos exatos se temos time_conceded futura
  END AS minutes_without_goal
FROM performance_events
WHERE event_type = 'goal'
GROUP BY session_id;
```

---

## 2. Frontend Architecture Changes

### 2.1 UI Components Expansion

**Novos componentes:**

| Componente | Localização | Tech | Complexidade |
|-----------|------------|------|--------------|
| **BodyDiagram** | `components/domain/wellness/BodyDiagram.tsx` | SVG custom + Zustand (sticky) | Médio |
| **MoodScale** | `components/domain/wellness/MoodScale.tsx` | Emoji buttons + RHF integration | Baixo |
| **ExamsToggle** | `components/domain/wellness/ExamsToggle.tsx` | Shadcn Toggle + labels | Baixo |
| **TouchscreenV2** | `components/domain/analytics/TouchscreenRecorder.tsx` | Refactor existente + 4º ecrã condicional | Alto |
| **TimeRecorders** | `components/domain/analytics/MatchTimeRecorders.tsx` | 2 inputs (total, useful) — form pós-jogo | Baixo |

**BodyDiagram (SVG Custom — Q5 Recomendação A)**

```tsx
// components/domain/wellness/BodyDiagram.tsx
import { useState } from 'react';

const BODY_ZONES = {
  neck: { label: 'Pescoço', path: 'M100,20...' },
  shoulder: { label: 'Ombro', path: '...' },
  // ... 10 zonas total
};

export function BodyDiagram({ selected, onToggle }: Props) {
  return (
    <svg viewBox="0 0 200 400" className="w-full max-w-sm">
      {Object.entries(BODY_ZONES).map(([key, zone]) => (
        <path
          key={key}
          d={zone.path}
          className={cn(
            'cursor-pointer transition-colors',
            selected.includes(key) ? 'fill-red-500' : 'fill-gray-300'
          )}
          onClick={() => onToggle(key)}
          aria-label={zone.label}
        />
      ))}
    </svg>
  );
}
```

**Constraints:** 
- Offline funcional (SVG é apenas DOM)
- Mobile-first: 360px width, touch targets ≥44px
- Sem assets externas (zero npm dependency)
- Sub-14 compreensível (nomes em PT, sem terminologia médica)

---

### 2.2 Touchscreen 3-Ecrãs V2: 4º Ecrã Condicional

**Problema:** Golos precisam contexto (tipo de jogada, período). Cartões precisam infração. Eventos simples (perdas) não — seria overhead inútil.

**Solução:** Ecrã 4 **condicional** baseado em `event_type` (Q13 Recomendação B).

```tsx
// components/domain/analytics/TouchscreenRecorder.tsx (refactor)

export function TouchscreenRecorder({ sessionId }: Props) {
  const [screen, setScreen] = useState<1|2|3|4>('1');
  const [selectedPlayer, setSelectedPlayer] = useState<string | 'team'>();
  const [selectedAction, setSelectedAction] = useState<EventType>();
  const [selectedZone, setSelectedZone] = useState<FieldZone>();

  const needsContextScreen = ['goal', 'card'].includes(selectedAction);

  return (
    <>
      {screen === 1 && (
        <PlayerScreen
          onSelectPlayer={(id) => {
            setSelectedPlayer(id);
            setScreen(2);
          }}
        />
      )}

      {screen === 2 && (
        <ActionScreen
          allowTeam={true}  // botão "Equipa" para cantos, etc
          onSelectAction={(action) => {
            setSelectedAction(action);
            setScreen(3);
          }}
        />
      )}

      {screen === 3 && (
        <ZoneScreen
          onSelectZone={(zone) => {
            setSelectedZone(zone);
            // Lógica: Se precisa contexto, vai para 4; senão submete
            if (needsContextScreen) {
              setScreen(4);
            } else {
              handleSubmitEvent({
                type: selectedAction,
                playerId: selectedPlayer,
                zone: selectedZone,
              });
            }
          }}
        />
      )}

      {screen === 4 && needsContextScreen && (
        <ContextScreen
          eventType={selectedAction}
          onSubmit={(context) => {
            handleSubmitEvent({
              type: selectedAction,
              playerId: selectedPlayer,
              zone: selectedZone,
              context,
            });
          }}
        />
      )}
    </>
  );
}
```

**Performance: ≤1s por evento (Q13 Constraint)**

- Zero animações entre ecrãs
- State machine local (Zustand ou context), não servidor
- Eventos submetem direto à outbox (async, não aguardam resposta)
- Feedback háptico nativo (`navigator.vibrate([50])`)

---

### 2.3 Match Time Recorders (Pós-Jogo)

**Requisito:** "Tempo de jogo útil através de 2 relógios"

**Interpretação:** 2 campos pós-jogo (não em tempo real):
- Tempo total (0–90)
- Tempo com bola em jogo (0–90)

**Implementação (Q14 Recomendação B — Pós-Jogo):**

```tsx
// components/domain/analytics/MatchTimeRecorders.tsx

export function MatchTimeRecorders({ sessionId }: Props) {
  const form = useForm<{
    total_minutes: number;
    useful_minutes: number;
  }>({
    resolver: zodResolver(z.object({
      total_minutes: z.number().min(0).max(120),
      useful_minutes: z.number().min(0).max(120),
    })),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tempo Total</Label>
          <Input {...form.register('total_minutes')} type="number" />
          <span className="text-xs text-gray-500">0–120 minutos</span>
        </div>
        <div>
          <Label>Tempo com Bola em Jogo</Label>
          <Input {...form.register('useful_minutes')} type="number" />
          <span className="text-xs text-gray-500">0–90 minutos</span>
        </div>
      </div>
      <Button type="submit">Guardar Tempos</Button>
    </form>
  );
}
```

**Armazenamento:** `performance_events` com `event_type='match_time_record'` e `context: {total_minutes, useful_minutes}`.

---

## 3. Backend Changes

### 3.1 RLS Expansion (Wellness + Analytics)

**Novo:** RLS policies para `fatigue_responses` e `performance_events` devem ser **iguais aos padrões existentes**.

```sql
-- RLS para fatigue_responses (estende modelo existente)
ALTER TABLE fatigue_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fatigue_read_by_player_or_staff" ON fatigue_responses
  FOR SELECT
  USING (
    club_id = auth.club_id()
    AND (
      auth.user_role() IN ('coach', 'analyst')
      OR (auth.user_role() = 'player' AND player_id = auth.uid())
    )
  );

CREATE POLICY "fatigue_write_by_player_or_staff" ON fatigue_responses
  FOR INSERT
  WITH CHECK (
    club_id = auth.club_id()
    AND (
      auth.user_role() IN ('coach', 'analyst')
      OR player_id = auth.uid()
    )
  );

-- RLS para performance_events (padrão similar)
ALTER TABLE performance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_events_read_by_staff" ON performance_events
  FOR SELECT
  USING (club_id = auth.club_id() AND auth.user_role() IN ('coach', 'analyst'));

CREATE POLICY "perf_events_write_by_analyst" ON performance_events
  FOR INSERT
  WITH CHECK (club_id = auth.club_id() AND auth.user_role() = 'analyst');
```

**Restrição:** Jogadores **NUNCA** vêem dados de wellness após submission (por design — mediação staff). RLS confirma esta regra.

---

### 3.2 Outbox Pattern: Novos Campos

**Zero mudança em `lib/outbox/` ou `lib/outbox/drain.ts`.**

Novos campos entram atomicamente na mesma submissão:

```ts
// Exemplo: submitWellnessResponse (existente, agora com novos campos)
await enqueueOutboxItem({
  type: 'wellness_response',
  payload: {
    sessionId,
    playerId,
    phase: 'post',
    energy: 4,
    // ... 5 dimensões originais
    // NOVOS:
    mood: 3,
    musclePainZones: ['joelho', 'tornozelo'],
    hasExamsThisWeek: false,
  },
});
```

**Drain (sincronização):**
- Payload é batched + envia ao servidor com UUIDv7 + idempotency key
- Servidor valida `club_id` em RLS (second layer)
- Sem breaking change em `drain.ts`

---

## 4. Performance Guardrails

### 4.1 Painel ≤2s: Manter (Q16 Decisão)

**Recomendação:** Agregações **não entram no Painel de Prontidão**.

Painel mantém:
- ✅ ACWR (cálculo existente)
- ✅ sRPE (cálculo existente)
- ✅ Fadiga (média 5D pré-sessão)
- ✅ Status semáforo

**Excluído do Painel (em dashboard separado — Growth):**
- ❌ % convocatórias (requires agregação histórica)
- ❌ % minutos (requires agregação histórica)
- ❌ Clean sheet (requires agregação de golos)

**Query do Painel inalterada:**

```sql
SELECT jogador_id, acwr, sRPE, semaforo_status 
FROM v_readiness_panel 
WHERE club_id = ? AND sessao_id = ?
-- P95 ≤2s confirmado em benchmark
```

**Dashboard secundário (Growth, sem impacto em MVP):**

```sql
-- Dashboard de Estatísticas (será criado em Sprint 1.6+)
SELECT 
  p.id,
  s.convocation_percentage,
  s.minutes_percentage,
  cs.minutes_without_goal,
  ...
FROM players p
JOIN v_athlete_stats_per_season s ON p.id = s.player_id
LEFT JOIN v_clean_sheets cs ON ...
WHERE p.club_id = ?
```

---

### 4.2 Sync Idempotência: Novos Campos

**UUIDv7 + outbox pattern existente suportam:**

- ✅ `fatigue_responses` com novos campos (JSON `muscle_pain_zones`, boolean `has_exams_this_week`)
- ✅ `performance_events` com `context` JSON polimórfico
- ✅ Replay seguro se evento se perde em transmissão (mesmo UUID não reinsere)

**Teste obrigatório (Sprint 1.5):**

```ts
// Validar idempotência com novos campos NULL parciais
describe('Sync with new wellness fields', () => {
  it('should handle muscle_pain_zones = null on pre-session submission', async () => {
    const response = await submitWellnessResponse({
      sessionId, phase: 'pre',
      mood: 3,
      musclePainZones: null,  // Campo não aplicável
      hasExamsThisWeek: true,
    });
    expect(response.ok).toBe(true);
  });
});
```

---

## 5. Decisões Arquiteturais Críticas

### 5.1 Decision Table (da Technical Review Agenda)

| # | Questão | Opção A | Opção B | **Eleita** | Impacto |
|----|---------|---------|---------|----------|--------|
| 1 | Dores: modelagem | JSON | Enum bitfield | **A** | Schema simples, extensível |
| 2 | Sono: implícito | Capturar implicitamente | Campo explícito | **A (implícito)** | Sem mudança UX |
| 3 | Exames: modelo | Flag booleano | Multi-select + datas | **A** | Simples, semanal |
| 5 | Body diagram | SVG custom | Buttons | **A** | Offline, controlo |
| 8 | Performance events | JSON polimórficos | Normalizado | **A** | Flexível, evolução |
| 11 | Zonas | 6 universais | 3 sistemas | **6 universais** | Queries simples |
| 13 | Touchscreen: contexto | 4º ecrã condicional | Universal | **Condicional** | Performance ≤1s |
| 14 | Tempo útil | Real-time | Pós-jogo | **Pós-jogo** | Sem distração |
| 15 | Agregações | Materializado | Real-time | **Materializado** | Painel ≤2s |
| 16 | Painel inclui tudo? | Sim (todas as métricas) | Parcial (ACWR+sRPE) | **Parcial** | Performance crítica |

**Decisões bloqueadas (requerem reunião técnica):**

- Q4: RLS wellness bloqueio imediato — **Recomendação: Sim, por design**
- Q17: GDPR Art. 9 novo consentimento? — **Requer legal review**

---

### 5.2 Constraints Validados

| Constraint | Situação | Validação |
|-----------|---------|----------|
| **€0/mês** | ✅ Mantido | JSON + materializado view = zero cost extra Supabase |
| **Painel ≤2s** | ✅ Mantido | Agregações em dashboard secundário, não Painel |
| **Offline-first** | ✅ Mantido | Outbox pattern suporta novos campos atomicamente |
| **Zero integrações** | ✅ Mantido | SVG custom, emoji nativas, no new npm |
| **RLS multi-tenant** | ✅ Expandida | `club_id` em `fatigue_responses` + `performance_events` |
| **UUIDv7 idempotência** | ✅ Mantida | Sem mudança de pattern, novos campos fazem parte do payload |

---

## 6. Implementation Roadmap

### Sprint 1.4 (Prototipo + Decisões Técnicas)

**Bloqueadores resolvidos:**

1. ✅ Backend: proposta de redesign `performance_events` (polimórfico JSON)
2. ✅ Frontend: prototipo SVG body diagram (offline, mobile)
3. ✅ PM: escalate GDPR Art. 9 para legal review
4. ✅ DevOps: benchmark performance queries (baseline)

**Deliverables:**

- [ ] Schema SQL com `fatigue_responses` expandida (30 min review)
- [ ] Prototipo `BodyDiagram` component (4h dev + teste offline)
- [ ] Prototipo touchscreen 4º ecrã condicional (4h dev)
- [ ] Definição enums: field_zones, event_types, muscle_zones (1h alinhamento)

### Sprint 1.5 (Implementação MVP)

**Semana 4 — 40h de trabalho estimado:**

- [ ] Schema + migrations (6h)
- [ ] Frontend wellness (8h: body diagram + emoji scale + exams flag)
- [ ] Touchscreen analytics v2 (12h: 4º ecrã, novo types de evento)
- [ ] RLS policies + testes (3h)
- [ ] Outbox + sync tests (5h: idempotência, novos campos)
- [ ] Agregações materialized views + triggers (4h)

### Sprint 1.6+ (Growth — Pós-MVP)

- [ ] Dashboards exploratórios (16h: heatmaps, sparklines, bem-estar trends)
- [ ] Performance benchmarking (4h: validar Painel ≤2s com dados reais)
- [ ] PDF export + email send (8h)

---

## 7. Risk Mitigations

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|--------|----------|
| **Schema polimórfico complexo** | Média | Alto | Prototype Q1 eventos antes de commit; validar `context` JSON parsing |
| **Painel >2s com View materializada** | Baixa | Alto | Benchmark com 5000+ eventos sintéticos; índice GIN confirmado rápido |
| **Body diagram offline falha** | Baixa | Médio | SVG é DOM puro, 0 assets externas — offline garantido |
| **RLS em performance_events mal scoped** | Média | Alto | Audit: listar queries sem `club_id` check — CI fail |
| **GDPR consentimento inválido** | Baixa | **Muito Alto** | Revisar com legal ANTES de dev; DPIA assinada |
| **Sync outbox com JSON null fields** | Baixa | Médio | Testes de replayability com payloads incompletos |

---

## 8. Success Criteria (Viabilidade MVP)

✅ **MVP é viável se todos estes critérios são atingidos:**

- Painel de Prontidão continua **≤2s** P95 com 40 jogadores (benchmark: data real ou sintética)
- Questionário novo **≤2.5 min** P95 (UX teste com sub-14)
- Touchscreen analytics **≤1s por evento** (heurística: não aguarda resposta servidor)
- Sync offline **idempotente** com novos campos (testes automatizados de replay)
- RLS **validada em todas as queries** novas (audit script CI)
- Zero integrações externas obrigatórias (audit npm dependencies)
- Custo **€0/mês** mantido (audit Supabase quotas pós-release)

✗ **Se qualquer um falha:**
- Rejeitar feature para Growth Phase (Sprint 1.6+)
- Documentar trade-off + blocker no Retrospectivo

---

## 9. Outstanding Questions (Requerem Reunião Técnica)

| # | Questão | Opções | Owner | Deadline |
|----|---------|--------|-------|----------|
| 4 | RLS wellness: bloqueio imediato? | Sim / Não | Backend | Sprint 1.4 |
| 17 | Art. 9 GDPR: novo consentimento? | Sim / Não / TBD | Legal + PM | Sprint 1.4 |

Todas as outras **20 questões do Technical Review Agenda** têm recomendação PM documentada acima.

---

**Documento preparado por:** Winston (System Architect)  
**Data:** 2026-05-09  
**Status:** Ready for Technical Validation  
**Próximo passo:** Reunião técnica (quinta-feira 14 mai, 60 min) para resolver Q4 + Q17 + validar decisões A–F acima.
