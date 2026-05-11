---
stepsCompleted: ["step-01-init", "step-02-discovery", "step-02b-vision", "step-02c-executive-summary", "step-03-success", "step-04-journeys", "step-05-domain", "step-06-innovation", "step-07-project-type", "step-08-scoping", "step-09-functional", "step-10-nonfunctional", "step-11-polish", "step-12-complete"]
status: "complete"
completed: "2026-05-06"
releaseMode: phased
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-Project-R.md"
  - "_bmad-output/planning-artifacts/research/market-solucoes-gratuitas-gestao-performance-futebol-research-2026-05-01.md"
  - "_bmad-output/planning-artifacts/research/domain-metricas-desempenho-atletas-futebol-11-research-2026-05-01.md"
  - "_bmad-output/planning-artifacts/research/technical-stack-tecnico-project-r-research-2026-05-01.md"
  - "_bmad-output/brainstorming/brainstorming-session-2026-05-01-1000.md"
  - "_bmad-output/brainstorming/brainstorming-session-2026-05-01-1100.md"
  - "docs/projectr.requirements.md"
documentCounts:
  briefCount: 1
  researchCount: 3
  brainstormingCount: 2
  projectDocsCount: 1
workflowType: 'prd'
classification:
  projectType: web_app
  domain: sports_tech
  complexity: medium-high
  projectContext: greenfield
  notes: "PWA mobile-first; dados de saúde Art. 9 GDPR com consentimento parental para 13-15 anos"
---

# Product Requirements Document - Project R

**Author:** Antero
**Date:** 2026-05-06

## Executive Summary

O Project R é uma plataforma de gestão de performance desportiva, de custo zero, construída para futebol 11 amador. Resolve um problema preciso: nenhum staff técnico amador consegue, antes de uma convocatória, ver de forma integrada o estado físico, fadiga e tendência de carga de cada jogador — porque os dados existem dispersos por WhatsApp, Excel e memória do treinador, e nenhuma ferramenta gratuita os cruza.

A plataforma integra três componentes que hoje só existem isolados ou em soluções profissionais pagas: questionários de fadiga pré e pós-sessão (5 dimensões), registo manual de estatísticas táticas validadas pela ciência do desporto (7 métricas preditivas de resultado), e um Painel de Prontidão semáforo (verde/amarelo/vermelho) calculado automaticamente a partir de fadiga recente, ACWR e assiduidade. O motor analítico — Correlação Fadiga × Performance, Curva de Recuperação Individual — emerge à medida que os dados se acumulam ao longo da época.

Serve três papéis com fronteiras deliberadas: o **treinador principal** consulta o Painel de Prontidão antes de cada sessão (decisão informada em <30 segundos); o **analista/preparador físico** regista estatísticas via interface touchscreen de 3 ecrãs e configura o sistema; o **jogador** preenche o questionário em <2 minutos via push notification — e **não tem acesso direto** ao seu próprio relatório, que chega através do contacto com o staff. Esta mediação é uma decisão de produto: a tecnologia fornece dados ao staff técnico para enriquecer a conversa humana, não para a substituir.

Âmbito inicial: 1 clube, plantel de 40 jogadores em 2 equipas, faixa etária a partir dos 13 anos (incluindo escalões de formação sub-14 a sub-19 e seniores).

### What Makes This Special

Cinco diferenciadores estruturais, validados por market research:

1. **Integração inexistente no segmento gratuito** — fadiga + performance + prontidão num só sistema. Spond e Mingle Sport cobrem comunicação e plantel; TeamStats cobre estatísticas; AthleteSR cobre fadiga genérica. Nenhuma cruza estes três pilares para futebol 11. Soluções profissionais que o fazem (Catapult, Metrifit, Hudl) custam €500–5.000+/ano.

2. **Custo zero estruturalmente sustentável, não freemium disfarçado** — o stack (PWA + Supabase Free + Vercel Hobby + Web Push VAPID) sustenta deployments de clube individual sem necessidade de monetização. Inflexão real apenas aos 4–5 clubes em multi-tenancy partilhada.

3. **Filosofia humano-primeiro deliberada** — o jogador não tem acesso direto ao seu relatório. A informação chega-lhe através do staff técnico, em conversa informada. Isto é decisão de produto, não de fase: o objetivo é melhorar o contacto humano, não automatizá-lo.

4. **Co-desenvolvido com 3 treinadores** que validam cada decisão. Não é tecnologia adaptada ao futebol — é ferramenta de futebol construída com quem o pratica.

5. **GDPR Art. 9 + consentimento parental como princípio fundador** — dados de fadiga e bem-estar são categoria especial. Atletas com 13–15 anos exigem consentimento parental verificável (CNPD/Portugal). Implementado no onboarding desde o dia 1, não como anexo legal posterior.

**Insight central — porquê agora:** A ciência do desporto sabe há anos prevenir lesões e gerir carga (ACWR, Session-RPE, questionários de bem-estar). O custo das ferramentas afastou os clubes amadores. Em 2026, o stack tecnológico zero-cost amadureceu pela primeira vez (Web Push em iOS 16.4+, Supabase EU com DPA gratuito, PWAs maduras). Os incumbentes (Spond, Mingle Sport) ainda não responderam com módulo de wellness gratuito. Janela competitiva estimada: 12–24 meses.

**Momento "wow" do produto:** a primeira convocatória em que os dados contradizem a intuição do treinador — e o staff opta por seguir os dados.

## Project Classification

- **Project Type:** `web_app` (PWA — Progressive Web App, mobile-first, sem instalação em stores)
- **Domain:** `sports_tech` (custom; com obrigações GDPR Art. 9 — categoria especial de dados de saúde, incluindo menores)
- **Complexity:** `medium-high`
- **Project Context:** `greenfield`

**Implicações da classificação:**

- **PWA mobile-first** — service worker (Serwist), IndexedDB outbox (Dexie), drain por foreground (iOS sem Background Sync), instalação no home screen obrigatória para receber push em iOS
- **GDPR Art. 9 + menores** — base jurídica documentada, consentimento parental verificável para 13–15 anos, retenção limitada por tipo de dado, direito ao apagamento, DPIA, payloads de push opacos (sem Article 9 data)
- **Multi-tenant ready desde o dia 1** — Postgres com RLS, mesmo que MVP cubra apenas 1 clube (preparação para horizonte 2)
- **Complexidade medium-high** — justifica detalhamento explícito de cálculos científicos (ACWR, sRPE) com fórmulas, modelo de permissões por papel, estratégia offline-first com conflitos UUIDv7, e plano de testes

## Success Criteria

Os critérios de sucesso do Project R organizam-se em quatro dimensões. Todos os limiares são herdados do Product Brief, da pesquisa de domínio (PMC, NASE) e do checklist de stakeholders, ou refinados onde os documentos eram vagos.

### User Success

O sucesso do utilizador é medido através de adesão, fricção e impacto na decisão:

- **Adesão dos jogadores ao questionário de fadiga ≥ 80%** dos jogadores convocados por sessão (treino ou jogo). Medido por sessão; reportado em dashboard semanal.
- **Tempo médio de preenchimento do questionário ≤ 2 minutos** (P95). Cronómetro do `submitted_at` menos `started_at` dentro da PWA.
- **Uso do Painel de Prontidão pelo staff técnico antes de ≥ 90% das sessões.** Medido por log de visualização nas 4 horas anteriores ao início da sessão.
- **Decisão informada em ≤ 30 segundos** — tempo entre abrir o Painel de Prontidão e tomar uma ação documentada (chamar/não chamar, marcar precaução). P95.
- **≥ 1 decisão de convocatória documentada por época** em que os dados contradisseram a intuição inicial e o staff optou por seguir os dados — o "wow moment" deliberado do produto.

### Business Success

O Project R não tem modelo de receita no MVP. "Business success" significa viabilidade do produto e validação do problema:

- **Validação positiva por ≥ 3 treinadores externos** (fora dos co-desenvolvedores) durante a fase de testes nos meses 2–6. Validação = uso continuado ≥ 4 semanas + entrevista de saída registada.
- **Plantel-piloto adota o sistema na sua totalidade** — 40 jogadores e 5 staff ativos no fim do mês 1 (≥ 90% dos jogadores com pelo menos 1 questionário preenchido).
- **Zero deserções de uso por fricção** — nenhum jogador desinstala a PWA por motivos de UX nas primeiras 4 semanas. Medido por survey de saída + telemetria de eventos `app_uninstall`.
- **Custo total de operação = €0/mês — restrição inflexível.** Qualquer custo emergente (limite gratuito atingido, dependência paga) dispara revisão de arquitetura, não aumento de orçamento. Domínio próprio fora do MVP; PWA acessível via subdomínio gratuito do host.
- **Janela competitiva preservada** — Spond/Mingle Sport não lançaram módulo de wellness gratuito comparável até final do mês 12.

### Technical Success

O sucesso técnico cobre disponibilidade, integridade de dados, conformidade e preparação para escala:

- **Disponibilidade ≥ 99% em janelas de jogo e treino** (dias e horas em que estão agendadas sessões no calendário do clube). Medido em Vercel/Supabase status + heartbeat externo.
- **Zero perdas de dados por sincronização offline** — toda submissão de questionário ou evento estatístico em modo offline chega ao servidor após reconexão (≤ 24h). UUIDv7 client-generated + outbox idempotente.
- **Heartbeat anti-pause Supabase ativo** — GitHub Action a cada 6 dias com query trivial; alertas se 2 execuções falharem consecutivamente.
- **Tempo de cálculo do Painel de Prontidão ≤ 2 segundos** para 40 jogadores (incluindo agregações ACWR/sRPE). P95.
- **iOS install rate ≥ 40% no fim do mês 2** entre utilizadores iOS — abaixo deste limiar, dispara revisão de UX de onboarding ou avaliação de wrap Capacitor (Fase 2).
- **Cobertura de testes automatizados ≥ 80%** nas funções críticas de cálculo (ACWR, sRPE, Painel de Prontidão) e nas mutations da outbox de sincronização.

### Compliance Success (GDPR Art. 9)

Dado a classificação `sports_tech` com dados de saúde e menores, a conformidade é critério de sucesso explícito, não pressuposto:

- **Zero incidentes de violação de dados pessoais** durante a vida do MVP (categoria especial Art. 9 — fadiga, peso, altura).
- **100% dos jogadores com 13–15 anos com consentimento parental verificável registado** antes de qualquer recolha de dados de fadiga. Bloqueio de acesso até confirmação parental.
- **Direito ao apagamento processado em ≤ 30 dias** após pedido (legal: 1 mês com possível extensão de 2; alvo interno mais apertado).
- **DPIA documentada e assinada** antes do lançamento ao plantel-piloto.
- **Registo de atividades de tratamento (Art. 30 GDPR)** atualizado e revisto antes de cada nova versão major.

### Measurable Outcomes

Síntese executiva dos KPIs, agrupados por horizonte:

| Métrica | Alvo | Quando medir |
| --- | --- | --- |
| Taxa de preenchimento de questionários | ≥ 80% por sessão | Mês 1 → contínuo |
| Tempo médio de preenchimento (P95) | ≤ 2 min | Mês 1 → contínuo |
| Uso do Painel pelo staff antes de sessões | ≥ 90% | Mês 1 → contínuo |
| Decisões de convocatória que contradisseram intuição | ≥ 1 documentada | Por época |
| Padrões individuais de fadiga identificados | ≥ 3 por jogador-chave | Meses 2–6 |
| Validação por treinadores externos | ≥ 3 ativos ≥ 4 semanas | Meses 2–6 |
| Disponibilidade em janelas de sessão | ≥ 99% | Contínuo |
| Custo mensal de operação | €0/mês (estrito) | Contínuo |
| iOS install rate | ≥ 40% | Fim do mês 2 |
| Cobertura de testes em funções críticas | ≥ 80% | Pré-release MVP |
| Incidentes GDPR | 0 | Contínuo |

