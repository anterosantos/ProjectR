---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
status: complete
overallReadiness: READY
criticalIssues: 0
majorIssues: 0
minorConcerns: 5
documentsIncluded:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# Relatório de Avaliação de Prontidão para Implementação

**Data:** 2026-05-07
**Projeto:** SPARTA

## 1. Inventário de Documentos

| Tipo | Arquivo | Tamanho | Modificado |
|------|---------|---------|------------|
| PRD | `_bmad-output/planning-artifacts/prd.md` | 90.5 KB | 2026-05-06 |
| Arquitetura | `_bmad-output/planning-artifacts/architecture.md` | 69.5 KB | 2026-05-07 |
| Épicos & Estórias | `_bmad-output/planning-artifacts/epics.md` | 166 KB | 2026-05-07 |
| UX Design | `_bmad-output/planning-artifacts/ux-design-specification.md` | 80.7 KB | 2026-05-07 |

**Documentos de apoio:** `product-brief-sparta.md`, `research/` (3 relatórios)

**Issues:** nenhuma duplicata; todos os documentos obrigatórios presentes.

## 2. Análise do PRD

### 2.1 Functional Requirements (FRs) extraídos

**Total: 59 FRs** (FR1–FR59) — `[MVP]` salvo indicação `[Growth]`.

#### Identity, Access & Consent Management (FR1–FR11)

- **FR1:** Treinador, Analista e Jogador autenticam-se com email + password e recuperam password via email. [MVP]
- **FR2:** Sistema atribui um e apenas um papel (Treinador, Analista, Jogador) a cada conta. [MVP]
- **FR3:** Sistema enforça permissões por papel (Jogador vê só os seus dados; Analista/Treinador vêem o plantel; nenhum papel acede a outros clubes). [MVP]
- **FR4:** Sistema bloqueia acesso de jogador 13–15 anos até confirmação parental verificável. [MVP]
- **FR5:** Encarregado de Educação confirma consentimento via link tokenizado por email, sem criar conta. [MVP]
- **FR6:** Sistema regista cada confirmação com timestamp, IP e versão da política aceite. [MVP]
- **FR7:** Sistema reenvia consentimento ao 7º e 14º dia; notifica staff após 14 dias. [MVP]
- **FR8:** Encarregado pode retirar consentimento, exportar ou apagar dados do menor. [MVP]
- **FR9:** Jogador 16+ retira consentimento, exporta ou apaga dados sem mediação. [MVP]
- **FR10:** Sistema notifica titular aos 18 anos para reconfirmar; sem reconfirmação em 90 dias, anonimiza. [Growth]
- **FR11:** MFA opcional para staff (MVP), com possibilidade de tornar obrigatório. [MVP, escalonamento Growth]

#### Player & Squad Management (FR12–FR16)

- **FR12:** Analista cria/edita/arquiva jogadores (nome, idade, número, foto, escalão, posição principal + 4 alternativas). [MVP]
- **FR13:** Analista regista séries temporais de peso e altura. [MVP]
- **FR14:** Treinador/Analista consulta perfil consolidado (séries de fadiga, peso, altura, ACWR, presenças, estatísticas). [Growth — completo]
- **FR15:** Analista marca jogadores como inativos sem apagar histórico. [MVP]
- **FR16:** Sistema preserva histórico permanência + 5 épocas, depois anonimiza automaticamente. [MVP — política; Growth — automatização]

#### Calendar & Session Management (FR17–FR20)

- **FR17:** Treinador cria/edita/cancela sessões (treino, jogo, amigável). [MVP]
- **FR18:** Treinador define convocados e equipa inicial. [MVP]
- **FR19:** Analista regista substituições; sistema deriva minutos jogados. [MVP]
- **FR20:** Treinador/Analista gere épocas com filtros por época ou cumulativos. [MVP]

#### Fatigue & Wellness Tracking (FR21–FR26)

- **FR21:** Jogador responde questionário 5 dimensões pré e pós-sessão. [MVP]
- **FR22:** Sistema apresenta versão linguística adaptada para sub-14. [MVP]
- **FR23:** Submissão offline com sincronização automática. [MVP]
- **FR24:** Indicador de pendentes + sincronização manual forçada. [MVP]
- **FR25:** Staff consulta respostas individuais e tendências históricas. [MVP]
- **FR26:** Jogador NÃO acede ao seu Painel/Curva/relatórios — entrega via staff. [MVP — decisão deliberada]

#### Performance Recording (FR27–FR31)

- **FR27:** Analista regista 7 métricas via touchscreen 3-ecrãs (jogador → ação → zona). [MVP]
- **FR28:** Registo de eventos em modo offline com sincronização. [MVP]
- **FR29:** Edição/eliminação de eventos dentro de janela configurável. [MVP]
- **FR30:** Registo de presença/ausência em treinos. [MVP]
- **FR31:** Analista regista Session-RPE (1–10 × duração) por jogador. [MVP]

#### Readiness Intelligence (FR32–FR41)

- **FR32:** Cálculo automático ACWR (7d / 28d) com limiares por escalão (sub-14, sub-15, sub-17, sub-19, seniores). [MVP]
- **FR33:** Cálculo automático sRPE com histórico cumulativo. [MVP]
- **FR34:** Painel de Prontidão semáforo verde/amarelo/vermelho (fadiga + ACWR + assiduidade). [MVP]
- **FR35:** Drill-down individual com séries 4 semanas. [MVP]
- **FR36:** Painel atualiza em tempo real na janela de 4h pré-sessão. [MVP]
- **FR37:** Dashboard tendências individuais 4 semanas. [MVP]
- **FR38:** Dashboard carga acumulada por jogador na época. [MVP]
- **FR39:** Correlações fadiga × performance individuais. [Growth]
- **FR40:** Curva de Recuperação Individual. [Growth]
- **FR41:** Dashboard de Equipa Agregado. [Growth]

#### Notifications & Reminders (FR42–FR45)

- **FR42:** Push X min antes / Y min depois da sessão (configurável). [MVP]
- **FR43:** Payloads opacos com deep link autenticado. [MVP]
- **FR44:** Subscrição/cancelamento de push sem bloquear acesso. [MVP]
- **FR45:** Email transacional para consentimento parental e confirmações de exportação/apagamento. [MVP]

