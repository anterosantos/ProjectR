---
title: Technical Review Agenda - Wellness & Analytics Expansion
date: 2026-05-09
author: John (Product Manager)
audience: Engineering Team (Backend, Frontend, DB)
status: Ready for Discussion
duration: 60 minutes estimated
---

# 🔧 Agenda de Revisão Técnica — Expansão Wellness & Analytics

**Objetivo:** Validar viabilidade técnica da integração de 17 novos requisitos (6 Wellness, 11 Analytics) sem comprometer MVP ou constraints existentes (€0/mês, ≤2s Painel, offline-first).

**Restrições Inflexíveis:**
- Custo zero (Supabase free tier, Vercel Hobby)
- Painel de Prontidão ≤2s P95 para 40 jogadores
- RLS multi-tenant `(club_id, role)` em todas as tabelas
- Offline-first com outbox UUIDv7 + drain por foreground
- Sem integrações externas obrigatórias

---

## 1️⃣ Wellness & Questionário Expandido

### 1.1 Contexto de Negócio

Questionário pré/pós-sessão expande de **5 dimensões** para **8 campos:**

**Pré-Sessão (adiciona 1):**
- Energia muscular, Concentração, Sono, Desconforto, Estado Emocional (originais)
- **+ Humor/Estado Emocional (escala emoji 1–5)** ← novo

**Pós-Sessão (adiciona 2):**
- 5 originais
- **+ Dores musculares (zona do corpo: 10 zonas como body diagram)** ← novo
- **+ Flag contextual "Tem testes/exames esta semana?"** ← novo (semanal, não por sessão)

### 1.2 Questões Técnicas

#### 1.2.1 Schema de BD

**QUESTÃO 1:** Como modelar dores musculares (multi-select de zonas)?

_Opções em discussão:_
- A) JSON array: `muscle_pain_zones: ["joelho", "tornozelo"]` (PostgreSQL native)
- B) Enum + bitfield: `pain_zones_bitmask: 0b0010010` (compact, queries rápidas)
- C) Tabela normalizada: `wellness_survey_pains(survey_id, zone_id)` (ACID, query complexa)

_Implicação:_
- A) Flexível, queryable via JSONB operators, índices possíveis (`GIN`)
- B) Rápido, mas menos flexível (adicionar zona requer migração)
- C) Correto, mas N+1 risk se não cuidado com eager loading

**Recomendação PM:** A (JSON) — suporta evolução futura (novas zonas) sem migração.

---

**QUESTÃO 2:** Onde recolher "estado de sono do dia seguinte"?

Requisito original: "Estado de sono no dia a seguir ao treino"

_Cenário:_ Jogador treina segunda, questionário pós-sessão segunda (sono = ruim porque treino de manhã). Terça, no questionário pré-sessão, registamos sono = 2/5 (dormi mal). Isto é "estado de sono do dia seguinte"?

_Opcionalidade:_
- A) Capturar implicitamente: "qualidade de descanso" no questionário pré-sessão seguinte (já existe, sem mudança)
- B) Campo explícito "Como dormiste ontem noite?" no pré-sessão (adiciona contexto mas redundância)

**DECISÃO NECESSÁRIA:** A ou B?

---

**QUESTÃO 3:** Flag "tem testes/exames" — frequência e contexto?

_Requisito diz:_ "Possibilidade do atleta referir se tem testes ou exames na semana pois vai impactar possivelmente o treino"

_Interpretação:_
- Recolhido uma vez por semana (quinta-feira? segunda-feira?)
- Aplica-se a TODOS os treinos/jogos da semana seguinte (flag semanal, não por sessão)
- Impacta cálculo de ACWR? (aumenta threshold de alerta?)

_Opcionalidade:_
- A) Campo booleano simples: `has_exams_this_week: boolean` (recolhido em UI, semanal)
- B) Multi-select + datas: `exams: [{date: "2026-05-15", type: "teste|exame"}]` (mais granular, mais complexo)

**DECISÃO NECESSÁRIA:** A ou B? Se A, qual dia da semana para recolha?

---

#### 1.2.2 RLS & Permissões

**QUESTÃO 4:** Jogadores devem poder VER suas respostas de bem-estar?

Arquitetura atual: Jogadores vêem apenas questionário pré/pós (no momento de responder). Após submission, dados são opacos ao jogador — staff vê tudo.

_Com novos campos:_ Dores musculares e humor podem ser "sensíveis". Se Ana mostra ao José um gráfico "Tomás com dores crescentes + humor em queda = risco de lesão", Tomás não vê isso (por design — mediação staff).

