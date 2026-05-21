---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['docs/SPARTA.requirements.md']
session_topic: 'Funcionalidades em falta no SPARTA'
session_goals: 'Identificar lacunas no que já está especificado — features não cobertas, casos de uso esquecidos, necessidades implícitas dos utilizadores'
selected_approach: 'user-selected'
techniques_used: ['Analogical Thinking']
ideas_generated: [13]
context_file: 'docs/SPARTA.requirements.md'
session_active: false
workflow_completed: true
---

# Brainstorming Session — SPARTA

**Facilitador:** Antero
**Data:** 2026-05-01
**Tópico:** Funcionalidades em falta no SPARTA
**Técnica:** Analogical Thinking (F1, Exército, Gaming, Apps de Fitness)

---

## Visão Geral da Sessão

**Objetivos:** Identificar lacunas no que já está especificado no documento `docs/SPARTA.requirements.md` — features não cobertas, casos de uso esquecidos, necessidades implícitas dos utilizadores.

**Contexto do Projeto:** Sistema de acompanhamento de jogadores de futebol 11 (plantel de 40 jogadores) cobrindo fadiga individual, performance e estatísticas, com 3 módulos propostos: Registos de Jogadores, Registo de Estatísticas, Consulta de Relatórios.

---

## Seleção de Técnicas

**Abordagem:** Técnicas escolhidas pelo utilizador

**Técnicas selecionadas:**

- **Analogical Thinking** — encontrar soluções criativas traçando paralelos com outros domínios para revelar funcionalidades em falta no SPARTA

**Domínios explorados:** Fórmula 1 · Exército · Gaming/eSports · Apps de Fitness

---

## Ideias Geradas

### Tema 1: Monitorização e Análise de Fadiga & Performance

O cruzamento inteligente dos dados já existentes no sistema

