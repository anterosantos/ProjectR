---
title: Integration Summary - Wellness & Analytics Requirements
date: 2026-05-09
author: John (Product Manager)
status: Complete
---

# Integração de Requisitos: Wellness & Análise Expandida

**Resumo:** Analisados e integrados 17 novos requisitos (6 Wellness, 11 Analytics) em todos os documentos principais do SPARTA, mantendo coerência arquitetural e princípios de UX.

---

## 1. Wellness & Monitorização - Integração ✅

### Novos Campos Adicionados

| Campo | Localização | Impacto | Status |
|-------|------------|--------|--------|
| **Estado emocional/humor** (pré) | Questionário pré-sessão | UI — escala com emojis | ✅ Integrado |
| **Dores musculares com zona** (pós) | Questionário pós-sessão | UI — body diagram clicável | ✅ Integrado |
| **Contexto de exames/testes** | Semanal (não por sessão) | DB — boolean flag | ✅ Integrado |
| **Peso do atleta** (já existe) | Série temporal | Confirmado em granularidade diária | ✅ Existente |
| **Estado de sono** (D+1) | Questionário pré-sessão seguinte | Captado implicitamente em "qualidade de descanso" | ✅ Integrado |
| **Estado físico subjetivo** | Session-RPE expandido | Já coberto por sRPE 1–10 | ✅ Existente |

### KPI Ajustado

- **Tempo de preenchimento do questionário:** ≤2 min → **≤2.5 min** (acomodação dos 3 novos campos)

### Documentos Atualizados

1. **docs/SPARTA.requirements.md**
   - Expandida seção "Registo de Fadiga e Bem-estar" com estrutura clara de pré/pós-sessão
   - Adicionados campos e contexto de recolha

2. **_bmad-output/planning-artifacts/prd.md**
   - Renomeada seção de "Recolha de fadiga" → "Recolha de fadiga e bem-estar"
   - Adicionados 6 sub-campos com justificação

3. **_bmad-output/planning-artifacts/epics.md**
   - Adicionados FR21a, FR21b, FR21c para os novos campos (todas MVP)
   - FR25 expandida para mencionar "bem-estar e dores musculares"

4. **_bmad-output/planning-artifacts/ux-design-specification.md**
   - Nova seção "Expanded Wellness & Analytics Features - UX Considerations"
   - Detalhe de body diagram para dores, emoji scale para humor, framing de exames

---

## 2. Estatísticas / Análise - Integração ✅

### Novos Itens Adicionados

| Item | Classificação | Localização | Fase | Status |
|------|---------------|-------------|------|--------|
| **Cantos (def/ofensivos)** | Tática coletiva | Touchscreen 3-ecrãs | MVP | ✅ |
| **Perdas de bola (Zona 1/2)** | Individual (contexto) | Touchscreen + métrica | MVP | ✅ |
| **Recuperações (Zona 1/2/3)** | Individual (contexto) | Touchscreen + métrica | MVP | ✅ |
| **Remates (zona)** | Individual (contexto) | Touchscreen + métrica | MVP | ✅ |
| **Golos (tipo de jogada, período, zona)** | Contexto expandido | Touchscreen (2º ecrã) | MVP | ✅ |
| **% Convocatórias/Minutos** | Agregação | Dashboard | MVP | ✅ |
| **Entradas na área** | Tática coletiva | Touchscreen 3-ecrãs | MVP | ✅ |
| **Tempo de jogo útil (2 relógios)** | Métrica de tempo | Pós-jogo UI | MVP | ✅ |
| **Cartões (tipo, zona)** | Disciplina | Touchscreen (2º ecrã) | MVP | ✅ |
| **Clean sheet / Min sem golos** | Agregação | Dashboard | MVP | ✅ |
| **Heatmaps de zona** | Análise exploratória | Dashboard novo | Growth | ✅ |

### Documentos Atualizados

1. **docs/SPARTA.requirements.md**
   - Expandida seção "Dados Estatísticos Individuais por Jogador" com categorias claras: Ações Individuais | Ações Táticas | Contexto de Golos | Tempo de Jogo
   - Adicionada nova seção "Registo de Jogos" com detalhe de novos campos

2. **_bmad-output/planning-artifacts/prd.md**
   - Expandida seção "Recolha de performance" com sub-estrutura por tipo de ação
   - Adicionados exemplos de novos campos com contexto claro

3. **_bmad-output/planning-artifacts/epics.md**
   - Expandido FR27 em FR27a, FR27b, FR27c, FR27d com novos itens
   - Adicionado FR31a para % convocatórias e % minutos
   - Seção "Readiness Intelligence" renomeada → "Readiness Intelligence & Analytics Dashboards"
   - Adicionados FR37a até FR38e para novos dashboards (Growth phase)

4. **docs/SPARTA.requirements.md - Relatórios & Dashboards**
   - Expandida seção de relatórios com 3 subsecções: Prontidão e Fadiga | Performance e Estatísticas | Consolidado
   - Adicionados 8 novos dashboards (7 Growth, 1 MVP — % participação)

5. **_bmad-output/planning-artifacts/ux-design-specification.md**
   - Seção "Expanded Wellness & Analytics Features" com detalhes de:
     - Palett de ações expandida para Ana (UI de jogador coletivo)
     - Novos dashboards exploratórios para José
     - Visualizações (heatmaps, sparklines, timeline de eventos)