## Product Scope

O âmbito divide-se em três níveis. Todas as inclusões no MVP herdam diretamente do Brief; o reordenamento privilegia o caminho mais curto até validar o "wow moment" (decisão de convocatória contradita pelos dados) e fechar o ciclo GDPR/menores antes de qualquer recolha em produção.

### MVP - Minimum Viable Product (4 semanas)

O MVP cobre o ciclo completo: onboarding com consentimento → recolha de fadiga → registo de estatísticas → Painel de Prontidão → decisão de convocatória.

#### Gestão de identidade e acesso

- Onboarding com 3 papéis: treinador, analista, jogador
- Fluxo de consentimento parental verificável para 13–15 anos (email ao responsável, confirmação auditável, bloqueio de acesso até confirmação)
- Modelo de permissões por papel: jogador vê apenas o seu questionário; staff vê tudo do plantel
- Política de retenção de dados configurável por tipo

#### Gestão de plantel e calendário

- Registo de jogadores (nome, idade, número, foto, posição principal e até 4 alternativas, escalão etário)
- Histórico de peso e altura com séries temporais
- Calendário de treinos e jogos com data, hora, tipo
- Gestão de épocas (start/end dates configuráveis, dados acumulados ao longo da carreira no clube)

#### Recolha de fadiga e bem-estar

- **Questionário pré-sessão:** 5 dimensões (energia muscular, concentração/motivação, qualidade do sono, desconforto músculo-articular, estado emocional) + novo campo de **estado emocional/humor** antes da sessão (escala emocional com emojis)
- **Questionário pós-sessão:** 5 dimensões originais + novo campo de **dores musculares específicas com zona do corpo** (seleção de zonas: pescoço, ombro, cotovelo, punho, costas, anca, joelho, tornozelo, tendão de aquiles, outra)
- **Novos campos de contexto:** 
  - Flag booleano **"tem testes/exames esta semana?"** (impacto na carga prevista)
  - **Histórico de peso** — registado pelo analista, com série temporal para correlação com fadiga/performance
- Linguagem do questionário adaptada e validada para escalão sub-14 (incluindo escalas emocionais com pictogramas)
- Push notifications automáticas configuráveis (X minutos antes/depois da sessão) — Web Push (VAPID) via Supabase Edge Function
- Modo offline com sincronização automática (Serwist + Dexie + outbox UUIDv7)

#### Recolha de performance

- Registo de assiduidade e minutos jogados por sessão
- **Estatísticas manuais via interface touchscreen de 3 ecrãs (jogador → ação → zona do campo):**
  - **Ações individuais:** perdas de bola (com zona de construção: Zona 1 ou 2), recuperação de bola (com zona: 1, 2 ou 3), remates (totais e enquadrados, com zona onde foi efetuado), passes completados, pressões defensivas, ações defensivas e ofensivas com sucesso
  - **Ações coletivas/táticas:** cantos defensivos e ofensivos (quantitativa por parte, com indicação do lado do campo), entradas na área adversária vs. entradas permitidas na nossa área
  - **Contexto de jogo:** golos marcados e sofridos (quantitativa, parte, zona, período do jogo, tipo de jogada — canto, jogada corrida, livre direto, outro), cartões amarelos e vermelhos (com tipo: palavra ou falta, e zona do campo onde ocorreu), clean sheet (minutos sem sofrer golos)
  - **Tempo de jogo:** registo de tempo de jogo útil via 2 relógios configuráveis (tempo total vs. tempo com bola em jogo)
- Session-RPE (escala 1–10 × duração) registado pelo analista após cada sessão
- **Agregações automáticas:** % de convocatórias por atleta (época/carreira), % minutos por atleta (época/carreira)

#### Inteligência de prontidão

- Cálculo automático de ACWR (carga aguda 7d / carga crónica 28d) com limiares diferenciados para 13–17 anos vs. seniores
- Cálculo automático de sRPE
- Painel de Prontidão semáforo verde/amarelo/vermelho por jogador
- 3 dashboards: estado do plantel por sessão (treinador), tendências individuais de fadiga 4 semanas (analista), carga acumulada por jogador na época (preparador físico)

#### Conformidade e portabilidade

- Exportação CSV de dados por jogador (direito à portabilidade Art. 20 GDPR)
- Endpoint de eliminação de dados por jogador (direito ao apagamento Art. 17)
- Política de privacidade com versão adaptada para menores
- Heartbeat anti-pause Supabase + monitorização de quotas

### Growth Features (Post-MVP, meses 2–6)

Depois de validada a adesão e a utilidade do MVP:

- **Correlação Fadiga × Performance** — gráficos individuais que ligam padrões de fadiga a desempenho em jogo, por jogador. Requer histórico mínimo de 4–6 semanas.
- **Curva de Recuperação Individual** — perfil de recuperação por atleta nos dias após sessão intensa.
- **Dashboard de Equipa Agregado** — métricas coletivas (média de fadiga, taxa de presença, estatísticas agregadas por posição, evolução ao longo da época).
- **Página de Perfil Unificado do Jogador** — vista consolidada com dados pessoais, evolução de fadiga, estatísticas por época e carreira, presenças, estado atual.
- **Exportação em PDF** de relatórios individuais para partilha mediada pelo staff técnico (não acesso direto do jogador).
- **Multi-equipa dentro do mesmo clube** — preparação para Horizonte 1: 2 equipas a partilhar plantel de 40 jogadores.
- **Análise de Adversários (módulo opcional)** — formação habitual, jogadores-chave, padrões táticos. Completamente separado do core.

### Vision (Future, 18+ meses)

Visão de longo prazo, condicionada ao sucesso dos horizontes anteriores:

- **Multi-clube com benchmarking anónimo entre equipas** (Horizonte 2 do Brief)
- **Possível modelo freemium** com funcionalidades avançadas pagas (relatórios exportáveis premium, API de integração, multi-clube ilimitado)
- **API aberta para integração com GPS e wearables** — endpoints standard para receber dados externos sem reescrever o núcleo
- **Extração automática de estatísticas por computer vision** — análise de vídeo de smartphone (timeline estimado: 2–4 anos)
- **Métricas avançadas:** xG (Expected Goals), PPDA (Passes Per Defensive Action)
- **Alertas em tempo real durante jogo** quando métricas cruzam limiares
- **Benchmarks por posição** — limiares ACWR diferenciados defesa/médio/avançado
- **Modelos preditivos de prontidão por AI** — previsão com 48–72h de antecedência baseada em histórico individual (requer ≥ 1–2 épocas de dados)
- **Expansão a mercados de língua portuguesa** — Brasil (13.000 clubes amadores registados), Angola, Moçambique
- **Wrap nativo via Capacitor** — disparado se iOS install rate <40% no mês 2
- **Objetivos e metas individuais por jogador com tracking de progresso** — definição de targets (físicos, técnicos, de adesão) por jogador e visualização de evolução. Backlog herdado do Brief original.

## User Journeys

As jornadas abaixo cobrem todos os atores que interagem com o Project R no âmbito do MVP. As personas são as definidas no Product Brief, complementadas com o encarregado de educação — ator não negligenciável dado o requisito de consentimento parental para 13–15 anos (RGPD/CNPD).

### Journey 1 — José, treinador principal (happy path)

**Persona:** José, 48 anos, treinador principal do plantel sénior. Antigo amador, treinou 12 anos no clube. Vive o futebol pelo telemóvel — WhatsApp, calendário Google, Excel improvisado. Não é técnico, mas é exigente: o que faz, faz com método.

**Cenário:** Sábado, 10h30. O jogo é às 16h. José está em casa, café na mão, telemóvel ao lado.

**Opening scene** — Antes do Project R, este momento era um exercício de memória. "Aquele miúdo queixou-se da coxa terça? O Diogo perdeu o último jogo? Quantos minutos fez o Tomás? Acho que sim." A convocatória fechava-se em 15 minutos por instinto, com 2–3 jogadores incertos a dependerem do humor do dia.

**Rising action** — José abre a PWA do Project R no telemóvel (já adicionada ao home screen). Toca em "Painel de Prontidão". O ecrã carrega em <2s e mostra o plantel: 28 verdes, 7 amarelos, 5 vermelhos. Ordenação por estado, depois por posição. Toca em cada amarelo para ver o detalhe — tendência de fadiga das últimas 2 semanas, ACWR, presenças em treino.