#### Compliance, Audit & Data Rights (FR46–FR54)

- **FR46:** Exportação CSV de dados pessoais e biométricos. [MVP]
- **FR47:** Apagamento em cascata em ≤ 30 dias. [MVP]
- **FR48:** Retificação com log auditável. [MVP]
- **FR49:** Marcação "tratamento limitado" (congela leitura/escrita sem apagar). [MVP]
- **FR50:** Log auditável de cada acesso a dados de saúde (12 meses). [MVP]
- **FR51:** Titular consulta quem acedeu aos seus dados nos últimos 12 meses. [MVP]
- **FR52:** "Decisão data-driven" no perfil (nota livre + flag) — KPI do "wow moment". [MVP]
- **FR53:** Versão linguística adaptada da política de privacidade para 13–15 anos. [MVP]
- **FR54:** Versão histórica de políticas aceites ligada ao consentimento. [MVP]

#### System Operations & Resilience (FR55–FR59)

- **FR55:** Heartbeat externo automático anti-pause. [MVP]
- **FR56:** Backup semanal automatizado, retenção 12 semanas. [MVP]
- **FR57:** Página amigável para browsers não suportados. [MVP]
- **FR58:** Bloqueio de WebView in-app (FB/IG/WA). [MVP]
- **FR59:** PDF individual gerado e partilhado pelo staff (sem acesso direto do jogador). [Growth]

### 2.2 Non-Functional Requirements (NFRs) extraídos

**Total: 60 NFRs** (NFR1–NFR60).

#### Performance (NFR1–NFR13)

- NFR1: Painel de Prontidão ≤ 2s P95 / 40 jogadores · NFR2: submissão questionário ≤ 500ms P95 · NFR3: drain outbox ≤ 5s / 50 eventos em 4G · NFR4: dashboard tendências FCP ≤ 1s / completo ≤ 3s · NFR5: recálculo ACWR grupo 18 jogadores ≤ 3s · NFR6: TTI ≤ 3s 4G · NFR7: FCP ≤ 1.5s · NFR8: LCP ≤ 2.5s · NFR9: CLS ≤ 0.1 · NFR10: TBT ≤ 200ms · NFR11: bundle ≤ 200 KB gzip · NFR12: cold start offline ≤ 2s · NFR13: Lighthouse CI Perf ≥ 85 / A11y ≥ 90 / BP ≥ 95 / PWA ≥ 100.

#### Security & Compliance (NFR14–NFR30)

- NFR14: TLS 1.3+ · NFR15: encriptação at-rest · NFR16: RLS em todas as tabelas com PII/saúde · NFR17: sessão access 1h / refresh 30d · NFR18: logout forçado em mudança de password · NFR19: MFA opcional MVP / obrigatória ≥ 4 clubes · NFR20: logs de acesso a saúde 12 meses · NFR21: payloads push opacos · NFR22: sem analytics 3rd-party · NFR23: UUIDs como PKs · NFR24: DPIA + base jurídica documentada · NFR25: consentimento parental verificável (token+IP+timestamp+versão) · NFR26: apagamento ≤ 30d · NFR27: acesso/portabilidade ≤ 30d CSV · NFR28: retificação ≤ 7d com log · NFR29: oposição imediata · NFR30: infra UE (Supabase EU, Vercel fra1, Resend EU).

#### Scalability (NFR31–NFR35)

- NFR31: 1 clube + 40 jogadores + 5 staff MVP · NFR32: até 3 clubes multi-tenant free · NFR33: revisão automática a 4 clubes ou 80% dos limites · NFR34: 50 conexões Realtime concorrentes sem degradar · NFR35: ≤ 100 MB por clube; arquivamento >5 anos.

#### Accessibility (NFR36–NFR44)

- NFR36: WCAG 2.1 AA pragmático em fluxos críticos · NFR37: contraste ≥ 4.5:1 / 3:1 · NFR38: navegação por teclado com focus rings · NFR39: ARIA + roles + headings · NFR40: touch targets ≥ 44px · NFR41: respeita prefers-reduced-motion · NFR42: linguagem ≤ B1 CEFR · NFR43: versão adaptada para 13–15 (política, questionário, prompts) · NFR44: alt text obrigatório.

#### Reliability & Availability (NFR45–NFR52)

- NFR45: ≥ 99% em janelas de sessão · NFR46: modo offline para indisponibilidade transitória · NFR47: drain ≤ 24h pós-reconexão · NFR48: UUIDv7 + upsert idempotente · NFR49: heartbeat ≤ 6 dias · NFR50: alerta após 2 falhas consecutivas · NFR51: backups semanais retidos 12 semanas · NFR52: deteção de outbox órfã antes de logout.

#### Integration (NFR53)

- NFR53: zero integrações externas obrigatórias no MVP.

#### Maintainability & Observability (NFR54–NFR58)

- NFR54: cobertura ≥ 80% em ACWR/sRPE/Painel/outbox · NFR55: TS estrito sem `any` · NFR56: logs JSON estruturados · NFR57: telemetria interna em Postgres · NFR58: provider-agnostic (zero `@vercel/*` além de `next/*`).

#### Browser & Platform Compatibility (NFR59–NFR60)

- NFR59: Chrome/Safari iOS 16.4+/Safari macOS/Firefox/Edge/Samsung Internet (últimas 2 versões) · NFR60: bloqueio de WebView in-app e browsers sem SW.

### 2.3 Requisitos adicionais e restrições

- **Restrição de custo inflexível:** €0/mês — qualquer custo emergente dispara revisão de arquitetura, não orçamento.
- **Stack imposto:** Next.js 16 App Router · TypeScript estrito · Supabase EU · Vercel fra1 · Serwist + Dexie · UUIDv7 · TanStack Query + Zustand · Resend (email) · Web Push VAPID.
- **Sub-processadores GDPR:** Supabase, Vercel, Resend, push services dos browsers — todos com DPA UE / SCCs.
- **Princípios de scope inflexíveis:** custo €0; consentimento parental; filosofia "dados mediados"; stack zero-cost.
- **Período de retenção:** permanência + 5 épocas; logs de consentimento 6 anos; logs de acesso 12 meses.
- **Decisões de produto explícitas:** Jogador NÃO vê o seu painel (FR26); encarregado é gateway de email, NÃO utilizador da app; touchscreen 3-ecrãs como padrão de input rápido.