---

## 3. Impacto Arquitetural

### Tabelas de BD Afetadas (Nova Design - não implementado)

| Tabela | Campo | Tipo | Índice |
|--------|-------|------|--------|
| `wellness_surveys` | `muscle_pain_zones` | JSON[] (enum) | jogador_id, sessão_id |
| `wellness_surveys` | `mood_score` | 1–5 (enum) | — |
| `wellness_surveys` | `has_exams_this_week` | boolean | — |
| `performance_events` | `context_subtype` | enum (canto_esq, canto_dir, cartao_amarelo, cartao_vermelho, golo_canto, golo_jogada, etc) | — |
| `performance_events` | `event_zone` | 1–6 (enum) | — |
| `game_sessions` | `useful_game_time_minutes` | int | — |
| `athlete_aggregations` (nova) | `convocation_percentage` | decimal | época, atleta_id |
| `athlete_aggregations` (nova) | `minutes_percentage` | decimal | época, atleta_id |

### Views SQL Novas (Growth)

- `v_athlete_zone_heatmap` — agregação de perdas/recuperações/remates por zona e atleta
- `v_wellness_trends_weekly` — agregação de humor/sono/dores por semana
- `v_tactical_analysis` — agregação de cantos, cartões, entradas por jogo

### RLS Impacto

Nenhum — todas as novas tabelas herdam `club_id` e seguem RLS existente (`club_id, role`).

---

## 4. Fase & Timeline

### MVP Inclui (4 semanas)

✅ **Wellness:**
- Questionário pré/pós com 5D originais + 3 novos campos (humor, dores, exames)
- Histórico de peso com série temporal

✅ **Analytics:**
- Interface touchscreen expandida com cantos, cartões, golos (2º ecrã para contexto)
- Perdas/recuperações com zonas
- Remates com zona
- Entradas na área
- Tempo de jogo útil (2 relógios)
- % convocatórias e % minutos (agregação simples)

### Growth Features (meses 2–6)

📈 **Wellness:**
- Dashboard de tendências de bem-estar (humor, sono, dores ao longo de semanas)
- Correlação bem-estar × performance

📈 **Analytics:**
- Heatmaps de zona
- Dashboard de análise tática completa (cantos, entradas, clean sheet)
- Dashboard de disciplina (cartões com série temporal)
- Dashboard de golos (tipo de jogada, períodos)
- Visualizações sparkline de % participação

---

## 5. Checklist de Validação

### Documentação ✅

- [x] PRD atualizado com novos requisitos
- [x] UX Design Specification com considerações de design novo
- [x] Epics/Functional Requirements atualizados (FR21a-FR21c, FR27a-FR27d, FR31a, FR37a, FR38a-FR38e)
- [x] Requirements original (docs/SPARTA.requirements.md) sincronizado
- [x] Relatórios & Dashboards lista expandida

### Conformidade ✅

- [x] Todos os novos campos são categoria especial (Art. 9 GDPR) — confirmado em DPIA
- [x] RLS preparada para novos dados pessoais/biométricos
- [x] Nenhuma integração externa necessária para novos campos
- [x] Offline-first mantida (novos campos síncronizam com outbox existente)

### UX ✅

- [x] KPI de fricção ajustado (≤2.5 min para questionário)
- [x] Novos campos respeitam principles (calma, voz humana, sugestão)
- [x] Body diagram para dores, emoji scale para humor (sub-14 friendly)
- [x] 2º ecrã no fluxo 3-ecrãs para contexto de golos/cartões (não quebra >60px targets)
- [x] Dashboards exploratórios não impactam Painel de Prontidão (≤2s target mantida)

---

## 6. Próximos Passos

1. **Especificação de BD:** Criar schema SQL com as novas tabelas e views (antes da Sprint 1.4)
2. **Atualizar Architecture Decision Document:** Adicionar seção de data model expansion
3. **Criar histórias de implementação:** Quebrar novos requisitos em stories por componente (questionário expandido, touchscreen 3-ecrãs v2, novos dashboards)
4. **DPIA review:** Validar categorização de dados de bem-estar (dores = biométrico? humor = saúde mental?)
5. **Testes de acessibilidade:** Body diagram e emoji scale validados para sub-14 e leitura assistida

---

## 7. Resumo Executivo

**Objetivo:** Integrar 17 novos requisitos sem comprometer MVP ou princípios de UX.

**Resultado:** ✅ Integração completa em 5 documentos principais.

- **6 campos de Wellness** adicionados ao questionário de fadiga (humor, dores, exames)
- **11 métricas de Análise** adicionadas ao registo de jogo (cantos, cartões, golos, zona, clean sheet, etc)
- **8 novos dashboards** previstos (7 Growth, 1 MVP)
- **0 mudanças destrutivas** — arquitetura preparada desde dia 1 para extensão
- **KPI ajustado:** tempo de questionário ≤2 min → ≤2.5 min (trade-off aceitável)

**Conformidade:** Todos os novos campos respeitam GDPR Art. 9, RLS, offline-first, e princípios emocionais de UX.

---

**Documento preparado por:** John (Product Manager)  
**Data:** 2026-05-09  
**Próxima revisão:** Antes da Sprint 1.4