**Climax** — Em 6 minutos tem a leitura completa. Os 5 vermelhos saem. Dos 7 amarelos, 4 são opções de banco; 3 são titulares com gestão de minutos (substituição planeada aos 60'). A convocatória é decidida com base em informação consolidada.

**Resolution** — José envia a convocatória pelo grupo do WhatsApp. Pela primeira vez em 12 anos de treino, sente que "não esqueci ninguém". O telefonema do Tomás às 11h ("treinador, ontem dormi mal") já não é surpresa — está no painel desde manhã.

**Capabilities revealed:**

- Painel de Prontidão com semáforo agregado e ordenação
- Drill-down por jogador com tendência de fadiga 2–4 semanas
- Cálculo automático de ACWR com limiares por escalão
- Performance: carregamento ≤2s para 40 jogadores
- PWA instalada no home screen com acesso autenticado persistente

### Journey 2 — José, edge case ("wow moment")

**Cenário:** Mesmo José, três sábados depois.

**Opening scene** — José tem a convocatória decidida na cabeça desde quinta-feira. O Tomás é titular indiscutível — fez 90 minutos no jogo passado, "está bem". Abre o painel mais por hábito que por dúvida.

**Rising action** — Tomás aparece a **vermelho**. Esfrega os olhos. Toca no nome. Vê 4 sessões consecutivas com fadiga muscular ≥4 (escala 1–5), ACWR em 1.8, queda de 3kg de peso na última semana. O jogador não disse nada em treino — sorriu, treinou normal, nunca pediu para sair.

**Climax** — Conflito interno. Em 12 anos de carreira, José nunca tirou um titular sem queixa explícita. Mas os dados são inequívocos. Pega no telemóvel, liga ao Tomás. "Diz-me como te sentes, sem floreados." Tomás cede: dorme mal há uma semana, perdeu apetite, não quis falhar o jogo da semana passada.

**Resolution** — Tomás fica no banco. Joga 25 minutos. Na semana seguinte recupera. Em conversa pós-jogo com o Tomás, José diz: "se não fosse o painel, tinhas jogado 90 e amanhã estavas lesionado." Esta é a primeira decisão documentada do "wow moment" — registada em nota livre no perfil do jogador.

**Capabilities revealed:**

- Detalhe do jogador com séries temporais de fadiga + peso + ACWR
- Notas/observações em texto livre por staff
- Marcação de "decisões data-driven" para auditoria de uso (KPI de validação)
- Histórico cumulativo cross-sessões (não pontual)

### Journey 3 — Ana, preparadora física e analista (operações)

**Persona:** Ana, 34 anos, licenciada em ciências do desporto, trabalha no clube há 3 épocas. É a única no staff que sabe o que é ACWR. Acumula funções de preparação física, recolha de dados e quase tudo o que envolve folha de cálculo.

**Cenário:** Sábado, 17h45. O jogo acabou há 15 minutos. Ana está na bancada com tablet de 10".

**Opening scene** — Antes do Project R, este momento eram 90 minutos de Excel à noite, com a memória do jogo a desvanecer. Faltavam sempre eventos. Os números nunca batiam certo.

**Rising action** — Durante o jogo, Ana usou os 3 ecrãs touchscreen do Project R: jogador → ação → zona do campo. Tap-tap-tap. 187 eventos registados em 90 minutos sem desviar os olhos do campo por mais de 1 segundo. Ao apito final, tudo está sincronizado.

**Climax** — Após o jogo, na bancada, Ana abre a vista pós-sessão. Confirma os minutos jogados (auto-preenchidos a partir das substituições registadas), introduz o Session-RPE de cada jogador (escala 1–10, perguntado um por um no balneário), grava. O sistema atualiza ACWR para os 18 convocados em <3 segundos.

**Resolution** — Ana fecha o tablet. À noite, em casa, abre o dashboard "tendências individuais 4 semanas" no portátil. Vê 2 jogadores com ACWR a entrar em zona amarela. Manda mensagem ao José: "atenção ao Diogo e ao Pedro na próxima semana, vou ajustar o treino de quinta."

**Capabilities revealed:**

- Interface touchscreen 3-ecrãs otimizada para uso single-handed em bancada
- Modo offline robusto (jogo sem cobertura é cenário comum em campos amadores)
- Registo de minutos jogados auto-derivado de substituições
- Input de sRPE em batch pós-sessão
- Recálculo de ACWR <3s para grupo
- Dashboard "tendências individuais 4 semanas" para análise diferida

### Journey 4 — Tomás, jogador 16 anos (offline + recuperação de erro)

**Persona:** Tomás, 16 anos, médio. Sub-19 que treina com os seniores. iPhone 12 com iOS 18. Adolescente típico — adesão alta nos primeiros dias, depois oscila.

**Cenário:** Domingo, 11h30. Treino da manhã num campo nos arredores. Antes do treino arrancar.

**Opening scene** — Tomás chega ao campo. A push notification do questionário pré-sessão chegou às 10h45. Não tinha rede. Abre a PWA mesmo assim.

**Rising action** — A app abre normalmente — shell em cache. O questionário das 5 dimensões aparece. Tomás preenche em 1m20s: energia 3, concentração 4, sono 2 (foi à festa do irmão), desconforto 2, emocional 3. Toca "Submeter". Aparece um banner discreto: "1 pendente — sincroniza quando voltar a ter rede". Tomás guarda o telemóvel no balneário e vai treinar.

**Climax** — O treino acaba às 13h30. Tomás reabre a app já no carro (já com 4G). O banner muda para "A sincronizar..." e desaparece após 2 segundos. Ana, em casa, vê os dados a aparecer em tempo real no painel.

**Resolution** — À noite, push notification do questionário pós-sessão. Tomás responde em 30 segundos antes de jantar. Nem se lembra que o de manhã foi offline — o produto fez-se transparente.

**Edge case dentro da edge case:** se Tomás tivesse trocado de telemóvel sem sincronizar, a outbox local perdia-se. Mitigação: badge persistente "1 pendente" mantém-se até confirmar ack do servidor; toast não-dismissível avisa antes de logout.

**Capabilities revealed:**

- Service worker com shell cached para abertura offline
- Outbox IndexedDB com indicador visual persistente de pendentes
- Drain automático em `online` + `visibilitychange:visible`
- Recuperação de outbox órfã antes de logout
- Push notifications via Web Push (VAPID), iOS 16.4+ instalado em home screen

### Journey 5 — Sandra, mãe do Diogo (14 anos) — gateway de consentimento

**Persona:** Sandra, 42 anos, gestora administrativa. Não é técnica mas usa email e WhatsApp todos os dias. Diogo é o filho mais novo, joga sub-15.

**Cenário:** Quinta-feira, 19h45. Email do clube na caixa de entrada.

**Opening scene** — Antes do Project R, Sandra assinava papéis no início da época sem ler. Desta vez é diferente — o email diz "Recolha de dados de saúde do seu filho — pedimos o seu consentimento explícito".

**Rising action** — Sandra abre o email no telemóvel. Vê uma página simples, em linguagem clara (não juridiquês), explicando: que dados são recolhidos (5 dimensões de fadiga + peso/altura), porque (gestão de carga e prevenção de lesões), quem acede (treinador, analista, preparador físico), por quanto tempo (até saída do clube + 1 época). Há um link para a política de privacidade completa e um botão "Tenho dúvidas".

**Climax** — Sandra carrega em "Aceito" após ler. O sistema valida o token único do email, regista timestamp e IP, envia confirmação para Sandra **e** desbloqueia o acesso do Diogo. Diogo recebe push notification: "podes começar a usar".

**Resolution** — 3 meses depois, Sandra recebe email proativo: "lembramos que pode pedir cópia ou eliminação dos dados do seu filho a qualquer momento". O link funciona. A confiança aumenta.

**Edge case:** Se Sandra não responder em 7 dias, o sistema reenvia. Se não responder em 14 dias, o Diogo permanece bloqueado e o staff é notificado para contacto direto. Nunca há recolha sem consentimento ativo.

**Capabilities revealed:**

- Fluxo de onboarding parental com email tokenizado
- Linguagem adaptada a não-juristas, com versão para menor (legal Art. 12)
- Logging auditável de consentimento (timestamp + IP + versão da política aceite)
- Bloqueio de acesso do menor até confirmação parental explícita
- Reminders automatizados pós-7/14 dias
- Endpoints de portabilidade (Art. 20) e apagamento (Art. 17) acessíveis ao responsável parental

### Journey Requirements Summary

As 5 jornadas revelam capacidades agrupáveis em 7 áreas funcionais. Esta tabela serve como ponte para os Functional Requirements (Step 6).

| Capacidade | Jornadas que a exigem | Prioridade MVP |
| --- | --- | --- |
| Painel de Prontidão (semáforo + drill-down) | 1, 2 | Crítica |
| Detalhe de jogador com séries temporais | 1, 2 | Crítica |
| Interface touchscreen 3-ecrãs para registo de eventos | 3 | Crítica |
| Modo offline com outbox + drain por foreground | 3, 4 | Crítica |
| Push notifications via Web Push (VAPID) | 1, 4 | Crítica |
| Cálculo automático ACWR + sRPE | 1, 2, 3 | Crítica |
| Fluxo de consentimento parental (email tokenizado) | 5 | Crítica (gating compliance) |
| Notas/observações em texto livre | 2 | Alta |
| Auto-derivação de minutos jogados | 3 | Alta |
| Dashboard tendências 4 semanas | 3 | Alta |
| Reminders automatizados de consentimento (D+7/D+14) | 5 | Alta |
| Endpoints de portabilidade e apagamento | 5 | Crítica (compliance) |
| Logging auditável de consentimento | 5 | Crítica (compliance) |

**Decisões de produto reveladas pelas jornadas:**

- O staff técnico (Ana) é a "central de comando operacional" — não é só um utilizador secundário; é quem mantém o sistema vivo. UX para Ana é tão crítica como UX para José.
- O encarregado de educação **não é utilizador da app** — é gateway de consentimento, contactado exclusivamente por email com tokens. Esta separação evita fricção e permite que a aplicação principal só tenha 3 papéis ativos.
- A jornada offline (Journey 4) exige que **a UX de pendentes seja persistente e visível** — é a única forma de compensar a ausência de Background Sync em iOS.
- O "wow moment" (Journey 2) **precisa de um mecanismo explícito de marcação** ("decisão data-driven") para que o KPI "≥1 decisão por época" seja auditável.

## Domain-Specific Requirements

A classificação `sports_tech` com obrigações GDPR Art. 9 (categoria especial — dados de saúde) e menores impõe requisitos não-funcionais que moldam a arquitetura desde o dia 1. Esta secção consolida-os.

### Compliance & Regulatory

#### Base jurídica (RGPD Art. 6 + Art. 9)

- **Base legítima primária para todos os dados pessoais:** consentimento explícito do titular (Art. 6(1)(a)) ou, para menores 13–15 anos, do titular da responsabilidade parental.
- **Base adicional para dados de categoria especial** (fadiga, peso, altura, registo de desconforto/lesão): consentimento explícito ao abrigo do Art. 9(2)(a). Documentar em DPIA.
- **Avaliação de "consentimento livre" em contexto desportivo:** dado que atletas em equipa podem sentir pressão para consentir, o sistema regista *também* a possibilidade de retirar consentimento sem prejuízo da sua continuidade no clube. Texto da política inclui este disclaimer explícito.

#### Idade e consentimento parental (Portugal)

- **Idade de consentimento digital fixada em 13 anos** (Portugal — limite mínimo permitido pelo RGPD).
- **Faixa 13–15 anos:** consentimento parental obrigatório, **verificável e auditável**. Implementação via:
  - Email tokenizado ao endereço do responsável parental
  - Token de uso único, expiração 14 dias, ligado ao registo de jogador específico
  - Confirmação registada com timestamp, IP, versão da política aceite
  - Bloqueio de acesso do menor até confirmação ativa
- **Faixa 16+:** consentimento próprio do atleta é válido.
- **Toda a comunicação com menores em linguagem adaptada** (Art. 12 RGPD): versão da política de privacidade simplificada para 13–15 anos, sem juridiquês.

#### Direitos dos titulares (Capítulo III RGPD)

| Direito | Implementação MVP | SLA |
| --- | --- | --- |
| Acesso (Art. 15) | Endpoint de exportação CSV por jogador | ≤ 30 dias |
| Retificação (Art. 16) | Edição direta no perfil pelo staff (com log) | ≤ 7 dias |
| Apagamento (Art. 17) | Endpoint de eliminação por jogador, cascata para dados relacionados | ≤ 30 dias |
| Portabilidade (Art. 20) | Mesma exportação CSV em formato estruturado e legível por máquina | ≤ 30 dias |
| Oposição (Art. 21) | Botão de "retirar consentimento" no perfil do jogador/responsável | Imediato |
| Limitação (Art. 18) | Flag de "tratamento limitado" no perfil que congela o histórico sem apagar | ≤ 7 dias |

Para menores, todos os direitos são exercíveis pelo titular da responsabilidade parental até aos 18 anos.

#### Política de retenção

- **Dados ativos** (jogador no clube): conservados durante a permanência **+ 5 épocas adicionais** após saída. Justificação: análise inter-épocas longitudinal, perfil de carreira no clube, e padrões de carga e recuperação que requerem janela longa para significância estatística.
- **Após saída do clube + 5 épocas:** anonimização irreversível (UUID retido para integridade estatística agregada; dados pessoais e biométricos eliminados).
- **Dados de menores que atingem maioridade:** notificação ao titular aos 18 anos para reconfirmar consentimento próprio; sem reconfirmação em 90 dias, anonimização automática (mesmo se ainda dentro do período de 5 épocas).
- **Logs de auditoria de consentimento:** retidos por 6 anos (alinhado com obrigações de prova de conformidade).
- **Base jurídica para retenção alargada:** documentar no registo Art. 30 a finalidade legítima (análise longitudinal de carreira); informar o titular no momento do consentimento; oferecer apagamento antecipado a pedido (Art. 17 sobrepõe-se).

#### Sem DPO formal designado

O Project R **não designa DPO formal** — não atinge os limiares do Art. 37 RGPD (autoridade pública, monitorização sistemática em larga escala, ou tratamento em larga escala de dados de Art. 9 enquanto atividade principal). Razões:

- Tratamento limitado a 1 clube no MVP (40 atletas)
- Não é atividade principal do clube (clube é entidade desportiva, não médica)
- Sem monitorização sistemática de pessoas externas

**Limiares de revisão:** designação de DPO formal é reavaliada se ocorrer qualquer um dos seguintes:

- Multi-clube atinge ≥ 10 clubes ativos
- Plataforma processa dados de ≥ 1.000 atletas em simultâneo
- Indicação explícita da CNPD em fiscalização

#### Registo de atividades de tratamento (Art. 30)

Documento mantido fora do produto, atualizado antes de cada release major, incluindo:

- Finalidades do tratamento (gestão de carga, prevenção de lesões, decisão de convocatória, análise longitudinal de carreira)
- Categorias de titulares (atletas adultos, atletas menores 13–17, staff técnico, encarregados de educação)
- Categorias de dados (identificação, biométricos, saúde-fadiga, performance desportiva)
- Categorias de destinatários (apenas staff autorizado do clube; nenhum terceiro além de processadores técnicos)
- Sub-processadores: Supabase Inc. (Postgres + Auth + Storage), Vercel Inc. (hosting), Resend Inc. (email transacional), serviços de push browser (Apple/Mozilla/Google — mediados pelo browser, não escolha do produto)
- Transferências internacionais: residência de dados na UE (Supabase Frankfurt/Dublin/Londres/Paris; Vercel `fra1`; Resend EU region); SCCs UE em vigor com sub-processadores
- Prazos de conservação por categoria (acima)
- Medidas técnicas e organizativas (criptografia at-rest e in-transit, RLS, MFA escalonado para staff)

#### DPIA — Análise de Impacto

Obrigatória dado o tratamento de dados de saúde de menores em larga escala relativa ao clube. **Concluída e assinada antes do lançamento ao plantel-piloto.** Componentes mínimos:

- Descrição do tratamento e finalidade
- Avaliação de necessidade e proporcionalidade (incluindo justificação da retenção de 5 épocas)
- Identificação de riscos para os direitos dos titulares
- Medidas de mitigação
- Validação documentada e parecer da CNPD se aplicável

### Technical Constraints

#### Segurança e controlo de acesso

- **Encriptação at-rest e in-transit por defeito** (TLS 1.3 obrigatório, Supabase column-level encryption para campos críticos se necessário).
- **Row-Level Security (RLS) Postgres ativada em todas as tabelas com dados pessoais.** Políticas baseadas em (clube_id, role) — preparação para multi-tenant futuro.
- **Autenticação:** Supabase Auth com password + email verification.
  - **MFA opcional para staff técnico no MVP**
  - **MFA obrigatório para staff técnico a partir da Growth phase** (≥4 clubes em multi-tenancy partilhada)
- **Sessões com expiração curta** (1h access token, 30 dias refresh com auto-refresh). Logout forçado em mudança de password.
- **Logs de acesso a dados de saúde:** quem acedeu a dados de quem, quando. Retenção 12 meses. Acessível ao titular sob pedido.
- **Princípio do menor privilégio:** jogadores acedem apenas aos seus questionários (não vêem dados de outros nem os seus próprios relatórios processados); analista vê tudo do plantel; treinador vê tudo do plantel mas com UI focada em decisão (Painel de Prontidão).

#### Privacidade por design

- **Minimização de dados:** só recolhemos o necessário. Sem geolocalização, sem dados de contacto além do email do responsável (para menores), sem dados clínicos detalhados (lesões registadas como "desconforto", não como diagnóstico).
- **Pseudonimização interna:** UUIDs como chaves primárias; nomes apenas em camadas de UI autenticadas.
- **Payloads de push opacos:** notificações nunca contêm dados de Art. 9. Apenas texto genérico ("Hora do check-in pós-sessão") + deep link autenticado.
- **Sem analytics third-party** (Google Analytics, Mixpanel, etc.) que processem dados de saúde. Telemetria de uso recolhida internamente em Supabase.
- **Consentimento granular:** o titular pode aceitar recolha de fadiga sem aceitar partilha de relatório PDF (decisão de produto: o staff só pode partilhar PDF com permissão explícita do jogador/responsável).

#### Performance (referência)

Targets de performance específicos estão definidos em *Non-Functional Requirements > Performance* (NFR1–NFR13) como contrato vinculativo. Resumo das exigências de domínio: o Painel de Prontidão e a submissão de questionários têm de ser quase-instantâneos durante janelas de jogo; a sincronização offline tem de drenar em segundos para evitar perda perceptível de UX.

#### Disponibilidade e backup

- **≥ 99% em janelas de jogo e treino** (calendário do clube).
- **Modo offline cobre indisponibilidade transitória** — questionários e registo de eventos funcionam sem rede; sincronização ao restabelecimento.
- **Backups Supabase diários (free tier)** com retenção 1 dia.
- **Backup manual semanal SQL dump para Git privado**, retenção 12 semanas — mitigação da janela de 1 dia do free tier. Automatizado via GitHub Action; encriptado com chave separada do repositório.
- **Heartbeat anti-pause:** GitHub Action a cada 6 dias, alertas em duas falhas consecutivas.

#### Residência de dados

- **Toda a infraestrutura em regiões UE:** Supabase EU (Frankfurt como default; Dublin/Londres/Paris como alternativas), Vercel `fra1`, Resend EU region.
- **Sem transferências internacionais** além das já cobertas por SCCs com sub-processadores.

### Integration Requirements

- **MVP: zero integrações externas obrigatórias para a lógica de negócio.** Decisão deliberada — minimiza superfície de compliance e risco de quebra por third-party.
- **Sub-processadores tecnológicos** (não são "integrações" do ponto de vista funcional, mas sim partes do stack):
  - **Supabase** (Postgres + Auth + Storage + Edge Functions) — DPA UE assinado
  - **Vercel** (hosting da PWA) — DPA UE
  - **Resend** (email transacional para fluxo de consentimento parental, recuperação de password, exportação de dados) — free tier 3.000 emails/mês, EU region — DPA UE
  - **Push services dos browsers** (Apple/Mozilla/Google) — mediados pelo browser, não escolha de produto
- **Calendário externo (Google/Outlook):** *não* importado/exportado no MVP. Backlog de evolução futura.
- **Wearables/GPS:** *não* no MVP. Arquitetura preparada para endpoints API futuros (Vision, 18+ meses).
- **Computer vision/análise de vídeo:** *não* no MVP. Backlog (2–4 anos).

### Risk Mitigations

| Risco de domínio | Probabilidade | Impacto | Mitigação |
| --- | --- | --- | --- |
| Violação de dados de menor (data breach) | Baixa | Muito alto | Encriptação, RLS, MFA staff (Growth), logs de acesso, DPIA, plano de resposta a incidentes documentado |
| Consentimento parental não obtido / forjado | Média (sem fluxo) | Alto | Email tokenizado com IP+timestamp; reminders; bloqueio até confirmação; auditoria periódica |
| Retenção alargada (5 épocas) questionada por titular | Baixa-Média | Médio | Justificação documentada no Art. 30 e DPIA; comunicada no consentimento; apagamento antecipado a pedido |
| Fiscalização CNPD (em aumento 2025+) | Crescente | Alto | Conformidade proativa documentada; DPIA atualizado; registo Art. 30 mantido |
| Atleta a sentir-se pressionado para consentir | Média | Médio (legal: invalida consentimento) | Disclaimer explícito sobre direito de retirada sem prejuízo; staff treinado para não pressionar |
| Adesão baixa → dados insuficientes para análise | Alta | Alto | Push notifications, UX <2min, comunicação do propósito pelo treinador |
| Qualidade dos dados manuais introduzidos pelo analista | Média | Médio | Validação de intervalos; outliers visíveis em dashboard; analista designado por sessão |
| Dependência de free tiers que mudem termos | Baixa-Média | Médio | Heartbeat anti-pause Supabase; código provider-agnostic; plan B documentado (Pro plan, self-host, Netlify, Cloudflare) |
| Perda de dados em sincronização offline | Baixa | Médio-Alto | UUIDv7 client-side, outbox idempotente, badge persistente de pendentes, recuperação antes de logout |
| Pause de Supabase por inatividade (7 dias) | Média se ignorada | Alto | Heartbeat GitHub Action a cada 6 dias com alertas |
| Cap de email Supabase Auth (100/dia) atingido em pico de onboarding | Média | Médio | Resend EU como provider primário (3.000/mês free); Supabase Auth apenas para reset password |

### Domain-Specific Anti-Patterns a Evitar

Erros comuns em produtos de monitorização de atletas que o Project R recusa explicitamente:

- **Push notifications com dados de saúde no payload** — viola Art. 9; payloads são opacos.
- **Auto-classificação clínica** ("este atleta tem risco X de lesão") — o Project R **não diagnostica**, sinaliza tendências e deixa a decisão ao staff humano. Esta é também a postura ética declarada.
- **Acesso lateral entre jogadores** ("o Tomás vê o relatório do Diogo") — RLS estrita a impedir.
- **Compartilhar dados com sponsors, scouts, ou terceiros sem consentimento explícito** — proibido no MVP; qualquer feature deste tipo requer fluxo de consentimento adicional.
- **Reutilizar dados para finalidades não declaradas** ("começámos a usar para X, agora vamos analisar Y") — finalidade fixa pelo registo Art. 30; alteração requer nova base jurídica.

## Innovation & Novel Patterns

O Project R não inova ao nível de tecnologia base — usa stack maduro (PWA, Supabase, Web Push standard). A inovação está em três decisões de produto que contradizem padrões dominantes do mercado.

### Detected Innovation Areas

#### 1. Integração fadiga + performance + prontidão num único produto gratuito

Esta integração **não existe no segmento amador gratuito**, segundo Market Research validada (Spond, Mingle Sport, TeamStats, Wooter, AthleteSR cobrem partes isoladas). Existe em produtos profissionais pagos (Catapult, Metrifit, Hudl), com custo ≥ €500/ano.

**O que é novo:** combinar três pilares de domínios habitualmente separados (gestão de equipa, ciência do desporto, analytics táctico) num produto consumível por staff sem formação especializada.

**Hipótese subjacente:** clubes amadores conseguem absorver complexidade de monitorização de fadiga se a UI esconder a ciência subjacente (semáforo > tabelas).

#### 2. Filosofia "dados mediados" — jogador sem acesso direto ao seu relatório

Esta é a aposta mais contracultura do Project R. Os concorrentes diretos e indiretos do espaço de athlete tracking (Strava, Whoop, Garmin Connect, Apple Fitness, Metrifit) **entregam todos os dados diretamente ao utilizador final**.

O Project R inverte: o jogador preenche o questionário, mas **não vê o seu próprio painel de prontidão nem a sua curva de recuperação**. A informação chega-lhe através do staff técnico em conversa informada.

**O que é novo:** o produto coloca-se como instrumento do staff, não do atleta. A tecnologia melhora a conversa humana, não substitui o feedback humano por feedback algorítmico.

**Hipótese subjacente:** em contexto desportivo amador, o relacionamento treinador-atleta é o canal de feedback mais eficaz; substituí-lo por dashboards diretos enfraquece-o em vez de complementá-lo.

**Tensão a resolver:** alguns atletas podem sentir esta opacidade como paternalista. A mitigação é a transparência sobre a existência dos dados (o jogador sabe o que está a ser recolhido) sem entrega direta dos relatórios processados.

#### 3. ACWR e limiares de fadiga diferenciados por escalão etário (LTAD-aware)

A maioria das implementações de ACWR aplica os mesmos limiares a todas as faixas etárias (zona segura 0,8–1,3; alerta >1,5). A literatura LTAD (Long-Term Athlete Development) e investigação em jovens atletas (MDPI 2022, sub-14 a sub-19) sugere que jogadores em fases de crescimento têm maior vulnerabilidade a sobrecarga e devem ter limiares mais conservadores.

**O que é novo:** automatizar limiares diferenciados por escalão etário a partir do registo do jogador, sem que o staff tenha de configurar nada. Sub-14, sub-15, sub-17, sub-19, seniores cada um com perfil próprio.

**Hipótese subjacente:** o staff amador não tem capacidade técnica para definir limiares por escalão; o produto fá-lo automaticamente com base em evidência científica embutida.

### Market Context & Competitive Landscape

**No segmento gratuito (concorrência direta):** ninguém faz a integração #1; ninguém faz o "dados mediados" #2; ninguém faz limiares por escalão etário #3.

**No segmento pago profissional:** Catapult e Metrifit fazem a integração mas com filosofia oposta (dados diretos ao atleta) e sem diferenciação por escalão. Hudl tem partes mas está focado em vídeo.

**Janela competitiva estimada:** 12–24 meses antes que Spond ou Mingle Sport adicionem módulo de wellness ao plano gratuito (Domain Research: tendência de consolidação de mercado 2026–2027).

### Validation Approach

#### Validação da inovação #1 (integração)

- Métrica de uso ativo dos três pilares dentro do mesmo dashboard (% de sessões em que o staff consulta fadiga + estatísticas + prontidão na mesma sessão de uso)
- Survey qualitativo com os 3 treinadores co-desenvolvedores: "qual seria o seu próximo passo se este produto desaparecesse amanhã?"

#### Validação da inovação #2 (dados mediados)

- KPI primário: adesão de jogadores ≥ 80% por sessão **mesmo sem acesso ao próprio relatório** — se cair abaixo, a hipótese é falsa e a filosofia tem de evoluir
- Survey aos jogadores no fim do mês 2: "sentes que percebes o porquê do treino que recebes?" (Likert 1–5; alvo ≥ 3,5/5 médio)
- Auditoria: pelo menos 1 conversa staff-atleta documentada por mês usando dados do sistema (o "wow moment" reverso — não a decisão de convocatória mas a conversa subsequente)

#### Validação da inovação #3 (ACWR por escalão)

- Comparar incidência de zonas vermelhas em sub-14/sub-15 vs. seniores ao longo da época. Se o sistema dispara alerta vermelho em sub-14 com ACWR=1,3 (zona ainda "segura" para adultos) e isso correlaciona com queixa de fadiga reportada, a diferenciação é justificada.
- Validação científica via consulta a um preparador físico externo (não co-desenvolvedor) com formação em LTAD.

### Risk Mitigation

**Risco da inovação #2 (dados mediados pode falhar):**

- **Sinal de falha:** adesão dos jogadores cai sustentadamente abaixo de 70% após semana 4
- **Plano B:** introduzir um **resumo individual mensal** ao atleta — não o painel completo, mas um digest curado pelo staff (ex: "tens dormido melhor que no mês passado; carga sob controlo"). Mantém a mediação mas reduz a opacidade.
- **Plano C (se Plano B insuficiente):** abrir parcialmente o painel ao jogador com restrição (ex: ver tendência da própria fadiga mas não ACWR ou prontidão). Esta seria a evolução natural fora do MVP.

**Risco da inovação #1 (integração pode ser excessiva para início):**

- **Sinal:** staff usa apenas um dos três pilares (ex: só fadiga, ignora estatísticas). Indica que a complexidade é superior ao retorno percebido.
- **Plano B:** simplificar UI inicial para destaque do Painel de Prontidão como "produto principal", com fadiga e estatísticas como camadas que se descobrem. Já está implícito no design mas pode ser radicalizado.

**Risco da inovação #3 (limiares por escalão sem evidência suficiente):**

- **Sinal:** falsos positivos em escalões jovens criam descrédito do sistema entre staff técnico
- **Plano B:** tornar os limiares configuráveis pelo staff (com defaults LTAD-aware), em vez de hard-coded. Mantém o valor sem rigidez.

### Innovation as Marketing Truth, not Innovation Theater

Estas três áreas são **inovações honestas no contexto do segmento alvo**. O Project R não inventa ACWR, não inventa wellness questionnaires, não inventa PWAs — combina elementos conhecidos de uma forma que ninguém combinou para futebol amador gratuito, e faz uma aposta filosófica deliberada (dados mediados) que diferencia o produto não tecnologicamente, mas eticamente.

A comunicação de marketing deve refletir esta honestidade: "não inventámos a roda, fizemo-la chegar a quem não a tinha".

## Web App Specific Requirements

O Project R é uma Progressive Web App (PWA) com instalação opcional no home screen. Todo o produto vive atrás de autenticação — não há páginas públicas indexáveis.

### Project-Type Overview

- **Tipo:** PWA (web_app) — Single Page Application com hidratação SSR para o shell
- **Framework:** Next.js 16 (App Router) — Webpack mode em dev, Turbopack em prod
- **Linguagem:** TypeScript estrito (`"strict": true`, `"noUncheckedIndexedAccess": true`)
- **Distribuição:** sem App Store, sem Play Store; instalação via "Adicionar ao Ecrã Inicial" do browser
- **Identidade visual:** mobile-first com escalonamento responsivo até 10" (tablet do analista)

### Browser Matrix

Suporte de browser definido com base em duas restrições: Web Push (VAPID) standard e adoção real do mercado-alvo (Portugal, ~75–80% Android).

| Browser | Versão mínima | Justificação | Funcionalidades críticas |
| --- | --- | --- | --- |
| Chrome (Android e desktop) | últimas 2 versões major | mercado dominante, suporte completo a todas as APIs | Push, Service Worker, IndexedDB, Background Sync (bónus) |
| Safari iOS | **16.4+** | requisito para Web Push em iOS (Mar 2023+) | Push (após Add-to-Home-Screen), Service Worker, IndexedDB |
| Safari macOS | últimas 2 versões | analistas que usem portátil para dashboards diferidos | Push, Service Worker, IndexedDB |
| Firefox | últimas 2 versões | minoria mas presença não-negligenciável | Push, Service Worker, IndexedDB |
| Edge | últimas 2 versões | Chromium-based, sem trabalho adicional | tudo |
| Samsung Internet | últimas 2 versões | adoção significativa em Android Portugal | tudo |
| WebView in-app (Facebook, Instagram, WhatsApp) | **não suportado** | Web Push não funciona; Add-to-Home-Screen indisponível | bloqueio com mensagem "abrir no Chrome/Safari" |
| Opera Mini, UC Browser, IE 11 | não suportado | sem Service Worker ou Push | mensagem de browser não compatível |

**Detection e fallback:** página de erro amigável para browsers não suportados, com instruções para abrir o link no browser nativo.

### Responsive Design

Mobile-first absoluto. Desktop e tablet são alvos secundários, mas com cobertura plena.

| Breakpoint | Alvo | Uso típico |
| --- | --- | --- |
| ≤ 360px | iPhone SE / Android compactos | Jogador a preencher questionário |
| 361–414px | iPhone 12–15 / maioria Android | Jogador, treinador (Painel de Prontidão) |
| 415–767px | phablets, iPad Mini portrait | Treinador (Painel) |
| 768–1024px | iPad / tablets 10" | Analista (registo touchscreen 3-ecrãs) |
| ≥ 1025px | desktop e laptop | Analista (dashboard tendências, exportações) |

**Princípios:**

- Layout single-column no mobile, multi-column ≥ 768px
- Touch targets ≥ 44×44px (WCAG 2.5.5)
- Sem hover-only interactions — toda funcionalidade acessível por tap
- Gestos: scroll vertical e tap como primários; swipe horizontal apenas em galerias de fotos (perfil de jogador)
- Orientação: portrait predominante; landscape suportado mas otimizado para o ecrã touchscreen 3-ecrãs (uso em bancada com tablet horizontal)

### Performance Targets (referência)

Métricas testáveis de performance (Core Web Vitals, bundle size, cold start, Lighthouse mínimos CI) estão em *Non-Functional Requirements > Performance* (NFR1–NFR13) como contrato vinculativo.

Esta secção apenas valida que todos os targets são compatíveis com a stack escolhida (Next.js 16 + Serwist + Vercel `fra1` + Supabase EU) — nenhum NFR de performance exige tecnologia adicional ou tier pago.

### SEO Strategy

**N/A — produto integralmente autenticado.** O Project R não tem páginas públicas indexáveis. Não há lista de jogadores, leaderboards ou perfis públicos.

- **`robots.txt`:** `User-agent: * \n Disallow: /`
- **Meta tags:** `noindex, nofollow` em todas as rotas
- **Sem sitemap.xml**
- **Página de marketing/landing:** **fora do scope MVP**. Quando existir (post-MVP), terá SEO próprio em domínio separado ou subpath público — nunca misturado com o produto autenticado.

### Accessibility Level

**Nível alvo: WCAG 2.1 AA pragmático.** Solo developer + 4 semanas + co-desenvolvimento com treinadores não permite WCAG 2.2 AAA. AA é o mínimo defensável para um produto que processa dados de saúde de menores.

**Critérios cumpridos no MVP:**

- **Contraste de texto:** ≥ 4,5:1 (texto normal), ≥ 3:1 (texto grande). Tokens de design validados com ferramenta automatizada (axe-core no CI).
- **Navegação por teclado:** todos os fluxos críticos (login, questionário, painel) navegáveis sem mouse. Focus rings visíveis.
- **Screen readers:** rótulos ARIA em todos os controlos interativos, roles semânticos, headings hierárquicos.
- **Linguagem clara:** nível B1 do CEFR como teto para textos do utilizador. Tooltips e help-text para terminologia técnica (ACWR explicado em hover).
- **Versão adaptada para menores 13–15:** linguagem simplificada na política de privacidade, no questionário, e nos prompts (validar com sub-14 antes de release).
- **Tamanho de toque:** ≥ 44×44px em todos os botões e controlos interativos.
- **Movimento e animação:** respeitar `prefers-reduced-motion`.
- **Imagens:** sempre com `alt` text. Fotos de jogadores com alt = nome do jogador.

**Não cobertos no MVP (backlog explícito):**

- Suporte avançado a leitores de braille
- Áudio descritivo
- Tradução para outras línguas (PT-PT only no MVP)
- Modo de alto contraste alternativo (apenas o sistema operativo é honrado)

### Real-Time Architecture

Real-time é **utilizado parcimoniosamente** para preservar headroom no Supabase free tier (200 conexões concorrentes em pico).

**Onde usamos Supabase Realtime:**

- **Painel de Prontidão (treinador):** subscrição ao canal `team_readiness:{team_id}` — push de updates quando um questionário pós-sessão é submetido durante a janela de 4h pré-jogo
- **Dashboard de tendências (analista):** subscrição opcional, ativada apenas durante a sessão pós-jogo para ver dados a chegar

**Onde NÃO usamos Realtime:**

- Listas de jogadores, calendário, perfis: usar polling on-demand com TanStack Query e cache stale-while-revalidate
- Estatísticas pós-jogo: batch upload via outbox; staff vê com refresh manual
- Notificações de consentimento parental: email + página de status, não Realtime

**Tratamento de reconexão:**

- Realtime não faz backfill de eventos perdidos — sempre fazer refetch on reconnect
- Subscription cleanup explícito em `unmount` para evitar fugas de conexão

### Implementation Considerations

#### Stack tecnológica final (consolidado)

- **Frontend:** Next.js 16 (App Router) + TypeScript estrito + TailwindCSS para estilo
- **State management:** TanStack Query (server state) + Zustand (UI state); sem Redux
- **Service Worker:** Serwist (`@serwist/next`) — precache do shell, StaleWhileRevalidate para GETs Supabase read-only
- **Local DB:** Dexie.js sobre IndexedDB — 2 stores: `outbox` (writes pendentes) + `cache` (reads)
- **Persistence layer:** TanStack Query com `persistQueryClient` + persister IDB
- **Auth client:** `@supabase/supabase-js` com `localStorage` + `autoRefreshToken: true`
- **IDs:** UUIDv7 client-generated para todos os writes (sortable, conflict-free)
- **Forms:** React Hook Form + Zod para validação (esquema partilhado client/server)
- **Datas:** `date-fns` com locale `pt-PT`
- **Charts:** `recharts` (~30 KB gzip) — dashboard de tendências e curva de recuperação

#### Estrutura de rotas (App Router)

```text
/                      → redirect para /login ou /home conforme sessão
/login                 → autenticação
/consent/[token]       → fluxo de consentimento parental (público com token)
/(player)              → grupo: jogador
  /home
  /survey/[sessionId]  → questionário pré/pós-sessão
/(staff)               → grupo: treinador + analista
  /readiness           → Painel de Prontidão
  /players/[id]        → perfil do jogador
  /sessions            → calendário e gestão de sessões
  /sessions/[id]       → detalhe de sessão (registo de stats, sRPE)
  /trends              → dashboard de tendências (analista)
  /settings            → admin: épocas, jogadores, configurações de notificação
/api                   → server actions e route handlers (Supabase JWT validation)
```

#### Trade-offs assumidos

- **Turbopack só em produção:** Serwist não é compatível com Turbopack (Next.js 16 default). Em dev usa-se Webpack mode (`next dev --webpack`) — perda de DX aceitável face ao tempo de debug que Turbopack pouparia em SW dev.
- **Sem ISR no MVP:** todo conteúdo é dinâmico atrás de auth. ISR seria desperdício e introduz custos Vercel.
- **Sem Edge runtime para route handlers:** Supabase JS client tem casos conhecidos de fricção em Edge; usar Node runtime para todas as APIs.

#### iOS-specific implementation notes

- **Add-to-Home-Screen como gating de funcionalidades:** push notifications e durabilidade de IndexedDB requerem instalação. Onboarding iOS dedicado com instruções animadas.
- **Sem Background Sync:** drain da outbox por foreground (`online` event + `visibilitychange:visible` + botão manual). UX de "1 pendente" persistente até confirmação.
- **IndexedDB defensivo:** retries transacionais, nunca confiar num write até ack; eviction após 7 dias só ocorre se PWA não está instalada.
- **Permissão de push após gesto explícito** (não no page load) — requisito iOS Safari.

## Project Scoping & Phased Development

Esta secção complementa a secção *Product Scope* (lista de funcionalidades por fase) com a camada estratégica: filosofia de MVP, perfil de recursos, e alinhamento explícito entre riscos e mitigações por fase.

### MVP Strategy & Philosophy

**Abordagem MVP escolhida: Problem-Solving MVP + Experience MVP combinados.**

Não é um MVP "lean canvas com landing page" nem "concierge MVP" — o produto resolve um problema real com a experiência completa, mas em volume reduzido (1 clube, 40 jogadores). A justificação:

- **Problem-Solving:** o staff técnico precisa de um sistema funcional desde o dia 1 — não pode haver "fingir que existe" porque a recolha de fadiga e estatísticas tem de ocorrer durante uma época real, e a janela de validação é a próxima época competitiva.
- **Experience:** o "wow moment" (Journey 2 — decisão contradita pela intuição) só acontece com fadiga, prontidão e estatísticas integradas. Tirar qualquer um dos pilares mata o diferenciador.
- **Não é Platform MVP:** multi-tenancy fica preparada (RLS) mas o MVP corre 1 clube. Multi-clube é Growth.
- **Não é Revenue MVP:** custo zero é restrição inflexível; sem monetização no MVP.

**Critério de validação primário:** o "wow moment" acontecer pelo menos 1 vez documentada na primeira época. Se acontecer, o produto resolve o que prometeu.

**Tempo até validar:** 1 mês para deploy ao plantel-piloto + 2–3 meses de uso continuado para que padrões de fadiga emerjam = ~4 meses até o primeiro veredito honesto.

### Resource Requirements

| Recurso | MVP (Fase 1, 4 semanas) | Growth (Fase 2, meses 2–6) | Vision (Fase 3, 18+ meses) |
| --- | --- | --- | --- |
| Developers | 1 solo (Antero) | 1–2 (mantém solo + colab pontual) | 2–3 + skills wearables/CV |
| Product/PM | partilhado com developer | mantém | dedicado a partir de multi-clube |
| Co-desenvolvedores (validadores) | 3 treinadores (revisões semanais) | mantém + 3 treinadores externos para validação (KPI) | rede expandida |
| Skills críticos no MVP | TypeScript estrito · Next.js 16 App Router · Supabase (Postgres + Auth + RLS + Edge Functions) · Service Worker (Serwist) · IndexedDB (Dexie) · Web Push VAPID · GDPR Art. 9 + DPIA | adiciona analytics (recharts), PDF gen (jsPDF), multi-tenant testing | adiciona ML/AI · GPS/wearables APIs · computer vision · expansão internacional |
| Tempo de desenvolvimento | 160h efetivas (4 sem × 40h, mas realista é 100–120h líquidas) | ~400h cumulativas | sem estimativa fechada |
| Infraestrutura | €0/mês (estrito) | €0/mês até 3 clubes; ≥ 4 clubes dispara revisão | depende de modelo de monetização |

**Dívida técnica aceite no MVP:**

- Sem CI/CD avançado (apenas Vercel auto-deploy + GitHub Actions para heartbeat e backup)
- Sem observabilidade dedicada (logs Vercel + Supabase + telemetria interna em Postgres)
- Sem feature flags (deploys diretos para piloto único)
- Sem testes E2E browser automation no MVP — só unit + integration; E2E entra em Growth
- Sem internacionalização — PT-PT hardcoded

### MVP Feature Set (Phase 1) — Consolidação

A lista detalhada está em *Product Scope > MVP*. Os pilares estratégicos do MVP são:

1. **Onboarding com consentimento parental verificável** — gating compliance: nada se inicia sem isto
2. **Recolha de fadiga (5 dimensões pré + pós) com push notifications e modo offline** — base de todos os dados
3. **Registo de estatísticas via interface touchscreen 3-ecrãs** — validação científica (7 KPIs preditivos)
4. **Painel de Prontidão com semáforo e drill-down** — o produto que o treinador toca todos os sábados
5. **3 dashboards** (estado plantel, tendências individuais 4 sem, carga acumulada época) — atende treinador, analista, preparador físico
6. **Cálculo automático ACWR + sRPE com limiares por escalão etário** — inovação #3 embedded
7. **Endpoints GDPR completos** (acesso, retificação, apagamento, portabilidade, oposição, limitação)

**Cada pilar tem um KPI direto em *Success Criteria > Measurable Outcomes* — sem feature órfã.**

### Post-MVP Features (Phase 2: meses 2–6)

Detalhado em *Product Scope > Growth Features*. Estrategicamente, esta fase entrega:

- **Motor analítico visível** — Correlação Fadiga × Performance + Curva de Recuperação Individual emergem com 4–6 semanas de dados acumulados
- **Perfil unificado do jogador** — vista consolidada que o staff usa para conversas individuais
- **Exportação PDF mediada pelo staff** — operacionalização da filosofia "dados mediados"
- **Dashboard de equipa agregado** — leitura coletiva, não apenas individual
- **Multi-equipa dentro do mesmo clube** — preparação para o Horizonte 1 do Brief
- **Análise de Adversários (módulo opcional)** — fora do core, separado

### Vision (Phase 3: 18+ meses)

Detalhado em *Product Scope > Vision*. Pontos estratégicos:

- Multi-clube com benchmarking → questão arquitetónica (RLS já prepara, mas dispara revisão de tier Supabase)
- API aberta para wearables/GPS → exige design de contrato API + DPIA atualizado
- Computer vision smartphone → depende de maturação tecnológica externa (estimativa 2–4 anos)
- Modelos preditivos AI → requer ≥ 1–2 épocas de dados acumulados como pré-requisito
- Expansão a mercados de língua portuguesa → questão de produto + go-to-market, não técnica
- Objetivos e metas individuais por jogador com tracking de progresso → coaching tooling acrescentando à filosofia "dados mediados" (targets definidos pelo staff, partilhados em conversa)

### Risk Mitigation Strategy

#### Riscos técnicos

| Risco | Quando se materializa | Mitigação primária | Plano B |
| --- | --- | --- | --- |
| iOS install rate baixo bloqueia push e durabilidade de dados | Mês 2 (KPI: ≥40%) | Onboarding iOS dedicado com instruções animadas | Capacitor wrap (sprint extra Fase 2) |
| Pause de Supabase free tier por inatividade | Qualquer paragem de 7 dias | Heartbeat GitHub Action a cada 6 dias | Restore manual + monitorização ativa |
| Limite de Realtime concorrente (200) atingido | Multi-clube em pico de matchday simultâneo | Realtime *parcimonioso*; polling on-demand para listagens | Pro plan ($25/mês) ou self-host |
| Cap email Supabase Auth (100/dia) bloqueia onboarding | Pico de consentimentos parentais no início de época | Resend EU como provider primário (3.000/mês free) | Pro plan Resend ou Postmark/SES |
| Fricção offline em iOS sem Background Sync | Dia 1 de uso pós-treino | UX persistente de "X pendente" + drain por foreground | Botão manual "Sincronizar agora" sempre visível |

#### Riscos de mercado

| Risco | Sinal de materialização | Mitigação primária | Plano B |
| --- | --- | --- | --- |
| Spond/Mingle Sport lançam wellness gratuito | Anúncio público durante 12–24 meses | Lançamento rápido para fechar adesão antes da concorrência | Acelerar Phase 2 (motor analítico como diferenciador profundo) |
| Filosofia "dados mediados" rejeitada por jogadores | Adesão <70% após semana 4 | Comunicação forte do propósito pelo treinador | Plano B/C de Innovation #2 (digest mensal curado / abertura parcial) |
| Validação por 3 treinadores externos não materializa | Rede pessoal insuficiente | Outreach proativo a clubes da liga distrital | Aceitar validação parcial e iterar |
| Adesão dos jogadores cai por fricção UX | Tempo médio >2 min ou taxa <80% | Push notifications no timing certo + UX <2 min | Iterar UX com co-desenvolvedores antes de release público |

#### Riscos de recursos

| Risco | Sinal de materialização | Mitigação primária | Plano B |
| --- | --- | --- | --- |
| Solo dev burnout durante MVP de 4 semanas | Atraso >1 semana na fase atual | Scope MVP é mínimo absoluto; Growth features ficam fora | Reduzir MVP ao "mínimo do mínimo" — apenas Painel + Fadiga |
| Pressão para incluir features Growth no MVP | Pedidos do staff durante desenvolvimento | Backlog visível com promessas Phase 2 datadas | "Não" disciplinado; Phase 2 começa antes (mês 5) se necessário |
| Co-desenvolvedores deixam de validar | 2 reviews semanais consecutivas falhadas | Engagement explícito no início de cada sprint | Continuar com 1–2 validadores; não bloquear |
| Compliance GDPR atrasa lançamento por DPIA não concluída | Semana 3 sem DPIA | DPIA começa em paralelo com desenvolvimento desde semana 1 | Lançamento privado a co-desenvolvedores apenas (sem dados de menores externos) até DPIA pronta |

#### Princípios de scope inflexíveis

Estas decisões não estão sujeitas a negociação durante a execução do MVP:

1. **Custo €0/mês estrito** — qualquer custo emergente dispara revisão de arquitetura, não orçamento
2. **Consentimento parental verificável obrigatório antes de qualquer recolha de menor** — sem exceções
3. **Filosofia "dados mediados" mantém-se no MVP** — ainda que adesão fique no limiar; só o Plano B/C ativa-se com sinal claro de falha (<70% adesão sustentada)
4. **Stack zero-cost (PWA + Supabase + Vercel + Web Push VAPID)** — substituições só se um componente sair do free tier

### Phasing Confirmation

A entrega faseada (MVP / Growth / Vision) é **importada do Brief original** e do *Product Scope* deste PRD — não foi inventada nesta etapa. Os horizontes são:

- **Fase 1 (MVP):** 4 semanas de desenvolvimento + ~3 meses de uso para validação
- **Fase 2 (Growth):** meses 2–6 após release MVP, em paralelo com a primeira época em produção
- **Fase 3 (Vision):** 18+ meses, dependente de validação Fase 2 e decisões de monetização/expansão

Cada fase tem KPIs de saída próprios definidos em *Success Criteria > Measurable Outcomes* — só se passa de fase quando os KPIs da anterior estiverem cumpridos.

## Functional Requirements

Esta secção define o **contrato de capacidades** do Project R. Cada FR é uma capacidade testável e independente de tecnologia. Funcionalidades não listadas aqui não existem no produto.

Os FRs estão agrupados em 8 áreas de capacidade. Os atores referidos são os definidos em *User Journeys*: **Treinador**, **Analista** (incluindo preparador físico), **Jogador**, **Encarregado de Educação**, e **Sistema** (capacidades automáticas).

Notação adicional: `[MVP]` indica funcionalidade da Fase 1; `[Growth]` indica Fase 2 (incluída neste contrato porque está dentro do horizonte de 6 meses planeado).

### Identity, Access & Consent Management

- **FR1:** Treinador, Analista e Jogador podem autenticar-se com email + password e recuperar password via email. [MVP]
- **FR2:** Sistema atribui um e apenas um papel (Treinador, Analista, Jogador) a cada conta autenticada. [MVP]
- **FR3:** Sistema enforça permissões por papel: Jogador acede apenas aos seus próprios questionários e dados pessoais; Analista e Treinador acedem a todos os dados do plantel; nenhum papel acede a dados de outros clubes (preparação multi-tenant). [MVP]
- **FR4:** Sistema bloqueia acesso de jogador menor (13–15 anos) até confirmação parental verificável. [MVP]
- **FR5:** Encarregado de Educação pode confirmar consentimento parental através de link tokenizado recebido por email, sem necessidade de criar conta no sistema. [MVP]
- **FR6:** Sistema regista cada confirmação de consentimento com timestamp, IP de origem e versão da política aceite. [MVP]
- **FR7:** Sistema reenvia automaticamente o pedido de consentimento parental ao 7º e 14º dia se não recebido, e notifica o staff técnico após 14 dias sem resposta. [MVP]
- **FR8:** Encarregado de Educação pode retirar consentimento, solicitar exportação ou solicitar apagamento dos dados do menor a qualquer momento, através de endpoint dedicado. [MVP]
- **FR9:** Jogador adulto (16+) pode retirar o seu próprio consentimento, exportar ou apagar dados sem mediação. [MVP]
- **FR10:** Sistema notifica o titular ao atingir os 18 anos para reconfirmar consentimento próprio; sem reconfirmação em 90 dias, sistema anonimiza automaticamente os dados. [Growth]
- **FR11:** Sistema activa MFA opcional para Treinador e Analista no MVP, com possibilidade de tornar obrigatório por configuração. [MVP, escalonamento Growth]

### Player & Squad Management

- **FR12:** Analista pode criar, editar e arquivar registos de jogadores com nome, idade, número de camisola, foto, escalão etário, posição principal e até 4 posições alternativas. [MVP]
- **FR13:** Analista pode registar múltiplas leituras de peso e altura por jogador ao longo do tempo, formando série temporal consultável. [MVP]
- **FR14:** Treinador e Analista podem consultar o perfil consolidado de qualquer jogador, com séries temporais de fadiga, peso, altura, ACWR, presenças e estatísticas. [Growth — perfil unificado completo]
- **FR15:** Analista pode marcar jogadores como inativos sem apagar histórico (ex: lesão prolongada, saída temporária). [MVP]
- **FR16:** Sistema preserva histórico de jogadores que saem do clube durante a permanência + 5 épocas, após o que anonimiza dados pessoais e biométricos automaticamente. [MVP — política; Growth — automatização completa]

### Calendar & Session Management

- **FR17:** Treinador pode criar, editar e cancelar sessões de treino e jogos, com data, hora de início e tipo (treino, jogo, jogo amigável). [MVP]
- **FR18:** Treinador pode definir convocados e equipa inicial para cada jogo. [MVP]
- **FR19:** Analista pode registar substituições durante o jogo, e sistema deriva automaticamente os minutos jogados por cada jogador. [MVP]
- **FR20:** Treinador e Analista podem criar e gerir épocas com data de início e fim, e visualizar dados filtrados por época ou cumulativos. [MVP]

### Fatigue & Wellness Tracking

- **FR21:** Jogador responde a um questionário de fadiga com 5 dimensões (energia muscular, concentração/motivação, qualidade do sono, desconforto músculo-articular, estado emocional) antes e depois de cada sessão. [MVP]
- **FR22:** Sistema apresenta versão linguisticamente adaptada do questionário aos jogadores do escalão sub-14. [MVP]
- **FR23:** Jogador pode submeter o questionário em modo offline; sistema sincroniza automaticamente quando recupera conectividade. [MVP]
- **FR24:** Sistema mostra ao Jogador a contagem de submissões pendentes de sincronização e permite forçar sincronização manualmente. [MVP]
- **FR25:** Treinador e Analista podem consultar respostas individuais e tendências históricas de fadiga por jogador, sem mediação adicional. [MVP]
- **FR26:** Jogador **não** pode aceder ao seu próprio Painel de Prontidão, à sua Curva de Recuperação Individual, ou aos seus relatórios processados — estes são entregues exclusivamente através do staff técnico. [MVP — decisão deliberada de produto]

### Performance Recording

- **FR27:** Analista pode registar eventos estatísticos durante o jogo via interface touchscreen com 3 ecrãs sequenciais (jogador → ação → zona do campo) cobrindo as 7 métricas: perdas de bola, recuperação de bola, remates totais, remates enquadrados, passes completados, pressões defensivas, ações defensivas com sucesso, ações ofensivas com sucesso. [MVP]
- **FR28:** Analista pode registar eventos estatísticos em modo offline; sistema sincroniza automaticamente quando recupera conectividade, sem perda de dados. [MVP]
- **FR29:** Analista pode editar ou apagar eventos registados por engano dentro de uma janela configurável após o fim da sessão. [MVP]
- **FR30:** Analista pode registar a presença e ausência de jogadores em sessões de treino. [MVP]
- **FR31:** Analista pode registar Session-RPE (escala 1–10 × duração em minutos) para cada jogador no fim de cada sessão. [MVP]

### Readiness Intelligence

- **FR32:** Sistema calcula automaticamente o ACWR (rácio carga aguda 7d / carga crónica 28d) por jogador, aplicando limiares diferenciados consoante o escalão etário (sub-14, sub-15, sub-17, sub-19, seniores). [MVP]
- **FR33:** Sistema calcula automaticamente o sRPE (Session-RPE × duração) por sessão e mantém histórico cumulativo. [MVP]
- **FR34:** Treinador pode consultar o Painel de Prontidão com semáforo verde/amarelo/vermelho por jogador, derivado da combinação de fadiga recente, ACWR e assiduidade. [MVP]
- **FR35:** Treinador pode fazer drill-down a partir do Painel de Prontidão para ver detalhe individual com séries temporais de fadiga e ACWR das últimas 4 semanas. [MVP]
- **FR36:** Sistema atualiza o Painel de Prontidão em tempo real durante a janela de 4 horas anterior a uma sessão agendada, refletindo novas submissões de questionário. [MVP]
- **FR37:** Analista pode consultar dashboard de tendências individuais de fadiga das últimas 4 semanas com vista por jogador. [MVP]
- **FR38:** Analista pode consultar dashboard de carga acumulada por jogador na época atual. [MVP]
- **FR39:** Sistema deteta e visualiza correlações individuais entre estados de fadiga e desempenho estatístico de cada jogador. [Growth]
- **FR40:** Sistema gera Curva de Recuperação Individual mostrando trajectória de fadiga nos dias após sessão intensa, gerando perfil de recuperação por atleta. [Growth]
- **FR41:** Treinador pode consultar Dashboard de Equipa Agregado com métricas coletivas (média de fadiga, taxa de presença, estatísticas agregadas). [Growth]

### Notifications & Reminders

- **FR42:** Sistema envia push notification ao Jogador X minutos antes e Y minutos depois de cada sessão, lembrando-o de preencher o questionário. Os tempos X e Y são configuráveis pelo staff. [MVP]
- **FR43:** Sistema envia notificações com payload opaco (texto genérico, sem dados de saúde) e deep link autenticado para o questionário. [MVP]
- **FR44:** Jogador pode subscrever ou cancelar push notifications a qualquer momento; cancelamento não bloqueia acesso ao sistema. [MVP]
- **FR45:** Sistema envia email transacional ao Encarregado de Educação para fluxo de consentimento parental, e ao titular para confirmações de exportação ou apagamento. [MVP]

### Compliance, Audit & Data Rights

- **FR46:** Titular (ou Encarregado de Educação para menores) pode solicitar exportação dos seus dados em formato CSV estruturado, abrangendo todos os dados pessoais e biométricos. [MVP]
- **FR47:** Titular (ou Encarregado de Educação) pode solicitar apagamento dos seus dados; sistema executa em cascata para todos os dados relacionados, dentro de 30 dias. [MVP]
- **FR48:** Titular pode solicitar retificação de dados pessoais; staff regista a alteração com log auditável. [MVP]
- **FR49:** Titular pode marcar a sua conta como "tratamento limitado" — sistema congela operações de leitura/escrita sem apagar histórico. [MVP]
- **FR50:** Sistema regista log auditável de cada acesso a dados de saúde por staff, incluindo quem acedeu, a que dados, quando. Logs retidos por 12 meses. [MVP]
- **FR51:** Titular pode consultar quem acedeu aos seus dados de saúde nos últimos 12 meses. [MVP]
- **FR52:** Treinador e Analista podem documentar uma "decisão data-driven" no perfil do jogador — campo de nota livre + flag boolean — quando os dados informaram uma decisão de convocatória ou gestão. [MVP — KPI de validação do "wow moment"]
- **FR53:** Sistema apresenta versão linguisticamente adaptada da política de privacidade aos titulares com 13–15 anos. [MVP]
- **FR54:** Sistema mantém versão histórica de cada política de privacidade aceite, ligada ao registo de consentimento de cada titular. [MVP]

### System Operations & Resilience

- **FR55:** Sistema mantém heartbeat externo automático para impedir pausa por inatividade da base de dados. [MVP]
- **FR56:** Sistema gera backup completo da base de dados de forma automatizada com periodicidade semanal, retido por 12 semanas. [MVP]
- **FR57:** Sistema apresenta página de erro amigável para browsers não suportados, com instruções para abrir em browser compatível. [MVP]
- **FR58:** Sistema bloqueia uso em WebView in-app (Facebook, Instagram, WhatsApp) com mensagem para abrir no browser nativo. [MVP]
- **FR59:** Treinador e Analista podem gerar e partilhar relatórios PDF individuais com dados de performance e fadiga de um jogador específico. A partilha é mediada pelo staff (decisão sobre quando e o quê partilhar); o Jogador não tem acesso direto à geração nem ao histórico de relatórios partilhados. [Growth — operacionalização da filosofia "dados mediados"]

### Capability Contract — Coverage Verification

Esta tabela verifica que cada elemento das secções anteriores tem pelo menos um FR correspondente:

| Origem | FRs que a cobrem |
| --- | --- |
| Executive Summary — 5 dimensões fadiga | FR21, FR22, FR23 |
| Executive Summary — 7 métricas estatísticas | FR27 |
| Executive Summary — Painel de Prontidão | FR34, FR35, FR36 |
| Executive Summary — staff vê, jogador não | FR3, FR26 |
| Success Criteria — adesão ≥80% | FR21, FR23 (suporte offline), FR42 (reminders) |
| Success Criteria — wow moment auditável | FR52 |
| Success Criteria — direitos GDPR | FR46–FR51 |
| Journey 1 — Painel + drill-down em <30s | FR34, FR35 |
| Journey 2 — wow moment + nota livre | FR52, FR25 |
| Journey 3 — touchscreen 3-ecrãs + offline | FR27, FR28, FR29 |
| Journey 3 — minutos auto-derivados | FR19 |
| Journey 4 — questionário offline + sincronização | FR23, FR24 |
| Journey 5 — consentimento parental tokenizado | FR4–FR8 |
| Domain — base jurídica + retenção 5 épocas | FR16, FR54 |
| Domain — direitos titulares | FR46–FR51 |
| Domain — payload push opaco | FR43 |
| Domain — logs de acesso | FR50, FR51 |
| Innovation #1 — integração 3 pilares | FR21, FR27, FR34 |
| Innovation #2 — dados mediados | FR3, FR26 |
| Innovation #3 — ACWR por escalão | FR32 |
| Project Type — browsers + WebView block | FR57, FR58 |
| Project Type — Realtime parcimonioso | FR36 |
| Scoping — heartbeat + backup | FR55, FR56 |
| Brainstorming #12 — PDF export mediado | FR59 |

**Cada capacidade discutida nas secções anteriores está coberta. Capacidades não listadas neste contrato não serão construídas.**

## Non-Functional Requirements

Os NFRs especificam **quão bem** o sistema deve operar. Cada NFR é testável e tem origem clara em *Success Criteria*, *Domain Requirements* ou *Web App Specific Requirements*. Os números deste contrato consolidam os que apareciam dispersos.

### Performance

- **NFR1:** Painel de Prontidão carrega em ≤ 2 segundos (P95) para 40 jogadores, incluindo agregações ACWR/sRPE.
- **NFR2:** Submissão de questionário de fadiga completa em ≤ 500 ms (P95) em conexão online normal.
- **NFR3:** Drain completo da outbox offline em ≤ 5 segundos para até 50 eventos pendentes em conexão 4G.
- **NFR4:** Dashboard de tendências 4 semanas — primeiro paint ≤ 1 s; dados completos ≤ 3 s (P95).
- **NFR5:** Recálculo de ACWR para grupo de 18 convocados em ≤ 3 segundos após registo de sessão.
- **NFR6:** Time to Interactive (TTI) ≤ 3 s em 4G normal mobile.
- **NFR7:** First Contentful Paint (FCP) ≤ 1,5 s em 4G normal.
- **NFR8:** Largest Contentful Paint (LCP) ≤ 2,5 s.
- **NFR9:** Cumulative Layout Shift (CLS) ≤ 0,1.
- **NFR10:** Total Blocking Time (TBT) ≤ 200 ms.
- **NFR11:** Bundle inicial ≤ 200 KB gzipped (shell PWA + auth).
- **NFR12:** Cold start em modo offline (PWA instalada) ≤ 2 s.
- **NFR13:** Lighthouse mínimo em CI: Performance ≥ 85, Accessibility ≥ 90, Best Practices ≥ 95, PWA ≥ 100.

### Security

- **NFR14:** Toda comunicação cliente-servidor usa TLS 1.3 ou superior.
- **NFR15:** Todos os dados em repouso são encriptados (Postgres at-rest encryption por defeito do Supabase).
- **NFR16:** Row-Level Security (RLS) está ativada em todas as tabelas com dados pessoais ou de saúde.
- **NFR17:** Sessões de autenticação expiram após 1 hora de inatividade (access token); refresh token expira após 30 dias.
- **NFR18:** Logout é forçado após mudança de password; tokens anteriores são invalidados.
- **NFR19:** MFA está disponível para Treinador e Analista no MVP, e torna-se obrigatório a partir da Growth phase (≥ 4 clubes em multi-tenancy).
- **NFR20:** Logs de acesso a dados de saúde retêm-se por 12 meses, auditáveis pelo titular.
- **NFR21:** Payloads de push notifications nunca contêm dados de Art. 9 RGPD; conteúdo é texto opaco com deep link autenticado.
- **NFR22:** Sistema não usa analytics third-party (Google Analytics, Mixpanel, etc.) que processem dados pessoais.
- **NFR23:** UUIDs são usados como chaves primárias em todas as entidades; nomes apenas em camadas de UI autenticadas.
- **NFR24:** Recolha de dados de saúde requer base jurídica documentada (RGPD Art. 9(2)(a)) e DPIA assinada antes do release ao plantel-piloto.
- **NFR25:** Dados de jogadores 13–15 anos exigem consentimento parental verificável (token, IP, timestamp, versão da política aceite) antes de qualquer recolha.
- **NFR26:** Direito ao apagamento (RGPD Art. 17) é processado em ≤ 30 dias após pedido, com cascata para dados relacionados.
- **NFR27:** Direito de acesso (Art. 15) e portabilidade (Art. 20) são processados em ≤ 30 dias, em formato CSV estruturado.
- **NFR28:** Direito de retificação (Art. 16) é processado em ≤ 7 dias, com log auditável.
- **NFR29:** Direito de oposição/retirada de consentimento (Art. 21) é processado de forma imediata, com efeito no momento.
- **NFR30:** Toda a infraestrutura de processamento e armazenamento reside em regiões UE (Supabase EU, Vercel `fra1`, Resend EU).

### Scalability

- **NFR31:** Sistema suporta 1 clube com 40 jogadores + 5 staff no MVP, com 100% de funcionalidades.
- **NFR32:** Arquitetura suporta adição de até 3 clubes em multi-tenancy partilhada (mesmo projeto Supabase) sem alteração de código, mantendo-se dentro do free tier (DB ≤ 500 MB; Realtime ≤ 200 conexões em pico).
- **NFR33:** Sistema dispara revisão automática de tier (Pro plan ou self-host) ao atingir 4 clubes ativos ou 80% de qualquer limite gratuito do Supabase.
- **NFR34:** Operações concorrentes em pico de matchday (até 50 conexões Realtime simultâneas no plantel-piloto) não degradam performance abaixo dos targets de Performance.
- **NFR35:** Volume de dados projetado por clube (40 jogadores × 2 questionários/sessão × 150 sessões/época × 5 épocas retidas + estatísticas) deve manter-se ≤ 100 MB por clube; sistema arquiva automaticamente épocas com >5 anos para tabelas comprimidas.

### Accessibility

- **NFR36:** Sistema cumpre WCAG 2.1 nível AA pragmático em todos os fluxos críticos (login, questionário, painel, consentimento parental).
- **NFR37:** Contraste de texto ≥ 4,5:1 (texto normal); ≥ 3:1 (texto grande). Validado por axe-core no CI.
- **NFR38:** Todos os fluxos críticos são navegáveis por teclado, com focus rings visíveis.
- **NFR39:** Todos os controlos interativos têm rótulos ARIA, roles semânticos e headings hierárquicos.
- **NFR40:** Todos os botões e controlos interativos têm tamanho de toque ≥ 44 × 44 px.
- **NFR41:** Sistema respeita `prefers-reduced-motion` do utilizador para todas as animações.
- **NFR42:** Linguagem de UI usa nível CEFR ≤ B1 como teto; tooltips/help-text para terminologia técnica (ex: ACWR).
- **NFR43:** Versão linguisticamente adaptada existe para política de privacidade, questionário e prompts dirigidos a menores 13–15 anos.
- **NFR44:** Imagens têm sempre `alt` text; fotos de jogadores usam o nome do jogador como alt.

### Reliability & Availability

- **NFR45:** Disponibilidade ≥ 99% em janelas de jogo e treino (dias e horas com sessões agendadas).
- **NFR46:** Modo offline cobre indisponibilidade transitória — questionários e registo de eventos funcionam sem rede; sincronização garantida no restabelecimento.
- **NFR47:** Toda submissão de questionário ou evento estatístico em modo offline chega ao servidor após reconexão em ≤ 24 h.
- **NFR48:** Sistema não permite submissões duplicadas — UUIDv7 client-generated + upsert idempotente garantem integridade.
- **NFR49:** Sistema mantém heartbeat externo automático com periodicidade ≤ 6 dias para impedir pausa por inatividade da base de dados.
- **NFR50:** Sistema dispara alerta após 2 falhas consecutivas do heartbeat.
- **NFR51:** Backups completos da base de dados são gerados automaticamente com periodicidade semanal e retidos por 12 semanas.
- **NFR52:** Sistema suporta perda de telemóvel do utilizador sem perda de dados — outbox órfã é detetada e o utilizador é avisado antes de logout para drain manual.

### Integration

- **NFR53:** Sistema não tem integrações externas obrigatórias para a lógica de negócio no MVP. Sub-processadores tecnológicos (Supabase, Vercel, Resend, push services dos browsers) são parte do stack, não integrações funcionais.

### Maintainability & Observability

- **NFR54:** Cobertura de testes automatizados ≥ 80% nas funções críticas de cálculo (ACWR, sRPE, Painel de Prontidão) e nas mutations da outbox de sincronização.
- **NFR55:** Código TypeScript estrito (`"strict": true`, `"noUncheckedIndexedAccess": true`) — sem `any` exceto em fronteiras explicitamente documentadas.
- **NFR56:** Logs estruturados (JSON) para todos os eventos críticos: autenticação, mutations de saúde, exportações, apagamentos, falhas de sincronização.
- **NFR57:** Sistema mantém telemetria interna (em Postgres) dos KPIs de produto: taxa de preenchimento, tempo médio, uso de Painel pré-sessão, decisões data-driven marcadas, install rate por plataforma.
- **NFR58:** Código mantém-se provider-agnostic em fronteiras críticas — zero imports `@vercel/*` para além de `next/*`, para preservar opção de migração para Netlify/Cloudflare/Oracle Cloud sem reescrita.

### Browser & Platform Compatibility

- **NFR59:** Sistema funciona em Chrome (últimas 2 versões), Safari iOS 16.4+, Safari macOS (últimas 2 versões), Firefox (últimas 2 versões), Edge (últimas 2 versões), Samsung Internet (últimas 2 versões).
- **NFR60:** Sistema bloqueia uso em WebView in-app (Facebook, Instagram, WhatsApp) e browsers sem Service Worker (Opera Mini, UC Browser, IE 11) com mensagem de redireccionamento.

### NFR Coverage Verification

NFRs por categoria de origem:

| Origem | NFRs |
| --- | --- |
| Success Criteria — Performance targets | NFR1, NFR4, NFR5, NFR6, NFR47 |
| Success Criteria — Compliance SLAs | NFR26, NFR27, NFR28, NFR29 |
| Success Criteria — Test coverage ≥80% | NFR54 |
| Domain — Encryption + RLS | NFR14, NFR15, NFR16 |
| Domain — Auth & MFA | NFR17, NFR18, NFR19 |
| Domain — Audit logs | NFR20 |
| Domain — Push payload opaco | NFR21 |
| Domain — Sem analytics third-party | NFR22 |
| Domain — Pseudonimização | NFR23 |
| Domain — DPIA + base jurídica | NFR24 |
| Domain — Consentimento parental | NFR25 |
| Domain — Direitos titulares | NFR26–NFR29 |
| Domain — Residência UE | NFR30 |
| Web App — TTI/FCP/LCP/CLS/TBT | NFR6–NFR10 |
| Web App — Bundle size | NFR11 |
| Web App — Cold start offline | NFR12 |
| Web App — Lighthouse CI | NFR13 |
| Web App — WCAG 2.1 AA pragmático | NFR36–NFR44 |
| Web App — Browser matrix | NFR59, NFR60 |
| Scoping — Heartbeat + backup | NFR49, NFR50, NFR51 |
| Scoping — Multi-tenant escalonamento | NFR32, NFR33 |
| Scoping — Provider-agnostic | NFR58 |

**60 NFRs ao todo. Cobertura completa das exigências de qualidade discutidas anteriormente, sem inflação por categorias irrelevantes.**