_Questão:_ RLS precisa bloquear acesso do jogador a:
- Seus próprios dados de bem-estar após submission? (SIM — por design)
- Ou apenas após X minutos/horas? (para feedback imediato?)

**✅ DECISÃO RESOLVIDA:** Jogador vê AMBAS as respostas (pré e pós-sessão).
- RLS permite que o player veja todas as suas próprias respostas (`player_id = auth.uid()`)
- Sem restrição de fase — transparência total sobre seus dados
- Alinhado com Art. 15 GDPR (direito de acesso)

---

#### 1.2.3 Frontend & UX

**QUESTÃO 5:** Body diagram para dores — implementação?

_Opções:_
- A) SVG interativo (hover/click em zona do corpo, highlight + toggle)
- B) Botões agrupados por região (pescoço, ombro, etc — lista visual)
- C) React component library (ex: `react-body-diagram` — NPM)

_Constraints:_
- Sub-14 comprehensível (sem linguagem médica)
- Mobile-first (360px width)
- Offline funcional (sem assets externas)
- <2s para render

**Recomendação Frontend:** SVG custom (A) — mais controlo, sem dependência externa, reutilizável em dashboards futuros.

---

**QUESTÃO 6:** Emoji scale para humor — acessibilidade?

_Escala proposta:_ 😢 😐 😊 😄 😃 (1–5, pré-sessão)

_Questões:_
- Texto alt obrigatório para cada emoji? ("Muito triste", "Neutro", etc)
- Apenas emojis ou emojis + números (1–5)?
- Sub-14 compreende? (sim — Daylio, Snapchat, etc usam)

**Recomendação Frontend:** Emojis + labels curtos em PT, com `aria-label` para acessibilidade. Texto alt em PT, não emoji Unicode.

---

### 1.3 Impacto em Sync Offline

**QUESTÃO 7:** Novas respostas de wellness entram no outbox existente?

_Contexto:_ Outbox atual (Dexie IndexedDB) sincroniza questionários + eventos com UUIDv7.

_Novo:_ Adicionamos 3 novos campos ao questionário — `mood_score`, `muscle_pain_zones`, `has_exams_this_week`.

_Questão:_ Mudança de schema na submissão?

- A) Tabela `wellness_responses` única, com todos os 8 campos (mudança mínima)
- B) Tabela separada `wellness_mood`, `wellness_pain`, `wellness_exams` (normalização)

**Recomendação Backend:** A — manter submissão atômica, sem mudança de outbox pattern.

---

### 1.4 Estimativa de Complexidade

| Componente | Tamanho | Risco | Notas |
|-----------|--------|-------|-------|
| Schema DB (wellness expandido) | 2–3h | Baixo | JSON array para dores, 2 novos campos |
| Migration + RLS | 2–3h | Médio | Validar RLS em todos os acessos |
| Frontend questionário (body diagram) | 6–8h | Médio | SVG custom, mobile-first, offline |
| Emoji scale UX | 1–2h | Baixo | Component simples + labels |
| Sync & outbox | 1–2h | Baixo | Mudança mínima de schema |
| **Total Wellness** | **12–18h** | — | Requer 1.5–2 dias um dev |

---

## 2️⃣ Analytics & Estatísticas Expandidas

### 2.1 Contexto de Negócio

Interface touchscreen 3-ecrãs de **7 ações** expande para **15+ eventos:**

**Ações individuais (já existem, ganham zona):**
- Perdas → + zona (Z1, Z2)
- Recuperações → + zona (Z1, Z2, Z3)
- Remates → + zona (6 zonas: defesa-esquerda, defesa-centro, defesa-direita, ataque-esquerda, ataque-centro, ataque-direita)

**Ações coletivas (NOVAS):**
- Cantos defensivos/ofensivos (+ parte do jogo, + lado: esquerda/direita)
- Entradas na área adversária (contador simples)
- Entradas permitidas na nossa área (contador simples)

**Eventos (NOVOS, requerem 2º ecrã de contexto):**
- Golos (+ tipo de jogada: canto, corrida, livre direto, outro; + período; + zona; + atleta)
- Cartões (+ tipo: palavra/falta; + zona do campo)

**Agregações:**
- Clean sheet (minutos sem sofrer golos — derivado de golos)
- Tempo de jogo útil (2 relógios: total vs. bola em jogo)

### 2.2 Questões Técnicas

#### 2.2.1 Modelo de Dados — Eventos Polimórficos