### 2.4 Avaliação inicial de completude do PRD

✅ **PRD globalmente completo e maduro** (1120 linhas, status `complete`, 14 steps cumpridos).

**Pontos fortes:**

- 59 FRs numerados, agrupados por capacidade, com tag MVP/Growth e tabela de cobertura cruzada (`Capability Contract — Coverage Verification`).
- 60 NFRs testáveis e categorizados (Performance, Security, Scalability, A11y, Reliability, Integration, Maintainability, Compatibility) com tabela de origem.
- Filosofia de produto explícita ("dados mediados") e justificada com plano A/B/C de mitigação.
- Compliance Art. 9 GDPR + menores tratada como dimensão de sucesso, não anexo.
- 5 jornadas de utilizador com edge cases (offline, wow moment, consentimento parental).
- Restrições técnicas (iOS sem Background Sync, Supabase pause, Resend cap) com mitigações documentadas.

**Áreas a verificar nos próximos passos (gaps potenciais):**

- ⚠️ FR14 marcado `[Growth]` — perfil consolidado parcial no MVP? Verificar com Architecture/Épicos.
- ⚠️ FR16 marcado `[MVP — política; Growth — automatização]` — confirmar se anonimização automática está nos épicos MVP ou Growth.
- ⚠️ FR59 (PDF) é `[Growth]` mas referenciado em "filosofia dados mediados" — verificar timing nos épicos.
- ⚠️ Verificar se todos os FRs `[MVP]` (≈ 50 FRs) estão cobertos por estórias do plano de épicos.
- ⚠️ NFRs de Performance (NFR1–NFR13) precisam de stories de teste / setup CI com Lighthouse.

## 3. Validação de Cobertura dos Épicos

### 3.1 Estrutura geral

**7 épicos, 69 estórias totais** (3002 linhas em `epics.md`):

| # | Épico | Estórias | Foco | Fase |
|---|-------|----------|------|------|
| 1 | Fundação Técnica, Identidade & Acesso Multi-Clube | 16 (1.1–1.16) | Auth, RLS, design system, CI/CD, telemetria | MVP |
| 2 | Plantel, Calendário & Sessões | 9 (2.1–2.9) | Jogadores, métricas, posições, épocas, sessões | MVP |
| 3 | Consentimento Parental & Direitos GDPR | 12 (3.1–3.12) | Token, direitos titulares, audit logs | MVP |
| 4 | Recolha de Fadiga & Notificações | 8 (4.1–4.8) | Questionário 5D, offline, push, dados mediados | MVP |
| 5 | Painel de Prontidão & Inteligência | 10 (5.1–5.10) | ACWR, sRPE, semáforo, drill-down, FR52 | MVP |
| 6 | Recolha de Performance — Touchscreen | 8 (6.1–6.8) | 7 métricas, sticky+stack, sub, sRPE, presenças | MVP |
| 7 | Análise Avançada & Dados Mediados (Growth) | 6 (7.1–7.6) | Perfil unificado, curva recuperação, PDF, 18 anos | Growth |

### 3.2 Coverage Matrix — FRs vs. Épicos

O documento `epics.md` inclui um **FR Coverage Map** explícito (linhas 332–353) que cobre **59/59 FRs**. Verificação cruzada:

