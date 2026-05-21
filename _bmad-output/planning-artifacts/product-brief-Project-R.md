---
document_title: "Product Brief: SPARTA"
status: "draft"
created: "2026-05-01"
updated: "2026-05-02"
inputs:
  - "_bmad-output/planning-artifacts/research/market-solucoes-gratuitas-gestao-performance-futebol-research-2026-05-01.md"
  - "_bmad-output/planning-artifacts/research/domain-metricas-desempenho-atletas-futebol-11-research-2026-05-01.md"
  - "_bmad-output/planning-artifacts/research/technical-stack-tecnico-sparta-research-2026-05-01.md"
  - "_bmad-output/brainstorming/brainstorming-session-2026-05-01-1000.md"
  - "_bmad-output/brainstorming/brainstorming-session-2026-05-01-1100.md"
  - "docs/SPARTA.requirements.md"
---

# Product Brief: SPARTA

## Sumário Executivo

As lesões destroem épocas. Um jogador-chave que falha 6 semanas por sobrecarga acumulada não é azar — é informação que não chegou a tempo. A investigação em ciências do desporto demonstra que o risco de lesão aumenta 5 a 7 vezes quando o rácio de carga aguda/crónica de um atleta excede 1.5, e que questionários subjetivos de bem-estar detetam essa sobrecarga dias antes de se tornar visível no campo. Equipas profissionais usam esta metodologia de forma sistemática. Equipas amadoras, sem ferramentas acessíveis, continuam a decidir por intuição.

O SPARTA é uma plataforma de gestão de performance desportiva, de custo zero, construída especificamente para futebol 11 amador. O seu propósito é simples: dar ao treinador, antes de cada convocatória, uma visão clara e objetiva do estado físico de cada jogador — para que a decisão de poupar ou jogar um atleta seja informada, não uma aposta. A plataforma é acedida pelo browser em qualquer dispositivo, sem instalação, sem custo de licença.

A filosofia que orienta o projeto é deliberada: a tecnologia serve a decisão humana, não a substitui. O sistema fornece dados ao staff técnico; é o staff que os usa para ter conversas mais informadas e mais eficazes com os atletas. O contacto humano entre treinador e jogador não é reduzido — é melhorado, porque passa a ser fundamentado.

---

## O Problema

O staff de futebol amador gere informação crítica sobre 30 a 40 jogadores com ferramentas completamente desligadas entre si:

- **WhatsApp** para comunicação de presenças
- **Excel ou Google Sheets** para registo de estatísticas e assiduidade
- **Google Forms** (quando existe) para questionários pontuais de bem-estar
- **Memória e intuição** para decisões de convocatória e gestão de carga

Nenhuma destas ferramentas fala com as outras. O resultado: um preparador físico que registou 3 sessões seguidas de fadiga elevada num jogador não tem forma de o correlacionar com a quebra de rendimento nos últimos 2 jogos — a informação existe, mas está dispersa e inacessível no momento em que mais importa.

As alternativas existentes não resolvem o problema. Soluções profissionais como Catapult, Hudl ou Metrifit custam centenas a milhares de euros por ano — um filtro eliminatório imediato para clubes amadores. As soluções gratuitas (TeamStats, Spond) cobrem scheduling e comunicação mas não têm qualquer componente de monitorização fisiológica. Não existe, no mercado atual, nenhuma solução gratuita que integre fadiga e performance especificamente para futebol amador.

---

## A Solução

O SPARTA integra três componentes num único sistema acessível via browser:

**1. Monitorização de Fadiga**
Questionário de 5 dimensões (energia muscular, concentração/motivação, qualidade do sono, desconforto músculo-articular, estado emocional) aplicado pré e pós cada sessão. Tempo de preenchimento: menos de 2 minutos. Push notifications automáticas enviam o questionário no momento certo, sem intervenção do staff. Os dados dos jogadores são partilhados com a equipa técnica — que os usa para conduzir conversas individuais mais informadas, em vez de substituir esse contacto por feedback automático.