**[Feature #1]: Correlação Fadiga × Estatísticas de Performance**
*Conceito:* Dashboard que cruza os inputs do questionário de fadiga (energia muscular, concentração, descanso, desconforto, estado emocional) com as estatísticas do mesmo jogador no treino ou jogo seguinte — revelando padrões como "quando X reporta fadiga muscular ≥ 3, as suas perdas de bola sobem."
*Novidade:* O documento especifica os dois tipos de dados separadamente, mas nunca menciona o cruzamento entre eles — são dois silos que nunca se encontram nos relatórios.
*Domínio de origem:* Fórmula 1 — análise pós-corrida e correlação de telemetria

**[Feature #2]: Curva de Recuperação Individual**
*Conceito:* Visualização da trajectória de fadiga de cada jogador nos dias após um jogo ou treino intenso, gerando um perfil de recuperação individual — alguns jogadores recuperam em 48h, outros em 72h.
*Novidade:* Não existe no documento qualquer noção de recuperação ao longo do tempo — os dados de fadiga são pontuais (pré-treino), não contínuos.
*Domínio de origem:* Fórmula 1 — gestão de desgaste ao longo da época

**[Feature #3]: Índice de Carga Acumulada**
*Conceito:* Métrica calculada automaticamente que soma minutos jogados, presenças em treino e scores de fadiga reportados numa janela de tempo (ex: últimos 7 dias / 30 dias), gerando um indicador de carga por jogador — verde, amarelo, vermelho.
*Novidade:* O documento regista os dados em bruto mas nunca os agrega numa métrica de carga. Não há nenhum sinal de "este jogador está perto do limite."
*Domínio de origem:* Fórmula 1 — gestão de carga de motor ao longo da época

**[Feature #4]: Dashboard de Equipa Agregado**
*Conceito:* Vista com métricas coletivas do plantel — média de fadiga da equipa, taxa de presença em treinos, estatísticas agregadas por posição, evolução coletiva ao longo da época. Complementa o perfil individual com uma leitura do grupo.
*Novidade:* Toda a especificação atual é centrada no jogador individual; não existe nenhuma visão agregada da equipa como unidade.
*Domínio de origem:* Gaming/eSports — team dashboards e métricas de grupo

---

### Tema 2: Recolha de Dados

Garantir que os dados entram corretamente e de forma completa no sistema

**[Feature #5]: Questionário Pós-Sessão**
*Conceito:* Questionário de fadiga aplicado também após treinos e jogos, usando as mesmas 5 dimensões — permitindo comparar o estado de entrada vs. saída de cada sessão e construir a curva de recuperação.
*Novidade:* O documento especifica apenas questionário pré-treino; não há registo de como o jogador termina cada sessão.
*Domínio de origem:* Fórmula 1 — dados de telemetria no final de cada stint

**[Feature #6]: Notificações Push para Questionários**
*Conceito:* Sistema de notificações push enviadas automaticamente aos jogadores X minutos antes e depois de cada treino ou jogo, lembrando-os de preencher o questionário de fadiga. Configurável por administrador (quanto tempo antes, que mensagem).
*Novidade:* O documento não menciona nenhum mecanismo de lembretes ou garantia de preenchimento.
*Domínio de origem:* Gaming/eSports — daily quest reminders e push notifications

---

### Tema 3: Perfil e Gestão de Jogadores

Visão completa e operacional do plantel

**[Feature #7]: Página de Perfil Unificado do Jogador**
*Conceito:* Vista consolidada por jogador mostrando dados pessoais, histórico de peso/altura, evolução de fadiga, estatísticas por época e carreira, presenças em treinos e jogos, e estado de prontidão atual — tudo num único ecrã.
*Novidade:* O documento tem os dados distribuídos por módulos separados (registo de jogadores, estatísticas, treinos, jogos) mas nunca menciona uma vista unificada por jogador.
*Domínio de origem:* Gaming/eSports — player profile cards com career stats

**[Feature #8]: Painel de Prontidão do Plantel**
*Conceito:* Vista consolidada que agrega fadiga reportada, carga acumulada, presenças em treino e tempo de jogo numa métrica de prontidão por jogador — verde (apto), amarelo (precaução), vermelho (não recomendado). O treinador vê o plantel todo num relance antes de decidir a convocatória.
*Novidade:* O documento tem os dados separados em módulos distintos mas nunca os agrega numa visão de disponibilidade operacional.
*Domínio de origem:* Exército — estado de prontidão operacional por soldado

**[Especificação #9]: Modelo de Acesso e Permissões**
*Conceito:* Jogadores acedem apenas aos seus próprios questionários de fadiga. Equipa técnica e analistas têm acesso total a todos os dados. Relatórios de performance dos jogadores são partilhados pela equipa técnica em PDF.
*Novidade:* O documento menciona os três tipos de utilizadores mas nunca especifica o que cada um vê ou pode fazer — uma lacuna crítica para o desenvolvimento.
*Domínio de origem:* Exército — hierarquia de acesso a informação por posto

---

### Tema 4: Planeamento e Estrutura Temporal

A espinha dorsal organizacional do sistema

**[Feature #10]: Calendário de Treinos e Jogos**
*Conceito:* Módulo de planeamento onde a equipa técnica insere sessões de treino e jogos com data, hora e tipo — servindo de base ao sistema de notificações mas também como vista de agenda para toda a equipa.
*Novidade:* O documento regista treinos e jogos após acontecerem, mas não existe nenhum conceito de calendarização antecipada.
*Domínio de origem:* Gaming/eSports — eventos agendados e calendário de competição

**[Feature #11]: Gestão de Épocas**
*Conceito:* O sistema organiza todos os dados por época (ex: 2024/2025, 2025/2026), com data de início e fim configurável. Relatórios e dashboards podem ser filtrados por época ou mostrar dados acumulados de múltiplas épocas. Histórico de jogadores preservado ao longo de toda a carreira no clube.
*Novidade:* O documento não menciona qualquer organização temporal dos dados — não há noção de época, temporada ou período de filtragem.
*Domínio de origem:* Gaming/eSports — seasons com stats acumulados

---

### Tema 5: Comunicação e Partilha

Como a informação chega a quem precisa

**[Feature #12]: Exportação de Relatórios em PDF**
*Conceito:* A equipa técnica pode gerar e partilhar com jogadores individuais um relatório PDF com os seus dados de performance — um mecanismo de feedback controlado onde o jogador recebe a informação que a equipa técnica decide partilhar, quando decide partilhar.
*Novidade:* O documento menciona relatórios e dashboards mas não especifica nenhum mecanismo de exportação ou partilha individual.
*Domínio de origem:* Exército — relatórios de avaliação individuais partilhados por cadeia de comando

---

### Módulo Opcional

**[Feature #13]: Análise de Adversários**
*Conceito:* Módulo secundário para registo de dados dos adversários — formação habitual, jogadores-chave, padrões táticos observados — consultável antes da preparação de um jogo. Completamente separado do core da plataforma. Opcional e de baixa prioridade.
*Novidade:* O documento está 100% focado na própria equipa; não existe qualquer referência a contexto externo.
*Domínio de origem:* Exército — análise de inteligência do adversário antes de missão

---

### Backlog de Evolução Futura

Ideias identificadas mas não prioritárias para a versão atual:

- **Alertas em tempo real durante jogos** — alertas automáticos quando métricas cruzam limiares (ex: demasiadas perdas de bola); descartado para a versão atual
- **Benchmarks por posição** — métricas e limiares específicos por posição de campo
- **Objetivos e metas individuais** — definição de targets por jogador com tracking de progresso
- **Integração com wearables** — dados automáticos de smartwatch/banda de fitness a complementar questionários manuais
- **Resumos automáticos** — envio automático de relatórios semanais/mensais por notificação

---

## Resumo Executivo

**13 funcionalidades identificadas** como ausentes do documento de requisitos atual, organizadas em 5 temas:

| # | Feature | Tema | Prioridade |
| --- | ------- | ---- | ---------- |
| 1 | Correlação Fadiga × Estatísticas | Monitorização | Alta |
| 2 | Curva de Recuperação Individual | Monitorização | Alta |
| 3 | Índice de Carga Acumulada | Monitorização | Alta |
| 4 | Dashboard de Equipa Agregado | Monitorização | Alta |
| 5 | Questionário Pós-Sessão | Recolha de Dados | Alta |
| 6 | Notificações Push | Recolha de Dados | Alta |
| 7 | Perfil Unificado do Jogador | Gestão de Jogadores | Alta |
| 8 | Painel de Prontidão do Plantel | Gestão de Jogadores | Alta |
| 9 | Modelo de Acesso e Permissões | Gestão de Jogadores | Alta (crítica) |
| 10 | Calendário de Treinos e Jogos | Planeamento | Alta |
| 11 | Gestão de Épocas | Planeamento | Alta |
| 12 | Exportação em PDF | Comunicação | Alta |
| 13 | Análise de Adversários | Módulo Opcional | Baixa |

---

## Próximos Passos Recomendados

1. **Atualizar o documento de requisitos** `docs/SPARTA.requirements.md` com as 12 features confirmadas (excluindo a opcional)
2. **Avançar para o Create PRD** (`@bmad-create-prd`) com o documento de requisitos atualizado como base
3. **Considerar o módulo de Análise de Adversários** como fase 2 do produto
4. **Guardar o backlog de evolução futura** para roadmap de versões seguintes