| FR | Texto resumido (PRD) | Cobertura nos Épicos | Status |
|----|----------------------|----------------------|--------|
| FR1 | Auth email+password + recovery | Epic 1 / Story 1.5 | ✅ Coberto |
| FR2 | Um e único papel por conta | Epic 1 / Story 1.6 | ✅ Coberto |
| FR3 | Permissões por papel + multi-tenant | Epic 1 / Story 1.6 | ✅ Coberto |
| FR4 | Bloqueio menor 13–15 sem consent. | Epic 3 / Story 3.2 | ✅ Coberto |
| FR5 | Encarregado consente via token email | Epic 3 / Story 3.3 | ✅ Coberto |
| FR6 | Registo timestamp+IP+versão | Epic 3 / Story 3.2, 3.3 | ✅ Coberto |
| FR7 | Reenvio D+7/D+14 + alerta staff | Epic 3 / Story 3.4 | ✅ Coberto |
| FR8 | Encarregado retira/exporta/apaga | Epic 3 / Story 3.5–3.10 | ✅ Coberto |
| FR9 | Adulto 16+ retira/exporta/apaga | Epic 3 / Story 3.5–3.10 | ✅ Coberto |
| FR10 | Reconfirmação aos 18, anonim. 90d | Epic 7 / Story 7.1 | ✅ Coberto (Growth) |
| FR11 | MFA opcional staff | Epic 1 / Story 1.7 | ✅ Coberto |
| FR12 | CRUD jogadores + arquivar | Epic 2 / Story 2.1, 2.2 | ✅ Coberto |
| FR13 | Séries temporais peso/altura | Epic 2 / Story 2.3 | ✅ Coberto |
| FR14 | Perfil unificado consolidado | Epic 7 / Story 7.2 | ✅ Coberto (Growth) |
| FR15 | Marcar inativo sem apagar | Epic 2 / Story 2.4 | ✅ Coberto |
| FR16 | Retenção 5 épocas + anonimização | Epic 2 / Story 2.9 | ✅ Coberto (política MVP) |
| FR17 | Sessões CRUD (treino/jogo/amig.) | Epic 2 / Story 2.6 | ✅ Coberto |
| FR18 | Convocados + equipa inicial | Epic 2 / Story 2.8 | ✅ Coberto |
| FR19 | Substituições + minutos auto | Epic 6 / Story 6.4 | ✅ Coberto |
| FR20 | Gestão de épocas | Epic 2 / Story 2.5 | ✅ Coberto |
| FR21 | Questionário 5 dimensões pré/pós | Epic 4 / Story 4.1, 4.2 | ✅ Coberto |
| FR22 | Versão sub-14 adaptada | Epic 4 / Story 4.3 | ✅ Coberto |
| FR23 | Submissão offline + sync | Epic 4 / Story 4.4 | ✅ Coberto |
| FR24 | Pendentes + force sync | Epic 4 / Story 4.4 | ✅ Coberto |
| FR25 | Staff vê respostas e tendências | Epic 4 / Story 4.5 | ✅ Coberto |
| FR26 | Jogador SEM acesso a relatórios | Epic 4 / Story 4.6 | ✅ Coberto |
| FR27 | Touchscreen 3-ecrãs (7 métricas) | Epic 6 / Story 6.1, 6.2 | ✅ Coberto |
| FR28 | Eventos offline | Epic 6 / Story 6.5 | ✅ Coberto |
| FR29 | Editar/apagar dentro de janela | Epic 6 / Story 6.6 | ✅ Coberto |
| FR30 | Presenças em treinos | Epic 6 / Story 6.7 | ✅ Coberto |
| FR31 | sRPE pós-sessão | Epic 6 / Story 6.8 | ✅ Coberto |
| FR32 | ACWR com limiares por escalão | Epic 5 / Story 5.2 | ✅ Coberto |
| FR33 | sRPE cumulativo | Epic 5 / Story 5.1 | ✅ Coberto |
| FR34 | Painel semáforo verde/amarelo/vermelho | Epic 5 / Story 5.3, 5.4 | ✅ Coberto |
| FR35 | Drill-down 4 semanas | Epic 5 / Story 5.5 | ✅ Coberto |
| FR36 | Realtime na janela 4h pré-sessão | Epic 5 / Story 5.7 | ✅ Coberto |
| FR37 | Dashboard tendências individuais | Epic 5 / Story 5.8 | ✅ Coberto |
| FR38 | Dashboard carga acumulada | Epic 5 / Story 5.9 | ✅ Coberto |
| FR39 | Correlações fadiga×perf | Epic 7 / Story 7.5 | ✅ Coberto (Growth) |
| FR40 | Curva Recuperação Individual | Epic 7 / Story 7.3 | ✅ Coberto (Growth) |
| FR41 | Dashboard Equipa Agregado | Epic 7 / Story 7.4 | ✅ Coberto (Growth) |
| FR42 | Push pré/pós com X/Y configuráveis | Epic 4 / Story 4.7, 4.8 | ✅ Coberto |
| FR43 | Push opaco + deep link autenticado | Epic 4 / Story 4.8 | ✅ Coberto |
| FR44 | Subscribe/unsubscribe push | Epic 4 / Story 4.7 | ✅ Coberto |
| FR45 | Email transacional (consent + GDPR) | Epic 3 / Story 3.3, 3.6, 3.7 | ✅ Coberto |
| FR46 | Exportação CSV | Epic 3 / Story 3.6 | ✅ Coberto |
| FR47 | Apagamento em cascata ≤30d | Epic 3 / Story 3.7 | ✅ Coberto |
| FR48 | Retificação ≤7d com log | Epic 3 / Story 3.8 | ✅ Coberto |
| FR49 | Tratamento limitado | Epic 3 / Story 3.9 | ✅ Coberto |
| FR50 | Audit logs acesso a saúde | Epic 3 / Story 3.11 (+ Epic 1 / 1.12) | ✅ Coberto |
| FR51 | Titular consulta acessos | Epic 3 / Story 3.12 | ✅ Coberto |
| FR52 | Decisão data-driven (KPI wow) | Epic 5 / Story 5.10 | ✅ Coberto |
| FR53 | Política adaptada para 13–15 | Epic 3 / Story 3.1 | ✅ Coberto |
| FR54 | Versão histórica de políticas | Epic 3 / Story 3.1 | ✅ Coberto |
| FR55 | Heartbeat anti-pause | Epic 1 / Story 1.14 | ✅ Coberto |
| FR56 | Backup semanal 12 sem | Epic 1 / Story 1.15 | ✅ Coberto |
| FR57 | Página browser não suportado | Epic 1 / Story 1.10 | ✅ Coberto |
| FR58 | Bloqueio WebView in-app | Epic 1 / Story 1.10 | ✅ Coberto |
| FR59 | PDF mediado pelo staff | Epic 7 / Story 7.6 | ✅ Coberto (Growth) |

### 3.3 Missing Requirements

**Nenhum FR sem cobertura.** O FR Coverage Map dos épicos cobre 59/59 FRs e a verificação manual confirmou — cada FR tem pelo menos uma estória que o implementa, com fronteiras MVP/Growth bem demarcadas.

### 3.4 FRs em épicos mas NÃO no PRD

**Nenhum.** A numeração FR1–FR59 dos épicos é idêntica à do PRD; não há FRs órfãos.

### 3.5 Estatísticas de cobertura

- **Total de FRs no PRD:** 59
- **FRs cobertos pelos épicos:** 59
- **Cobertura percentual:** **100%**
- **Distribuição MVP vs. Growth:** 53 FRs MVP / 6 FRs Growth (FR10, FR14, FR39, FR40, FR41, FR59) — alinhado com Product Scope do PRD.
- **Fronteira mista:** FR16 (política MVP / automatização Growth) é tratada na Story 2.9 com hook de retenção, encaminhando automatização total para Epic 7.

### 3.6 Observações qualitativas

✅ **Coverage map é defensivo** — cada épico declara explicitamente os FRs que cobre, prevenindo drift durante implementação.
✅ **Estórias com Acceptance Criteria Given/When/Then** — formato testável, mapeia para automação E2E.
✅ **NFRs referenciados nas ACs** — NFR54 (cobertura ≥80%), NFR1 (performance), NFR16 (RLS), NFR40 (touch ≥44px) etc. aparecem como pré-condições nas estórias relevantes (e.g., 1.6, 1.13, 5.4, 6.2).
✅ **Architecture Requirements (AR1–AR33) também mapeados nas estórias** — não são FRs do PRD mas estão completos.
✅ **UX Design Requirements (UX-DR1–UX-DR48) referenciados nas ACs** — alinhamento UX → estória.

⚠️ **Para verificar no próximo passo (UX Alignment):** se as 48 UX-DRs estão totalmente cobertas pelas 69 estórias, e se há gaps de capacidades visuais (e.g., empty states, error states) sem estória dedicada.

## 4. UX Alignment Assessment

### 4.1 UX Document Status

✅ **Encontrado e completo** — `ux-design-specification.md` (1497 linhas, status `complete`, 14 steps, modificado 2026-05-07).