**2. Registo de Performance**
Estatísticas de jogo e treino registadas manualmente pelo analista via interface touchscreen de 3 ecrãs: seleção do jogador em campo → tipo de ação → zona do campo onde ocorreu. As 7 métricas registadas (perdas de bola, recuperação de bola, remates totais e enquadrados, passes completados, pressões defensivas, ações defensivas e ofensivas com sucesso) foram validadas pela investigação científica como as mais preditivas de resultados em futebol 11. Complementadas com dois indicadores de carga calculados automaticamente: o sRPE (carga interna percebida × duração da sessão) e o ACWR — o rácio agudo/crónico que sinaliza risco de lesão antes que este se materialize.

**3. Painel de Prontidão**
O elemento central da plataforma. Um semáforo verde/amarelo/vermelho por jogador, calculado automaticamente a partir da combinação de fadiga recente, ACWR e assiduidade. Antes de qualquer convocatória, o treinador abre o painel e tem em segundos a visão do estado físico de todo o plantel — sem interpretar tabelas, sem consolidar dados de fontes diferentes.

À medida que os dados se acumulam ao longo da época, emerge o motor de correlação: padrões individuais que ligam estados de fadiga a desempenho em jogo, visíveis por jogador e por posição. Esta camada analítica aprofunda-se com o tempo e será a evolução natural após o MVP.

---

## O Que Nos Distingue

| Dimensão | SPARTA | Alternativas gratuitas | Soluções profissionais |
| --- | --- | --- | --- |
| Custo | €0 | €0 | €500–5.000+/ano |
| Prevenção de lesões por ACWR | ✅ | ❌ | ✅ |
| Fadiga + Performance integradas | ✅ | ❌ | ✅ |
| Específico para futebol | ✅ | ❌ (genérico) | ✅ |
| Mobile-first, sem instalação | ✅ | Parcial | Parcial |
| Decisão de convocatória em segundos | ✅ | ❌ | Parcial |
| Filosofia humano-primeiro | ✅ | ❌ | ❌ |

**Zero custo estruturalmente sustentável para o cenário-alvo.** O stack técnico (PWA + Supabase + Vercel) mantém-se integralmente gratuito para deployments de clube individual — o âmbito que o SPARTA serve. A análise técnica confirma folga confortável até 4 clubes em multi-tenancy partilhada antes de qualquer limite gratuito ser atingido; a partir desse ponto, ou se aceita o plano Pro do Supabase ($25/mês) ou se opta por self-hosting. Ao contrário de plataformas freemium que precisam de converter utilizadores para cobrir infraestrutura, o SPARTA pode manter o tier gratuito de forma credível para o seu segmento natural.

**Construído com treinadores, para treinadores.** O SPARTA é co-desenvolvido com a participação ativa de 3 treinadores que testam e validam cada decisão de produto. Não é uma ferramenta tecnológica adaptada ao futebol — é uma ferramenta de futebol construída com quem o pratica.

**Privacidade como princípio, não como checkbox.** Os dados de fadiga e bem-estar são dados de saúde na aceção do GDPR (Art. 9 — categoria especial). O SPARTA é desenhado com conformidade GDPR desde o primeiro dia, incluindo consentimento parental para atletas menores. Para clubes com exposição legal, esta garantia é um diferenciador real.

**Construído para todas as faixas etárias, desde os 13 anos.** O sistema aplica limiares ACWR diferenciados para jogadores em desenvolvimento (13–17 anos) versus seniores, com linguagem do questionário de fadiga adaptada para o escalão sub-14. Segue o princípio LTAD (Long-Term Athlete Development) — protocolo de monitorização individualizável e sustentável para jovens atletas, onde complexidade excessiva compromete a adesão.

---

## Quem Serve

**Treinador Principal**
Consulta o Painel de Prontidão no telemóvel antes de cada sessão ou jogo. Quer uma resposta clara e rápida. O sistema serve-o se conseguir tomar uma decisão informada em menos de 30 segundos — e depois ter uma conversa mais rica com o jogador, apoiada nos dados que o staff já processou.