**QUESTÃO 8:** Como modelar eventos com tipos variáveis e contextos diferentes?

_Exemplo:_
- Perda de bola: `{tipo: "loss", atleta_id, zona}`
- Canto: `{tipo: "corner", parte: "H1", lado: "esq", ninguém específico}`
- Golo: `{tipo: "goal", atleta_id, zona, periodo, tipo_jogada, equipa_marcou?}`

_Opções:_
- A) Tabela polimórfica única `performance_events` com JSON context: `{tipo, data_polimórfica: {...}}`
- B) Tabelas separadas por tipo: `individual_actions`, `team_actions`, `goals`, `cards`
- C) Enum `event_type` + campos opcionais: `{event_type, athlete_id?, corner_side?, goal_type?, ...}`

_Trade-offs:_
- A) Flexível, escalável, mas queries complexas + índices JSONB podem ser lentos
- B) Normalizado, queries rápidas, mas N+1 risk ao agregar
- C) Simples, mas muitos campos NULL, menos legível

**Recomendação Backend:** A com índices JSONB — suporta evolução (novos contextos sem migração), queryable com `@>`, performante com índices GIN.

**QUESTÃO TÉCNICA CRÍTICA:** A tabela `performance_events` atual suporta isto ou precisa redesign?

_Ação necessária:_ Backend revisar schema atual, mostrar proposta de expansão.

---

**QUESTÃO 9:** Golo — qual atleta marcou ou sofreu?

_Contexto:_ Um golo é evento de equipa (marcado por A, contra B). Qual atleta registamos?

_Opções:_
- A) `athlete_id` = autor do golo (se conhecemos). Golo sofrido = nenhum athlete_id, ou `athlete_id` do guarda-redes?
- B) Golo sempre registado sem athlete_id — contexto no dashboard (agregação por equipa, não por atleta)
- C) 2 registos: um para atleta que marcou, um para defesa que sofreu

**Recomendação PM:** A + guarda-redes registado em `athlete_id` para golos sofridos — permite análise "golos sofridos por guarda-redes".

---

**QUESTÃO 10:** Cartões — atleta ou infração?

_Contexto:_ Cartão sempre tem atleta (levou o cartão). Infrações podem ser relacionadas a ações prévias (ex: cartão por palavra após um lance).

_Dados:_
- `{tipo: "card", atleta_id, yellow_or_red, infraction_type: "palavra"|"falta", zona_campo}`

_Questão:_ Refrência a `performance_event` anterior? (ex: cartão por falta num `loss`?)

**Recomendação PM:** Não — cartão é evento standalone. Infração registada em `infraction_type`, não em FK para evento anterior (simplifica, evita N+1).

---

#### 2.2.2 Zones do Campo — Definição

**QUESTÃO 11:** Quantas zonas de campo e como definidas?

_Contexto:_ Requisito menciona "Zona 1, Zona 2" (construção), "Zona 1, 2, 3" (recuperações), "zona do campo" (remates, cartões).

_Proposta PM:_ Padronizar para **6 zonas** (campo dividido 3×2):
```
[Defesa-Esq]  [Defesa-Centro]  [Defesa-Dir]
[Ataque-Esq]  [Ataque-Centro]  [Ataque-Dir]
```

_Mapping com requisito original:_
- "Zona 1, 2" (construção) = Defesa-Esq, Defesa-Centro, Defesa-Dir (simplificação)
- "Zona 1, 2, 3" (recuperações) = Defesa, Meio-campo, Ataque (3 níveis)
- Remates, cartões = 6 zonas (detalhe)

_Questão:_ Aceitar 6 zonas universais, ou 3 sistemas diferentes por tipo de ação?

**Recomendação Backend:** 6 zonas universais (enum: `{defesa_esq, defesa_centro, defesa_dir, ataque_esq, ataque_centro, ataque_dir}`) — simplifica queries, índices, UI.

---

#### 2.2.3 Touchscreen 3-Ecrãs — UI/UX Expansion

**QUESTÃO 12:** Novos eventos sem jogador específico (cantos, golos) — como UX?

_Contexto:_ Ecrã 1 tem 11 botões (jogadores em campo). Canto não tem jogador específico — há botão "Evento Coletivo"?

_Opções:_
- A) Ecrã 1 mostra 11 + botão "Equipa" — seleciona "equipa", salta Ecrã 2 (ação/zona), vai para Ecrã 3 (contexto: canto_esq, canto_dir, golo, etc)
- B) Long-press em "campo" (não em jogador) abre menu de eventos coletivos
- C) Separar UI: "Ações de jogador" (tap em jogador) vs. "Eventos de jogo" (menu separado)