**Inputs declarados no frontmatter:** PRD, Product Brief, 3 relatórios de pesquisa, 2 sessões de brainstorming, requirements doc — alinhamento com PRD verificado por construção.

### 4.2 UX ↔ PRD — Alinhamento

✅ **Personas alinhadas 1:1:**

| PRD (Journeys) | UX (Defining Experience) | Match |
|----------------|--------------------------|-------|
| José, treinador 48 (Journey 1, 2) | José, treinador (Painel <30s) | ✅ |
| Ana, analista 34 (Journey 3) | Ana, analista (touchscreen 3-ecrãs) | ✅ |
| Tomás, jogador 16 (Journey 4) | Tomás, jogador (questionário <2min) | ✅ |
| Sandra, EE 42 (Journey 5) | Sandra, EE (gateway de email) | ✅ |

✅ **Capacidades UX rastreáveis aos FRs:**

- 5 jornadas mecânicas com Mermaid diagrams correspondem 1:1 às 5 jornadas narrativas do PRD.
- Decisões de produto preservadas: jogador NÃO vê o seu painel (FR26 ↔ "filosofia dados mediados" UX), wow moment como vindicação (FR52 ↔ Defining Interaction).
- "Glance > Read", "Reflex > Read", "Calma > Excitação" derivam dos princípios do PRD (decisão informada <30s, UX <2min, sem fricção em jogo).

✅ **NFRs de UI/UX referenciados no UX spec:**

- NFR1 (Painel ≤2s) → "Glance phase 0–3s" + pré-fetch paralelo de séries
- NFR11 (bundle ≤200KB) → seleção shadcn/ui com componentes copy-paste
- NFR36–NFR44 (WCAG 2.1 AA) → Radix + axe-core + redundância sensorial
- NFR40 (touch ≥44px) → ≥44 default, ≥60 em jogo
- NFR41 (prefers-reduced-motion) → respeitado em todos os componentes
- NFR43 (versão sub-14) → adaptação `ageGroup="u14"` em FatigueSlider

### 4.3 UX ↔ Arquitetura — Alinhamento

✅ **Stack UX 100% suportado pela Arquitetura:**

| Necessidade UX | Suporte da Arquitetura | Status |
|----------------|------------------------|--------|
| shadcn/ui + Radix + lucide-react + recharts | Confirmado em AR2 (deps), Frontend Architecture | ✅ |
| Tokens via Tailwind v4 `@theme` | AR3 (Webpack-only por Serwist) + UX-DR1–4 | ✅ |
| Painel realtime 4h pré-sessão | Supabase Realtime (real-time architecture parcimoniosa) | ✅ |
| Offline questionário + touchscreen | AR18–AR20 (Dexie outbox + Serwist + drain por foreground) | ✅ |
| Push notifications opacas | AR25 (web-push VAPID) + Edge Function `send-push` | ✅ |
| Consentimento tokenizado | AR16 Edge Function `consent-validate` + AR26 Resend EU | ✅ |
| Estado global Zustand (touchscreen sticky player) | Frontend State management split | ✅ |
| `<picture>` + Storage signed URL para fotos | Storage bucket `player-photos` (Story 2.2) | ✅ |
| Drill-down ≤500ms | TanStack Query cache + materialized `readiness_snapshots` | ✅ |
| Cold start offline ≤2s | Service worker pre-cache shell (NFR12 + AR19) | ✅ |
| WCAG AA enforcement | axe-core + jsx-a11y + Lighthouse no CI (AR29) | ✅ |
| Provider-agnostic (NFR58) | Helpers `lib/supabase/*` + zero `@vercel/*` | ✅ |

### 4.4 UX ↔ Épicos — Cobertura de UX-DRs

O `epics.md` declara **48 UX Design Requirements (UX-DR1–UX-DR48)** que mapeiam para componentes específicos:

- **UX-DR1–UX-DR4 (tokens)** → Story 1.8 (Design System Foundation)
- **UX-DR5–UX-DR11 (7 patterns universais)** → Story 1.8 (todos os 7 patterns implementados+testados)
- **UX-DR12–UX-DR14 (ReadinessPanel + PlayerRow + GlanceCard + PositionGroup)** → Stories 5.4, 5.5
- **UX-DR15 (FieldFormation)** → Story 5.6
- **UX-DR16–UX-DR17 (FatigueQuestionnaire + FatigueSlider)** → Stories 4.2, 4.3
- **UX-DR18–UX-DR22 (touchscreen MatchEventCapture + dependências)** → Stories 6.1, 6.2, 6.3
- **UX-DR23–UX-DR24 (ParentalConsentEmail + LandingPage)** → Stories 3.1, 3.3
- **UX-DR25 (DataDrivenDecisionInput)** → Story 5.10
- **UX-DR26–UX-DR29 (navegação + URLs PT)** → Story 1.9
- **UX-DR30–UX-DR38 (transversais: Button hierarchy, forms, empty/loading/error states, search, datas, pluralização, tom)** → Stories 1.8, 1.9, espalhados nas ACs das estórias relevantes
- **UX-DR39–UX-DR43 (acessibilidade)** → Story 1.16 (Accessibility Foundation) + axe-core em todas as estórias
- **UX-DR44–UX-DR45 (responsive)** → Story 1.9 + ACs específicas
- **UX-DR46–UX-DR48 (direções escolhidas)** → Stories 5.4/5.6 (Painel A+B), 4.2 (Slider B), 6.2 (Sticky+Stack)

✅ **Cobertura UX-DR estimada: 48/48** — todas as direções de UX têm pelo menos uma estória correspondente ou são incorporadas como AC transversais.

### 4.5 Alignment Issues

✅ **Nenhum desalinhamento crítico identificado.**

Observações menores (informativas, não bloqueantes):

- ⚠️ **Painel B (Field Formation)** marcado em UX como "B na segunda metade da semana 3 do MVP — se prazo apertar, B pode escorregar para Phase 2". O épico inclui Story 5.6 (Field Formation) no MVP, sem flag de fallback explícita. Recomenda-se documentar essa contingência na descrição de Epic 5.
- ⚠️ **Storybook** explicitamente excluído no MVP (UX) — confirmado nos épicos (não há story de setup). Alinhado.
- ⚠️ **PT-PT only** confirmado em ambos os documentos; sem i18n no MVP.

### 4.6 Warnings