**Analista / Preparador Físico**
Regista estatísticas de jogo e treino, configura o sistema, monitoriza tendências individuais ao longo da época, gera relatórios. É o utilizador avançado que transforma os dados em conhecimento útil para o staff.

**Jogador**
Preenche o questionário de fadiga em menos de 2 minutos, recebe push notifications no momento certo. A sua contribuição alimenta decisões mais informadas — o retorno chega-lhe através do contacto direto com o staff técnico, não através de um ecrã.

**Âmbito inicial:** Plantel de 40 jogadores que alimenta 2 equipas, com expansão natural ao clube completo e a outros clubes como evolução de produto.

---

## Critérios de Sucesso

**MVP — Mês 1:**

- Taxa de preenchimento de questionários ≥ 80% dos jogadores por sessão
- Tempo médio de preenchimento ≤ 2 minutos
- Uso do Painel de Prontidão pelo staff antes de ≥ 90% das sessões
- Zero incidentes de conformidade GDPR

**Validação — Meses 2–6:**

- ≥ 3 padrões individuais de fadiga identificados na primeira época
- Validação positiva por ≥ 3 treinadores externos durante fase de testes
- Pelo menos 1 decisão de convocatória documentada onde os dados contrariaram a intuição inicial e o staff optou por seguir os dados

---

## Âmbito — MVP (1 Mês)

**Incluído:**

- Gestão de utilizadores com 3 papéis (treinador, analista, jogador)
- Questionário de fadiga pré e pós sessão (5 dimensões)
- Registo de assiduidade e minutos jogados
- Estatísticas manuais de jogo e treino (registadas pelo analista)
- Cálculo automático de ACWR e sRPE
- Painel de Prontidão com semáforo por jogador
- Dashboards: (1) estado do plantel por sessão — vista do treinador; (2) tendências individuais de fadiga 4 semanas — vista do analista; (3) carga acumulada por jogador na época — vista do preparador físico
- Push notifications configuráveis (pré e pós sessão)
- Exportação básica de dados (CSV) para cumprimento do direito à portabilidade e eliminação (GDPR)
- Conformidade GDPR: consentimento parental para jogadores dos 13–15 anos, controlo de acesso por papel, política de retenção de dados
- Modo offline para preenchimento de questionários em zonas sem cobertura, com sincronização automática

**Notas técnicas:**

- Push notifications em iOS requerem iOS 16.4+ e adição da PWA ao ecrã inicial; esta limitação deve ser comunicada aos jogadores no onboarding
- O consentimento parental exige um fluxo de onboarding específico: email ao encarregado de educação, confirmação auditável, bloqueio de acesso até confirmação

**Fora do âmbito (MVP):**

- Integração com GPS / wearables
- Extração automática de estatísticas por computer vision
- Análise de adversários
- Alertas em tempo real durante jogo
- Suporte multi-clube
- Vista de histórico pessoal para o jogador (dados mediados pelo staff)

---

## Visão

Se o MVP validar a adoção, o SPARTA evolui em três horizontes:

**Horizonte 1 (meses 2–6):** Motor de correlação visível — gráficos individuais que ligam padrões de fadiga a desempenho em jogo por jogador. Expansão ao clube completo: múltiplas equipas, múltiplas faixas etárias, relatórios consolidados para direção técnica.

**Horizonte 2 (meses 6–18):** Abertura a outros clubes. Modelo de dados partilhado permite benchmarking anónimo entre equipas. Possível modelo freemium com funcionalidades avançadas (relatórios exportáveis, API de integração, multi-clube ilimitado).

**Horizonte 3 (18 meses+):** API de integração com GPS e wearables. Extração automática de estatísticas por computer vision. Expansão aos mercados de língua portuguesa (Brasil, Angola, Moçambique) — 13.000 clubes amadores registados só no Brasil. Plataforma de referência para futebol amador em mercados de língua portuguesa.

A janela existe agora: o mercado amador cresce rapidamente (28% de adoção de analytics em academias, em aceleração), os incumbentes ainda não lançaram uma resposta gratuita convincente, e o stack tecnológico disponível hoje torna este MVP construível por um único developer em 4 semanas.