_Constraint:_ Ana em jogo não pode demorar >1s por evento. Não pode haver diálogo/picker complexo.

**Recomendação Frontend:** A — botão "Equipa" permanente em Ecrã 1, sticky até deselect. Rápido, intuitivo, não quebra fluxo.

---

**QUESTÃO 13:** 2º Ecrã de Contexto — quando necessário?

_Fluxo original (7 ações):_ Jogador → Ação → Zona. 3 ecrãs, tap-tap-tap, 1s por evento.

_Com expansão:_ Golo precisa Tipo de Jogada + Período. Cartão precisa Tipo de Infração.

_Opções:_
- A) Adicionar 4º ecrã universal: Jogador → Ação → Zona → Contexto (sempre presente)
- B) Contexto condicional: Se ação = Golo/Cartão, mostra ecrã extra; se ação = Perda, salta direto
- C) Contexto inline em Ecrã 3: Após selecionar zona, aparecem checkboxes de contexto (inline)

_Constraint:_ Deve-se manter ≤2s por evento, zero animações.

**Recomendação Frontend:** B (condicional) — apenas ações que precisam contexto (golo, cartão) entram em 4º ecrã. Mantém fluxo rápido para ações simples.

---

**QUESTÃO 14:** Relógios de "tempo útil" — quando registados?

_Requisito:_ "Tempo de jogo útil através da utilização de 2 relógios na aplicação"

_Interpretação:_ 
- Relógio 1: Tempo total (0' → 90')
- Relógio 2: Tempo com bola em jogo (pausa em laterais, faltas, substituições)

_Quando recolher?_
- A) Durante o jogo — Ana controla ambos os relógios (start/pause/reset)
- B) Apenas pós-jogo — Ana insere duração manualmente (simples)

_Constraint:_ Ana com tablet em bancada, olhos no campo. Controlar 2 relógios em tempo real é complex.

**Recomendação Frontend:** B (pós-jogo) — Ana preenche "90' totais, 65' com bola" após apito final. Mais simples, sem distração em jogo.

---

#### 2.2.4 Agregações & Dashboards

**QUESTÃO 15:** % de Convocatórias e % de Minutos — sincronização?

_Requisito:_ "% de convocatórias por atleta" e "% minutos por atleta"

_Agregações:_
- % Convocatórias = (jogos em que foi convocado) / (total de jogos) por época
- % Minutos = (minutos jogados) / (minutos possíveis) por época

_Implementação:_
- A) Calculado em tempo real via query SQL (JOIN sobre `game_sessions`, `game_squads`, `substitutions`)
- B) Materializado em view ou tabela `athlete_aggregations` (atualizada ao inserir/editar substituição)

_Performance:_
- A) Rápido para 1 jogador, lento para dashboard 40 jogadores (N+1 risk)
- B) Rápido para dashboard, overhead de atualização incremental

**Recomendação Backend:** B — view materializada `v_athlete_stats_per_season` atualizada via trigger ao inserir/editar substituição. Painel ≤2s é crítico.

---

### 2.3 Impacto em Performance — Painel ≤2s

**QUESTÃO 16:** Painel de Prontidão continua ≤2s com novas agregações?

_Contexto:_ Painel actual calcula ACWR + sRPE + semáforo para 40 jogadores. Query:
```sql
SELECT jogador_id, acwr, sRPE, semaforo_status 
FROM v_readiness_panel 
WHERE club_id = ? AND sessao_id = ?
```

_Com expansão:_ Precisa adicionar:
- Clean sheet (agregação de golos por jogo)
- % convocatórias (agregação histórica)
- % minutos (agregação histórica)

_Questão:_ Estas agregações entram no Painel ou em dashboard separado?

**Recomendação PM:** Separado — Painel mantém ≤2s (só ACWR + sRPE + fadiga), % participação e clean sheet em "Dashboard de Estatísticas" secundário (Growth).

---

### 2.4 Estimativa de Complexidade

| Componente | Tamanho | Risco | Notas |
|-----------|--------|-------|-------|
| Schema DB (performance_events redesign) | 4–6h | **Alto** | Polimorfismo, índices JSONB, migrações |
| Definição de 6 zonas de campo | 1–2h | Baixo | Enum, documentação para UI |
| Touchscreen 3-ecrãs v2 (cantos, cartões, golos) | 12–16h | **Alto** | Novos fluxos, 4º ecrã condicional, testes offline |
| RLS para novos eventos | 2–3h | Médio | Validar `club_id` em todas as queries |
| Views materializadas (agregações) | 4–6h | Médio | Triggers, incremental updates, índices |
| Relógios de tempo útil (UI pós-jogo) | 2–3h | Baixo | Form simples, validação |
| **Total Analytics** | **25–36h** | — | Requer 3–4 dias um dev |