Nenhum aviso crítico. Os documentos PRD, UX e Arquitetura formam um trio coerente, com referências cruzadas explícitas (NFRs citados nos UX-DRs; UX-DRs citados nas Acceptance Criteria das estórias).

## 5. Epic Quality Review

### 5.1 Foco em Valor para o Utilizador

| Épico | Título | Entrega valor de utilizador? | Notas |
|-------|--------|------------------------------|-------|
| 1 | Fundação Técnica, Identidade & Acesso Multi-Clube | 🟡 Misto | Bundle foundational greenfield + valor user-facing (auth para 3 papéis, browser block, A2HS gating). Justificável em projeto greenfield com starter explícito (AR1, AR33). |
| 2 | Plantel, Calendário & Sessões | ✅ Sim | Analista gere plantel; Treinador gere calendário. Outcome operacional claro. |
| 3 | Consentimento Parental & Direitos GDPR | ✅ Sim | Encarregados consentem; titulares exercem direitos. Outcome de compliance auditável. |
| 4 | Recolha de Fadiga & Notificações | ✅ Sim | Jogador preenche em <2min, recebe push, staff lê tendências. |
| 5 | Painel de Prontidão & Inteligência | ✅ Sim | **Defining experience** do produto. Outcome direto: decisão informada <30s. |
| 6 | Recolha de Performance — Touchscreen 3-ecrãs | ✅ Sim | Outcome operacional crítico para Ana em jogo. |
| 7 | Análise Avançada & Operacionalização "Dados Mediados" | ✅ Sim | Growth: perfil unificado, curva recuperação, PDF mediado. |

✅ **Conclusão:** 6/7 épicos com valor de utilizador inequívoco; Epic 1 é greenfield foundational bundle aceitável (justificado por starter template + sequência hard-order arquitetónica).

### 5.2 Independência dos Épicos

| Épico | Depende de | Pode ser entregue isoladamente? |
|-------|------------|--------------------------------|
| 1 | — | ✅ Sim (foundational) |
| 2 | Epic 1 (auth, RLS, design system) | ✅ Sim, com Epic 1 entregue |
| 3 | Epic 1 (auth, audit), Epic 2 (jogadores existem) | ✅ Sim |
| 4 | Epic 1, Epic 2 (sessões), Epic 3 (consentimento gating) | ✅ Sim |
| 5 | Epic 1, Epic 2, Epic 3, Epic 4 (fadiga + sRPE) | ✅ Sim, sem dependências forward |
| 6 | Epic 1, Epic 2 (sessões); Epic 5 não é pré-requisito | ✅ Sim, parcialmente paralelo a Epic 5 |
| 7 | Todos os anteriores (acumula dados) | ✅ Sim (Growth phase) |

✅ **Sem dependências forward.** Cada épico só consome saídas de épicos anteriores.

### 5.3 Sizing e Estrutura das Estórias

**Total: 69 estórias** distribuídas por 7 épicos (média 9.9 estórias/épico, range 6–16).

| Épico | Stories | Sizing |
|-------|---------|--------|
| Epic 1 | 16 | Bundle foundational; várias stories pequenas (1.1, 1.2, 1.14, 1.15) e algumas médias (1.6, 1.8, 1.13). |
| Epic 2 | 9 | Bem dimensionadas (CRUD por entidade + retention). |
| Epic 3 | 12 | 1 story por direito GDPR + sub-fluxos de consentimento — granularidade adequada. |
| Epic 4 | 8 | Schema + UI + offline + push em fatias separadas. |
| Epic 5 | 10 | sRPE + ACWR + snapshots + 3 vistas + dashboards + decisão data-driven em fatias claras. |
| Epic 6 | 8 | Eventos + UI + offline + edição + sub + presença + sRPE em fatias claras. |
| Epic 7 | 6 | Growth: 1 story por feature avançada. |

✅ **Sizing apropriado** — todas as stories parecem caber em ~1 dia–3 dias de implementação solo. Nenhuma é "epic-sized".

### 5.4 Qualidade das Acceptance Criteria

**Amostra revista:** Stories 1.1, 1.5, 1.6, 1.10, 1.13, 2.1, 2.2, 7.6.

✅ **Todas seguem formato BDD Given/When/Then** com 4–8 cenários por story.

✅ **Testáveis** — cada AC ancora numa entidade verificável (migration, RLS policy, route handler, UI element, telemetry event).

✅ **Cobrem error paths** — auth invalid (1.5), unsupported browser (1.10), cross-tenant deny (1.6), archived player photo retention (2.2), restricted player blocking PDF (7.6).

✅ **Rastreabilidade explícita** — cada AC referencia FRs/NFRs/ARs/UX-DRs (e.g., "FR1, NFR17, AR12").

✅ **Test coverage como AC** — cada story crítica tem AC "≥80% coverage" (NFR54).

### 5.5 Timing de Criação de Tabelas

✅ **Tabelas criadas just-in-time, não upfront.** Migrations distribuídas por stories:

- Story 1.3 → `clubs`, `profiles` + RLS helpers
- Story 1.12 → `audit_logs`, `telemetry_events`
- Story 2.1 → `players`, `positions`
- Story 2.3 → `player_metrics`
- Story 2.5 → `seasons`
- Story 2.6 → `sessions`
- Story 2.8 → `match_lineups`
- Story 3.1 → `privacy_policy_versions`
- Story 3.2 → `parental_consents`
- Story 4.1 → `fatigue_responses`
- Story 4.7 → `push_subscriptions`
- Story 5.1 → `session_metrics`
- Story 5.3 → `readiness_snapshots`
- Story 5.10 → `data_decisions`
- Story 6.1 → `match_events`
- Story 6.7 → `attendances`
- Story 7.6 → `pdf_reports`

Total ~17 migrations distribuídas. Nenhum mega-migration "schema completo" no Story 1.x.

### 5.6 Conformidade Greenfield + Starter Template

✅ Starter template explícito na Arquitetura (AR1: `create-next-app` com flags fixas).
✅ **Story 1.1 = "Project Initialization & Stack Bootstrap"** — alinhado com regra "Epic 1 Story 1 deve ser setup do starter".
✅ Sprint 1 hard-order (AR33) refletido na sequência: 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.11 → 1.12 → 1.13.
✅ DPIA + DPA setup logo no Story 1.2 (gating compliance) — boa prática.
✅ CI/CD cedo (Story 1.13).