---

## 3️⃣ Questões Transversais

### 3.1 Conformidade & RLS

**QUESTÃO 17:** Todos os novos campos são Art. 9 (categoria especial GDPR)?

_Dados recolhidos:_
- Humor, dores, sono → **Sim, saúde mental/física**
- Testes/exames → **Não, contexto académico** — mas pode inferir stress/carga
- Cantos, cartões, golos, zonas → **Não, performance desportiva** — mas agregadas podem inferir saúde (ex: "jogador X nunca está em área adversária = fadiga?")

_Implicação:_
- RLS mantem `(club_id, role)` — jogador nunca vê dados agregados
- Todos os novos campos herdam DPIA existente + atualização
- Consentimento parental (13–15 anos) cobre wellness expandida

**DECISÃO:** Confirmar com legal/CNPD se campos novos requerem consentimento adicional ou atualização de consentimento anterior é suficiente.

---

**QUESTÃO 18:** Backup & retenção de novos dados?

_Contexto:_ Política atual: permanência no clube + 5 épocas, depois anonimização.

_Pergunta:_ Wellness (dores, humor) e analytics (cantos, golos) seguem mesma política?

_Recomendação:_ SIM — mesma política de retenção. Sem variação por tipo de dado, simplifica operações.

---

### 3.2 Integrações Externas

**QUESTÃO 19:** Novos dados requerem APIs ou integrações?

_Contexto:_ Constraint: zero integrações externas obrigatórias.

_Novo requisito:_ Nada externo — tudo dentro do stack (Supabase + Next.js + Vercel).

_Validar:_ Body diagram (SVG custom, sem npm), Emoji scale (nativas), Analytics dashboards (Recharts existente).

**Resposta:** Zero novas dependências obrigatórias. ✅

---

### 3.3 Testing & QA

**QUESTÃO 20:** Cobertura de testes para novos features?

_NFR atual:_ ≥80% cobertura em funções críticas (ACWR, sRPE, Painel).

_Com expansão:_ Adicionar testes para:
- Wellness: submit offline, sync, RLS jogador
- Analytics: UUIDs únicos para eventos polimórficos, agregações (clean sheet, %)
- Sync: outbox com novos campos, idempotência

_Estimativa:_ +10–15h testes unitários + integration tests.

**Recomendação:** Priorizar testes para sync (idempotência crítica) e RLS (segurança).

---

## 4️⃣ Decisões Necessárias (Lista de Decisão)

| # | Questão | Opções | Recomendação PM | Decisão Time |
|----|---------|--------|-----------------|--------------|
| 1 | Dores: JSON vs. Enum vs. Normalizado | A / B / C | A (JSON) | ⬜ |
| 2 | Sono: Implícito vs. Explícito | A / B | A (Implícito) | ⬜ |
| 3 | Exames: Flag vs. Multi-select | A / B | A (Flag semanal) | ⬜ |
| 4 | RLS wellness: Jogador vê respostas | Sim / Não | ✅ Sim (vê pré + pós-sessão) | ✅ |
| 5 | Body diagram: SVG vs. Buttons vs. Lib | A / B / C | A (SVG custom) | ⬜ |
| 6 | Emoji scale: Texto alt em PT | Sim / Não | Sim | ⬜ |
| 7 | Wellness: Tabela única vs. Separada | A / B | A (Única) | ⬜ |
| 8 | Performance events: Polimórficos | A / B / C | A (JSON) | ⬜ |
| 9 | Golo: Atleta marcou vs. Equipa | A / B / C | A (Atleta) | ⬜ |
| 10 | Cartão: Atleta registado | Sim | Sim | ⬜ |
| 11 | Zonas: 6 universais vs. 3 sistemas | 6 / 3 | 6 (Universais) | ⬜ |
| 12 | Touchscreen: Botão Equipa vs. Menu | A / B / C | A (Botão) | ⬜ |
| 13 | Contexto: 4º ecrã vs. Condicional | A / B / C | B (Condicional) | ⬜ |
| 14 | Relógios: Real-time vs. Pós-jogo | A / B | B (Pós-jogo) | ⬜ |
| 15 | Agregações: Real-time vs. Materializado | A / B | B (Materializado) | ⬜ |
| 16 | Painel: Inclui todas as métricas? | Sim / Parcial | Parcial (ACWR + sRPE) | ⬜ |
| 17 | Art. 9 GDPR: Requer novo consentimento? | Sim / Não | ✅ Sim (Consentimento Explícito Art. 9(2)(a)) | ✅ |
| 18 | Retenção: Mesma política para wellness? | Sim / Não | Sim | ⬜ |
| 19 | Integrações externas obrigatórias? | Sim / Não | Não | ⬜ |
| 20 | Cobertura testes ≥80%? | Sim / Não | Sim | ⬜ |