### 5.7 Best Practices Checklist (sumário)

| Critério | Status |
|----------|--------|
| Cada épico entrega valor de utilizador | 6/7 ✅ + 1 misto justificado |
| Cada épico funciona independentemente (com épicos anteriores) | ✅ 7/7 |
| Sem forward dependencies | ✅ Confirmado |
| Stories adequadamente dimensionadas | ✅ 69/69 |
| Tabelas criadas só quando necessárias | ✅ Just-in-time |
| Acceptance Criteria claras (Given/When/Then) | ✅ 100% das amostradas |
| Rastreabilidade FR/NFR/AR/UX-DR mantida | ✅ Em todas as ACs |
| Starter Template story exists (greenfield) | ✅ Story 1.1 |
| CI/CD setup cedo | ✅ Story 1.13 |

### 5.8 Findings

#### 🔴 Critical Violations
**Nenhuma.**

#### 🟠 Major Issues
**Nenhuma.**

#### 🟡 Minor Concerns

1. **Epic 1 tem perfil "foundational bundle"** — combina valor user-facing (auth, navegação, browser block) com infraestrutura (CI/CD, design system, audit logs). Aceitável em greenfield com starter template + sequência hard-order, mas convém:
   - Explicitar na descrição do Epic 1 que é "Sprint 1 foundational" para gerir expectativas de valor user-visible.
   - Considerar split entre "Epic 1a: Auth + UX foundation" e "Epic 1b: CI/CD + ops" se quiser releases parciais ao longo do Sprint 1.

2. **Story 5.6 (Field Formation 4-3-3 Painel)** está no MVP mas o UX spec admite "se prazo apertar, B pode escorregar para Phase 2". Recomenda-se:
   - Marcar Story 5.6 como **flagged/optional MVP** na descrição de Epic 5, ou movê-la para Epic 7 (Growth) com fallback documentado.

3. **Stories 1.2, 1.3, 1.4** (Supabase setup, migrations base, JWT hook) são puramente backend/infrastructure e não têm "user-visible outcome" — embora sejam pré-requisitos válidos no contexto greenfield, não cumprem estritamente o ideal "every story has user value". Aceitável dado AR33.

4. **Cross-épico dependency Epic 4 ↔ Epic 3** — Epic 4 (Fadiga) depende do gating de consentimento parental do Epic 3 para jogadores 13–15 anos. Convém confirmar que o sequenciamento de implementação respeita Epic 3 antes de Epic 4 (sprint plan), ou que Epic 4 inclui um "modo seniores apenas" provisório.

5. **NFRs de Performance (NFR1–NFR13) testáveis mas sem story dedicada.** Lighthouse CI cobre P/A11y/BP/PWA mas P95 latency targets (NFR1: Painel ≤2s, NFR2: questionário ≤500ms, NFR5: ACWR group ≤3s) carecem de story de "performance baseline + budgets". Recomendação: adicionar story em Epic 1 ou Epic 5 para configurar perf budgets e regression checks.

### 5.9 Recomendações de remediação

| # | Item | Severidade | Ação proposta |
|---|------|------------|---------------|
| 1 | Epic 1 sem framing claro de "foundational" | 🟡 | Adicionar parágrafo na descrição do Epic 1 esclarecendo o âmbito Sprint 1 + valor parcial user-visible (auth + browser block + A2HS gating). |
| 2 | Story 5.6 sem flag de fallback | 🟡 | Marcar Story 5.6 como `[MVP — opcional, fallback Phase 2]` ou mover para Epic 7. |
| 3 | NFR Performance budgets sem story | 🟡 | Adicionar Story 1.17 ou 5.11: "Performance Budgets & Regression Gates" com NFR1–NFR13. |
| 4 | Sequenciamento Epic 3 antes Epic 4 | 🟡 | Documentar no sprint plan / sprint-status.md (não bloqueia épicos). |
| 5 | Stories puramente técnicas em Epic 1 | 🟡 | Documentar a justificativa greenfield/AR33 na descrição do Epic 1. |

## 6. Sumário e Recomendações

### 6.1 Estado de Prontidão Global

**Status: 🟢 READY — Pronto para Implementação**

O SPARTA está **maduro e pronto para entrar em Phase 4 (implementação)**, com observações menores que podem ser endereçadas em paralelo com Sprint 1 (não bloqueiam o início).

### 6.2 Métricas-Chave

| Indicador | Valor | Veredicto |
|-----------|-------|-----------|
| FRs documentados no PRD | 59 | ✅ Completo |
| NFRs documentados no PRD | 60 | ✅ Completo |
| FRs cobertos pelos épicos | 59 / 59 | ✅ **100%** |
| Épicos com valor de utilizador claro | 6 / 7 (Epic 1 misto justificado) | ✅ |
| Estórias totais | 69 distribuídas em 7 épicos | ✅ Sizing adequado |
| Estórias com ACs Given/When/Then | 100% das amostradas | ✅ |
| UX Design Requirements (UX-DRs) | 48 / 48 cobertos | ✅ |
| Architecture Requirements (ARs) | 33 / 33 referenciados | ✅ |
| Forward dependencies entre épicos | 0 | ✅ |
| Migrations distribuídas just-in-time | ~17 migrations em 17 stories | ✅ |
| Starter template + Story 1.1 alinhados | Sim | ✅ |
| CI/CD setup cedo | Story 1.13 | ✅ |
| Compliance gating no Sprint 1 | DPIA + DPA na Story 1.2 | ✅ |

### 6.3 Pontos Fortes do Plano