---

## 5️⃣ Riscos & Mitigações Identificados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|--------|----------|
| Schema polimórficos (events) complexo | Média | Alto | Prototype com 3–4 tipos de evento antes de commit |
| Painel >2s com novas agregações | Média | Alto | Manter agregações em dashboard separado, materializar |
| Body diagram offline | Baixa | Médio | SVG custom com fallback lista de botões |
| Outbox sync com novos campos | Baixa | Médio | Testes de idempotência com campos NULL |
| RLS em eventos polimórficos | Média | Alto | Validar RLS em cada query, não assumir herança |
| Performance de índices JSONB | Baixa | Médio | Benchmark queries com 1.000+ eventos antes do release |
| Consentimento GDPR obsoleto | Baixa | **Muito Alto** | Revisar com legal ANTES de dev; atualizar DPIA |

---

## 6️⃣ Timeline Proposto

### Sprint 1.4 (Semana 3)
- [ ] Validação de decisões técnicas (reunião 1h)
- [ ] Prototipo de schema BD (4h)
- [ ] Prototipo de touchscreen 3-ecrãs v2 (4h)
- [ ] Definição final de zonas + enums (2h)

### Sprint 1.5 (Semana 4)
- [ ] Implementação de schema + migrations (6h)
- [ ] Implementação de frontend wellness (8h)
- [ ] Implementação de analytics touchscreen (12h)
- [ ] Testes + sync validation (8h)

### Sprint 1.6+ (Growth)
- [ ] Dashboards exploratórios (16h)
- [ ] Views materializadas (6h)
- [ ] Testes de performance (4h)

---

## 7️⃣ Pré-Requisitos para Dev

**Antes de começar (bloqueadores):**
1. ✅ Decision on Schema Model (Q8 — polimórficos JSON)
2. ✅ Decision on Zones (Q11 — 6 zonas universais)
3. ✅ Decision on RLS Scope (Q4 — jogador vê pré + pós-sessão)
4. ✅ **Decision on GDPR** (Q17 — consentimento explícito Art. 9(2)(a), anonimização automática)
5. ✅ Design do SVG body diagram (Q5)
6. ✅ Design do touchscreen 4º ecrã condicional (Q13)

**Validações obrigatórias pré-dev:**
- DPIA atualizado com novos campos (compliance)
- RLS policies documentadas (segurança)
- Performance baselines definidas (Painel <2s, queries <500ms)

---

## 8️⃣ Success Criteria

**MVP Expandido é viável se:**
- ✅ Painel de Prontidão continua ≤2s (validação com dados reais)
- ✅ Questionário novo ≤2.5 min (UX testing com sub-14)
- ✅ Touchscreen analytics ≤1s por evento (heurística)
- ✅ Sync offline idempotente (testes automatizados)
- ✅ RLS validada em todas as queries novas
- ✅ Zero integrações externas obrigatórias
- ✅ Custo zero mantido (sem escalado tier Supabase/Vercel)

**Go/No-Go Decision:** Semana de prototipo (1.4) + teste de performance com dados sintéticos. Se Painel ou sync falham, reconsiderar phase de release (Analytics para Growth?).

---

## 📋 Próximas Ações

**Imediatamente após esta reunião:**
1. Backend: Preparar proposta de schema redesign (Q8, Q11)
2. Frontend: Prototipo SVG body diagram (Q5)
3. PM: Escalate para legal review GDPR (Q17)
4. DevOps: Benchmarking de query performance atual (baseline)

**Reunião de acompanhamento:** Quinta-feira (2026-05-14), 30 min, com resoluções das 5 questões bloqueadoras.

---

**Documento preparado por:** John (Product Manager)  
**Data:** 2026-05-09  
**Status:** Ready for Technical Review  
**Audiência:** Backend, Frontend, DevOps, Legal Compliance