1. **Trio coerente PRD ↔ UX ↔ Arquitetura** — referências cruzadas explícitas (NFRs nos UX-DRs, UX-DRs nas ACs, ARs nas migrations), eliminando ambiguidade.
2. **Coverage map dos épicos é defensivo** — declarado explicitamente FR Coverage Map (linhas 332–353 do `epics.md`), prevenindo drift durante implementação.
3. **Compliance Art. 9 GDPR como princípio fundador** — DPIA, consentimento parental tokenizado, retenção 5 épocas, audit logs, direitos titulares — tudo planeado desde Sprint 1.
4. **Filosofia "dados mediados" preservada em todos os artefatos** — FR26 (PRD), Story 4.6 (épicos), UX-DR25, decision rationale (UX) — sem fissuras.
5. **Custo €0/mês é restrição inflexível e operacionalizada** — heartbeat anti-pause, backup semanal, provider-agnostic (NFR58), watchdog de quotas Supabase.
6. **Wow moment auditável (FR52 + Story 5.10)** — KPI primário com mecanismo UI dedicado.
7. **Stack zero-cost maduro e justificado** — Next.js 16 + Supabase EU + Vercel fra1 + Serwist + Dexie + Resend, com plano B documentado para cada componente.
8. **Acessibilidade como sistema, não checkbox** — WCAG 2.1 AA pragmático com axe-core no CI, redundância sensorial obrigatória, versão linguística sub-14 (NFR43, UX-DR43).

### 6.4 Critical Issues Requiring Immediate Action

🔴 **Nenhum.** Não há bloqueadores críticos para iniciar implementação.

### 6.5 Major Issues

🟠 **Nenhum.**

### 6.6 Minor Concerns (5 itens, todos endereçáveis em paralelo)

1. **Epic 1 sem framing claro de "foundational bundle Sprint 1"** — adicionar parágrafo na descrição esclarecendo o âmbito misto (auth user-visible + scaffolding técnico).
2. **Story 5.6 (Field Formation) sem flag de fallback** — marcar como `[MVP — opcional, fallback Phase 2]` para alinhar com a contingência declarada no UX spec.
3. **NFRs de Performance (NFR1–NFR13) sem story dedicada** — adicionar Story 1.17 ou 5.11: "Performance Budgets & Regression Gates" (NFR1 ≤2s Painel, NFR2 ≤500ms questionário, NFR5 ≤3s recálculo ACWR grupo).
4. **Sequenciamento Epic 3 → Epic 4 não documentado** — registar no sprint plan que Epic 3 (consentimento parental) deve completar antes de Epic 4 (recolha de fadiga) iniciar com menores 13–15.
5. **Stories puramente técnicas em Epic 1** — adicionar nota interpretativa na descrição justificando greenfield + AR33 (Sprint 1 hard-order).

### 6.7 Recommended Next Steps

1. **Endereçar os 5 minor concerns acima** — pode ser feito em 1–2h de edição direta dos artefatos `epics.md` e `prd.md` antes do kick-off do Sprint 1.
2. **Iniciar Sprint 1 — Epic 1 (foundational)** — começar pela Story 1.1 (Project Initialization) seguindo a hard-order AR33. Recomenda-se iniciar agora, em paralelo com edição dos minor concerns.
3. **Concluir DPIA antes do release ao plantel-piloto** — Story 1.2 inicializa o template; o documento completo deve estar assinado antes de qualquer recolha de dados de menores em produção.
4. **Configurar GitHub repo, Supabase project EU, Vercel project + Resend EU** — pré-requisitos das Stories 1.2, 1.13, 1.14, 1.15.
5. **Rever sequenciamento do MVP com os 3 treinadores co-desenvolvedores** — confirmar que Epic 5 (Painel) chega para validação interna antes do fim da semana 3.
6. **Considerar gerar `sprint-status.md` via skill `bmad-sprint-planning`** — para tracking concreto dos 69 stories ao longo do MVP.
7. **Após implementação inicial:** correr `bmad-check-implementation-readiness` novamente em pontos de checkpoint (fim de Sprint 1, antes de release ao plantel) para validar drift.

### 6.8 Distribuição estimada de carga de trabalho

Com base na sizing observada (média 1–3 dias/story solo developer):

| Épico | Stories | Estimativa lower (dias) | Estimativa upper (dias) |
|-------|---------|-------------------------|-------------------------|
| Epic 1 (foundational) | 16 | 16 | 32 |
| Epic 2 (plantel/calendário) | 9 | 9 | 18 |
| Epic 3 (GDPR) | 12 | 12 | 24 |
| Epic 4 (fadiga + push) | 8 | 8 | 16 |
| Epic 5 (Painel) | 10 | 10 | 20 |
| Epic 6 (touchscreen) | 8 | 8 | 16 |
| **Total MVP (Epics 1–6)** | **63** | **63** | **126** |
| Epic 7 (Growth) | 6 | 6 | 12 |

⚠️ Comparado com o **target de 4 semanas (160h ≈ 20 dias úteis)** declarado no PRD: o limite inferior de 63 dias **excede largamente a janela MVP**. Mesmo com paralelização e reuso, isto é alerta sério.

**Recomendação adicional (alta prioridade):** rever o âmbito MVP com os 3 co-desenvolvedores e considerar:
- Adiar Story 5.6 (Field Formation) para Phase 2.
- Adiar Story 1.7 (MFA) para Growth (NFR19 só obriga MFA em multi-tenancy ≥4 clubes).
- Considerar adiar Story 4.7+4.8 (Push) para semana 5–6 — questionário pode funcionar sem push inicialmente.
- Validar se "MVP de 4 semanas" é alvo realista ou se a janela honesta é 8–12 semanas (mais alinhado com 100–120h líquidas declaradas no PRD).

### 6.9 Final Note

Este assessment identificou **5 minor concerns** distribuídos por 2 categorias (framing/documentação + sizing/sequenciamento), **zero critical violations e zero major issues**.

A maturidade dos artefatos é elevada: PRD, UX e Arquitetura são internamente consistentes e mutuamente reforçados; os 7 épicos com 69 stories cobrem 100% dos 59 FRs; as ACs são testáveis (Given/When/Then) e rastreáveis aos requisitos.

**O alerta material está em 6.8: a estimativa de carga de trabalho excede a janela MVP de 4 semanas declarada no PRD.** Esta é uma decisão de scope, não um defeito de planeamento — o que está planeado pode ser implementado, mas talvez não em 4 semanas. Recomenda-se confrontar este facto explicitamente antes do kick-off.

---

**Avaliação realizada em:** 2026-05-07
**Avaliador:** Claude (Opus 4.7) via skill `bmad-check-implementation-readiness`
**Inputs:** prd.md (1120 linhas) · architecture.md (1577 linhas) · epics.md (3002 linhas) · ux-design-specification.md (1497 linhas)
**Output:** este relatório
