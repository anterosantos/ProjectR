---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-sparta.md"
  - "docs/SPARTA.requirements.md"
workflowType: 'research'
lastStep: 5
research_type: 'technical'
research_topic: 'Stack técnico do SPARTA: PWA, Supabase, push notifications e hosting gratuito'
research_goals: 'Validar as escolhas técnicas do stack proposto para o SPARTA, cobrindo PWA vs nativo para iOS, limites do Supabase free tier, estratégias offline-first, Firebase Cloud Messaging vs Web Push API, e opções de hosting gratuito (Vercel/Railway/Render)'
user_name: 'Antero'
date: '2026-05-01'
web_research_enabled: true
source_verification: true
---

# Research Report: Stack Técnico do SPARTA

**Data:** 2026-05-01 (atualizado 2026-05-02)
**Autor:** Antero
**Tipo de Research:** Técnico

---

## Sumário Executivo

O stack proposto no Product Brief — **PWA + Supabase + Vercel + FCM** — é tecnicamente viável para um MVP de 4 semanas com um único developer e mantém-se gratuito para o âmbito inicial (1 clube, 40 jogadores). A pesquisa valida 4 das 5 escolhas, mas **recomenda uma alteração concreta**: substituir FCM por **Web Push direto (VAPID)** via biblioteca `web-push` numa Supabase Edge Function. Identifica também três condições operacionais não-negociáveis para que o stack se sustente:

1. **Heartbeat anti-pause** para o projeto Supabase (sem ele, 7 dias de inatividade pausam a base de dados).
2. **Onboarding iOS dedicado** com instruções "Adicionar ao Ecrã Inicial" — é o maior ponto de fricção e bloqueia push notifications + persistência de dados.
3. **Sync por foreground**, não por Background Sync — iOS Safari não suporta a API; `online` + `visibilitychange` + botão manual são o contrato real em 2026.

Todas as recomendações são para o âmbito MVP. O documento sinaliza explicitamente os pontos de inflexão onde decisões terão que ser revistas (escala multi-clube, monetização, iOS install rate).

---

## Decisões Validadas vs. Alteradas

| Componente | Brief original | Veredicto | Alteração? |
|---|---|---|---|
| Plataforma | PWA (não nativo iOS) | ✅ Validado | Não |
| Base de dados / Auth / Realtime / Storage | Supabase free tier | ✅ Validado para 1 clube | Não (mas requer heartbeat) |
| Push notifications | FCM (Firebase Cloud Messaging) | ❌ Substituir | **Sim — usar Web Push (VAPID) direto** |
| Hosting frontend | Vercel / Railway | ⚠️ Vercel sim, Railway já não é gratuito | Vercel Hobby + Supabase Cron |
| Estratégia offline | Modo offline com sync | ✅ Validado | Especificação concreta: Serwist + Dexie + outbox |

---

## 1. Plataforma: PWA vs Nativo iOS

### Estado de iOS PWA em 2026

- **Web Push em iOS** está disponível desde iOS 16.4 (Março 2023). Adoção atual: >95% dos iPhones ativos no mínimo iOS 16.4+ (iOS 26 sozinho representa ~66% dos iPhones em Fev 2026). **O gating de versão deixou de ser bloqueio real.**
- **Safari 18.4** adicionou Declarative Web Push e Screen Wake Lock (relevante para registo de stats em jogo prolongado).
- **iOS 26** abre por defeito as PWAs adicionadas ao home screen como web apps (toggle no Share sheet) — reduz o gap percetual face a apps nativas.
- **Suporte PWA na UE foi reposto** após remoção breve em 2024 motivada pelo DMA — Portugal está coberto.

### Limitações que continuam a importar para o SPARTA

- **"Adicionar ao Ecrã Inicial" continua a ser obrigatório** para receber push em iOS, **e não há prompt automático**. O utilizador tem de tocar Share → Add to Home Screen manualmente. **Este é o maior risco de adoção do projeto, não a tecnologia.**
- **Sem Background Sync, Periodic Background Sync ou Background Fetch em iOS** — sem roadmap público da Apple. Implicação direta: dados offline (questionário em campo sem cobertura) só sincronizam **quando o jogador reabre a PWA**. Não é dealbreaker para o caso de uso, mas obriga a UX explícita ("1 questionário pendente — toque para sincronizar").
- **Eviction de IndexedDB ao fim de 7 dias de não-uso** aplica-se apenas a sites *não instalados*. Uma vez adicionado ao Home Screen, a eviction é largamente eliminada. **Instalar é, portanto, requisito de durabilidade de dados, não só de push.**
- **Storage**: Cache API ~50 MB; IndexedDB até 500 MB ou metade do espaço livre. Folga generosa para os payloads pequenos do SPARTA.
- IndexedDB em iOS tem histórico de instabilidade (transações que ficam pendentes, perdas em updates de OS). Exige código defensivo (retries transacionais, nunca confiar num write até confirmação).

### Alternativas nativas avaliadas

| Opção | Esforço adicional ao MVP | Quebra zero-cost? | Veredicto |
|---|---|---|---|
| React Native + Expo | +3-6 semanas (port completo) | Sim ($99/ano Apple) | ❌ Inviável em 4 semanas para solo dev |
| Capacitor (wrap PWA) | +3-7 dias (config nativa, APNs, ícones, TestFlight) | Sim ($99/ano Apple) | 🔄 Reservar para Fase 2 |
| PWA pura | 0 | Não | ✅ MVP |

### Recomendação

**PWA-only no MVP. Capacitor como escape hatch documentado para Fase 2** se o install rate iOS for inferior a ~40% após o mês 2. RN/Expo está fora de âmbito.

**Justificação ligada às restrições do projeto:**
- Solo dev + 4 semanas + Supabase + GDPR + ecrã touchscreen para analista já é agressivo. Mesmo o wrap Capacitor (3-7 dias) arrisca o lançamento.
- Portugal é Android-dominante (~75-80% mobile OS share, Statcounter). Para clubes amadores, PWA é a default acertada; a minoria iOS instala-se com cartão de onboarding único.
- GDPR para menores é mais simples na web — sem App Store age-gate review, sem retenção de tokens APNs, fluxos de eliminação direta via Supabase.

### Mitigações a integrar desde o dia 1

- Modal de onboarding iOS-específico com instruções animadas para "Add to Home Screen".
- Service worker + IndexedDB queue com UI explícita "sincronizar pendentes" no foreground (compensa ausência de Background Sync).
- Writes IndexedDB defensivos (retries transacionais).
- Métrica de telemetria: install rate por plataforma. Trigger Capacitor wrap como sprint de Fase 2 se iOS install <40% no mês 2.

---

## 2. Supabase Free Tier — Viabilidade para SPARTA

### Limites exatos (Maio 2026)

| Recurso | Limite Free | Notas |
|---|---|---|
| Postgres database size | 500 MB | Hard ceiling por projeto |
| Database egress | 5 GB / mês | + 5 GB cached egress |
| File Storage | 1 GB | Fotos de jogadores, PDFs |
| Storage egress | 5 GB / mês | Org-level combinado |
| Auth MAU | 50.000 | MAU = ≥1 login em 30 dias |
| Realtime conexões concorrentes | 200 peak | |
| Realtime mensagens | 2 milhões / mês | |
| Edge Function invocations | 500.000 / mês | |
| Pedidos PostgREST | Ilimitados (rate-limited) | Sem cap mensal documentado |
| Projetos ativos por org | 2 | Pausados não contam |
| **Project pause** | **Após 7 dias de inatividade** | Email de aviso; restorable da dashboard |
| Região EU | Sim — Frankfurt, Dublin, Londres, Paris | Disponível no free tier |
| Backups | Diários, retenção 1 dia | Sem PITR no free |

### Análise de headroom para o SPARTA

**1 clube (40 jogadores + 5 staff):**
- DB: 50-100 MB/época → **5-10 épocas de margem** dentro dos 500 MB.
- Auth MAU: 45 / 50.000 → **0.09%** utilização. Praticamente irrelevante.
- Realtime: 50 conexões em pico de jogo / 200 → **25%** utilização. Folga, mas medir.
- Realtime mensagens: estimativa <100K/mês para 1 clube → **<5%** de 2M. Folga grande.
- Storage: 40 fotos × 500KB = 20 MB / 1 GB → **2%** utilização.
- Egress: poucas centenas de MB/mês esperados → confortável.

**Multi-clube (mesmo projeto Supabase, multi-tenant via RLS):**

| Clubes | DB total | Realtime peak | Primeiro a quebrar |
|---|---|---|---|
| 1-3 | <225 MB | <150 conn | — |
| 4 | 300 MB | 200 (no limite) | **Realtime conexões** se matchdays sobrepostos |
| 6-7 | 450-525 MB | 300-350 (excede) | DB size + Realtime |
| 10+ | 750 MB | 500 | DB size + egress |

**Inflexão prática: 4-5 clubes.** A partir daí, Pro plan ($25/mês) ou self-hosting passam a ser obrigatórios.

### GDPR / EU residency

- ✅ **Regiões EU disponíveis no free tier** (Frankfurt, Dublin, Londres, Paris). Selecionáveis na criação do projeto.
- ✅ **DPA self-service e gratuito** em https://supabase.com/legal/dpa — incorpora SCCs UE e UK addendum. Não requer plano pago.
- ✅ **Encriptação at-rest e in-transit por defeito.**
- ⚠️ **Responsabilidade partilhada**: o SPARTA tem de implementar RLS, captura de consentimento, endpoints de eliminação, política de privacidade, DPIA — isso fica do nosso lado.

**Veredicto GDPR: Supabase free tier passa o teste para os dados de fadiga/bem-estar (categoria especial Art. 9).**

### Alternativas avaliadas

| Opção | Postgres | Auth | Realtime | Veredicto |
|---|---|---|---|---|
| **Supabase Free** | 500 MB | 50K MAU | 200 conn / 2M msg | ✅ Melhor encaixe — stack integrado, EU + DPA |
| Neon Free | 0.5 GB/projeto, scale-to-zero (cold starts) | — | — | DB-only; auth/realtime/storage ficavam noutro lado |
| PlanetScale | **Free tier descontinuado** (Abr 2024) | — | — | ❌ Inviável |
| Firebase Spark | Firestore 1 GB, 50K reads/dia | 10K verifications/mês | Realtime DB incluído | Doc-store, não relacional; pior fit para stats |
| Self-hosted Supabase | Limitado por VPS | Idem | Idem | Hetzner ~€4-6/mês ou Oracle Cloud Always-Free (genuinamente grátis, mas pesado operacionalmente) |

### Veredicto

**Supabase free tier é credível para a promessa "zero-cost estruturalmente sustentável" no âmbito de 1 clube — com duas condições inegociáveis:**

1. **Heartbeat anti-pause obrigatório.** GitHub Action agendado a cada 6 dias a fazer um query trivial. Exemplo público disponível: [supabase-pause-prevention](https://github.com/travisvn/supabase-pause-prevention). **Sem isto, qualquer pausa de pré-época, paragens internacionais ou férias de Natal pausa a BD silenciosamente.**
2. **Qualificar o "zero-cost"** no posicionamento de marketing: é honesto para *deployments individuais*. Aos 4-5 clubes, ou se vai para Pro ($25/mês) ou se faz self-hosting. Manter a frase do Brief — "tier gratuito de forma credível e duradoura" — exige este caveat.

---

## 3. Estratégia Offline-First

### Padrão consensual em 2026

Stack em 4 camadas:

1. **Service Worker** (asset cache + resiliência de rede) — **Serwist** (sucessor mantido do `next-pwa`, que está sem manutenção há ~2 anos).
2. **Local store (IndexedDB)** — **Dexie.js** (wrapper minimalista, ~25 KB gzip, ativamente mantido).
3. **Sync queue (outbox pattern)** — escrita primeiro local com flag de status, drain quando há rede.
4. **Cache + UI otimista** — **TanStack Query** com `persistQueryClient`.

### Bibliotecas comparadas

| Lib | Status 2026 | Bundle | Complexidade | Veredicto |
|---|---|---|---|---|
| **Serwist** | ✅ Ativa | ~12 KB | Baixa | **Escolher** (Next.js) |
| Workbox | ✅ Ativa (Google) | ~10 KB | Baixa | Alternativa, mas Serwist integra melhor com Next |
| **Dexie.js** | ✅ Ativa (release Mar 2026) | ~25 KB | Baixa | **Escolher** |
| **TanStack Query persist** | ✅ Ativa | ~13 KB (já no stack) | Baixa-Média | **Escolher** |
| PowerSync | ✅ Mature, parceiro Supabase | 80-120 KB + native deps | Alta | Overkill para MVP; ótimo para Fase 2 |
| RxDB + Supabase | Plugin oficial mid-2025; bugs conhecidos (issue #7513, Out 2025) | 50-70 KB | Alta | Demasiado para 4 semanas |
| WatermelonDB | Mantida, mas RN-first | Grande | Alta | Wrong target |
| `next-pwa` original | ❌ **Sem manutenção** | — | — | **Evitar** |

### iOS Background Sync — verificação de realidade

**Background Sync API continua sem suporte iOS Safari em 2026.** Apenas Chromium. Não há roadmap Apple. Implicação para o SPARTA:

**Trigger ladder de drain (do mais fiável ao último recurso):**
1. Evento `online` no `window`
2. `visibilitychange` → `visible`
3. App focus / route change
4. Botão manual "Sincronizar agora" (sempre visível com contagem de pendentes)
5. Em Chromium/Android: registar Background Sync tag como bónus

**Tratar Background Sync como *enhancement* Chromium, não como garantia.** "Sync quando reabre a app" é o contrato real.

### Arquitetura MVP recomendada

**Stack:**
- Service worker: `@serwist/next` — precache do shell + StaleWhileRevalidate para GETs Supabase read-only
- Local DB: Dexie com 2 stores: `outbox` (writes pendentes) e `cache` (reads)
- TanStack Query com `persistQueryClient` + persister IDB. Mutations com `onMutate` (UI otimista).
- Auth: `supabase-js` stock com `localStorage` persistence + `autoRefreshToken: true`
- IDs: **UUIDv7 client-generated** (sortable, conflict-free PKs). Todos os writes são `upsert` para idempotência

### Fluxo de questionário offline

1. Jogador toca Submit no formulário das 5 dimensões.
2. Construir row `{ id: uuidv7(), user_id, session_id, dim1..5, submitted_at: now() }`.
3. Inserir em Dexie `cache` (UI mostra como submetido) **e** em `outbox` com `status: 'pending'`.
4. Tentar `supabase.from('fatigue_responses').upsert(row)` se `navigator.onLine`:
   - Sucesso → marcar outbox `synced`, eliminar após 24h.
   - Falha/offline → manter `pending`. Badge "1 pendente" no header.
5. Drain function (corre em `online`, `visibilitychange:visible`, botão manual, e Background Sync onde existir):
   - `await supabase.auth.getSession()` para JWT fresco.
   - Por cada `pending`, `upsert` com `onConflict: 'id'`. `retryCount++`. Backoff exponencial após 3 falhas.
6. Stats events usam **a mesma outbox** com coluna `kind` — uma queue, uma drain function.

### Conflitos PostgREST

- **Inserts puros (questionários, stats events)**: PK UUID gerado client-side → **zero conflitos possíveis** (linha imutável).
- **Updates (perfil, sessão)**: last-write-wins por `updated_at` server. ~95% suficiente.

### Riscos e gotchas

- **JWT expirado na queue**: nunca embeber JWT no payload encolado. Resolver auth no momento do flush.
- **Refresh token expirado** (>30 dias offline): drain falha com `invalid_grant`. Detetar e routar para re-login preservando outbox.
- **Realtime + offline**: Supabase Realtime não faz backfill de eventos perdidos. Refetch on reconnect, nunca confiar no websocket para catch-up.
- **UI otimista a mentir**: se um row falha definitivamente após retries, surfaceá-lo ao jogador (toast não-dismissível).
- **Service worker no Next.js 16**: Turbopack é o novo default; Serwist exige Webpack mode (`next dev --webpack`) e só ativa em produção builds. Não queimar um dia a debugar.
- **Clock skew**: guardar `submitted_at` (cliente) **e** `created_at` (server default).
- **Storage quota iOS**: orçamentar ~50 MB IDB. Eliminar outbox `synced` após 24h.

---

## 4. Push Notifications: Web Push (VAPID) > FCM

### FCM em 2026 — estado

- **Vivo, mas o stack legacy desapareceu.** APIs HTTP/XMPP legacy desativadas em 22 Jul 2024. Tudo novo tem que usar HTTP v1 (OAuth2) + Firebase JS SDK v10+. Tutoriais pré-2024 referenciam APIs que já não existem.
- **iOS Safari 16.4+ funciona** — FCM agora é essencialmente um wrapper sobre Web Push standard contra o serviço de push da Apple.
- **Free tier: efetivamente ilimitado** (Spark, $0, sem cap documentado). Para 80-160 mensagens/equipa/semana, custo nunca seria fator.
- **Setup:** projeto Firebase, Cloud Messaging on, gerar VAPID keys, descarregar service-account JSON, registar `firebase-messaging-sw.js` (conflito conhecido com Workbox/Serwist), backend OAuth2 JWT para HTTP v1, JSON como Supabase secret.

### Web Push (VAPID) direto

- Standard maduro: RFC 8030 + RFC 8292. Suportado por Chrome, Firefox, Edge, Safari (iOS 16.4+, macOS).
- **Library canónica: `web-push` (npm)** — assina VAPID JWT, encripta payload (ECE), dispatch por endpoint.
- **Compatível com Supabase Edge Functions** (Deno + npm compat: `import webpush from 'npm:web-push'`).
- **Gestão de subscrições:**
  - Frontend: `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })` → `PushSubscription` JSON.
  - Guardar 1 row por (user_id, subscription) em Postgres com RLS.
  - Edge Function loop sobre subscrições ativas.
  - **410 Gone** ou **404 Not Found** → eliminar a row. Único refresh handling necessário.
  - Browser dispara `pushsubscriptionchange` no SW → re-subscribe + update row.

### Esforço comparado

| Path | Esforço solo dev | Plumbing |
|---|---|---|
| **Web Push direto** | **~1 dia** | 1 keypair, 1 tabela DB, 1 endpoint subscribe, 1 Edge Function send, 1 ramo 410-cleanup |
| FCM | ~2-3 dias | Projeto Firebase + service-account secret + integração SW + plumbing OAuth2/HTTP v1 |

### iOS reality check

- Ambos os paths funcionam em iOS 16.4+ via VAPID end-to-end.
- **Add-to-Home-Screen continua obrigatório** para push em iOS (idêntico nos dois paths).
- Permissão tem de ser pedida após gesto do utilizador (não no page load).

### Implicações GDPR

- **Ambos os paths transitam um serviço de push de terceiro** (FCM/autopush/Apple) — propriedade do standard, não escolha de produto.
- **FCM adiciona uma camada Google extra** *em todos os browsers*, mesmo Firefox/Safari → entrada extra no Article 30 register; Firebase DPA + SCCs para gerir.
- **VAPID raw**: sem processador adicional. Endpoints continuam a ir aos vendors, mas a relação é mediada pelo browser do utilizador, não pelo SPARTA. **DPIA story mais limpa.**
- **Regra ouro de payload (qualquer path)**: nunca pôr scores de fadiga, RPE, ou outros dados Art. 9 no payload. Conteúdo opaco ("Hora do check-in pós-sessão") com deeplink; dados reais carregados depois pela app via canal autenticado.

### Recomendação

**Usar Web Push (VAPID) direto via `web-push` numa Supabase Edge Function. Saltar FCM.**

Razões por ordem de peso:
1. **Esforço menor** (~1 dia vs ~2-3). Em 4 semanas isto é orçamento real.
2. **Zero features perdidas.** Topics, console analytics e abstração cross-platform do FCM não se aplicam — temos 40 utilizadores por equipa, queremos saber pelo Postgres quem joga, e não corremos campanhas.
3. **Footprint GDPR mais limpo.** Um processor a menos.
4. **Sem vendor lock-in.** PushSubscription é objeto W3C standard.
5. **Bundle PWA mais pequeno** e menos um service worker em colisão.

**Tradeoff aceite:** escrevemos os ~30 LOC de cleanup 410/404 e do `pushsubscriptionchange`. Sem dashboard Firebase de delivery rates — se isso vier a importar pós-MVP, FCM é drop-in upgrade.

### Checklist de implementação

- Gerar VAPID keys (`npx web-push generate-vapid-keys`); private key como Supabase secret
- Tabela `push_subscriptions` com RLS
- Subscribe flow gated por consentimento UI (GDPR + iOS gesture)
- Edge Function `send-push` com loop e cleanup 410/404
- Onboarding copy iOS-específico para Add-to-Home-Screen

---

## 5. Hosting Gratuito

### Vercel Hobby

**Limites (Maio 2026):** 100 GB Fast Data Transfer/mês, 1M Edge Requests, 1M Function Invocations, 4 horas Active CPU, 360 GB-h Provisioned Memory, 1 GB Blob, 5K Image Transformations.

Para 40 utilizadores e algumas centenas de page loads/dia: **<5% de qualquer quota**.

- **Região EU (`fra1`) selecionável no Hobby** desde fim de 2024 → ~30-50 ms latência para utilizadores PT, execução em região UE para GDPR.
- **Cold starts em `fra1`**: 200-800 ms; invisíveis para PWA com shell em cache no cliente.
- **Hard cap behaviour**: sem overage cobrado — projeto é throttled até reset.

**⚠️ Restrição de uso comercial:** Fair Use Guidelines (Maio 2026) restringem Hobby a uso pessoal não-comercial. "Comercial" é definido em sentido lato: qualquer deployment usado para ganho financeiro de qualquer envolvido — incluindo consultores pagos a escrever o código, anúncios, ou processamento de pagamentos. Pedir donativos é OK; correr SaaS pago, freemium, ou ferramenta B2B "multi-clube" não. Enforcement por queixa/auditoria, não automático, mas o risco é real.

### Railway

- Free tier morto desde meados de 2023.
- **2026: $5 trial credit (30 dias)**, depois "Free plan" com $1/mês — insuficiente para um Next.js 24/7 (~$3-5/mês mínimo).
- Hobby plan a $5/mês.

**Veredicto:** ❌ Não é gratuito. Eliminar do shortlist.

### Render

- Free tier ainda existe.
- **Web Services**: 750 instance-hours/mês, **spin-down após 15 min de inatividade**, **cold start 30-60s** para container Next.js — dealbreaker UX para PWA com utilização esporádica.
- **Cron Jobs**: free tier, sem penalty de sleep.
- Região Frankfurt disponível no free.

**Veredicto:** Render Cron utilizável como contingência. Render Web Service não é viável como host primário.

### Alternativas

- **Cloudflare Pages + Workers**: free generoso (100K requests/dia, sem cold starts via V8 isolates, uso comercial permitido). Próprio limite: bundle Worker de **3 MiB** — Next.js + Supabase client + date-fns + assets PWA passa habitualmente. OpenNext Cloudflare adapter ajuda mas não elimina o teto.
- **Netlify**: 100 GB bandwidth, 300 build minutes, **uso comercial permitido**. Suporte Next.js menos polido (server actions, ISR, middleware com arestas mais ásperas).
- **Deno Deploy**: 1M requests, 100 GB, **uso comercial explicitamente permitido**, sem cartão. Next.js funciona via adapter mas não é o caminho mais suave.
- **Fly.io**: free tier descontinuado em 2024. Off-list.
- **Oracle Cloud Always Free**: até 4 ARM Ampere OCPUs + 24 GB RAM + 200 GB storage + 10 TB egress/mês. EU regions disponíveis. **Catch:** capacidade Ampere cronicamente esgotada em regiões UE; auto-administração obrigatória (OS patching, TLS, deploy pipeline). Plan B realista, não MVP path.

### Cron / scheduled jobs gratuitos

| Opção | Min interval | EU | Esforço | Notas |
|---|---|---|---|---|
| Vercel Cron (Hobby) | **1×/dia apenas** | sim | trivial | Mata "push 30 min antes da sessão" |
| GitHub Actions schedule | 5 min (latência 5-15 min) | runners US | baixo | Latência não-fiável |
| Cloudflare Workers Cron | 1 min | sim | médio | Precisa de Worker mesmo se app está noutro lado |
| **Supabase pg_cron** | **1 segundo** | sim (região do projeto) | **trivial** | **Já no stack**; chama Edge Functions ou webhooks |
| cron-job.org | 1 min | sim | trivial | Externo, sem SLA |

**Escolher Supabase Cron + Edge Function.** Já está no stack, executa na mesma região EU que a BD (lookup de tokens push é zero-latency), suporta sub-minute, evita a limitação daily-only do Vercel Hobby.

### Stack de hosting recomendado

**Frontend + API routes / server actions:** Vercel Hobby (região `fra1`).
**Scheduled push triggers:** Supabase Cron + Supabase Edge Function chamando `web-push`.
**Custo: 0 €/mês.**

**Não fazer:**
- Cron lógico em Vercel (daily-only)
- Push pipeline através de Render Web Service free (cold start)
- Apostar no "free" Railway (não é)

### Risco comercial / future-proofing

A restrição non-commercial do Vercel Hobby é o único risco material. O Brief reconhece evolução possível para freemium/multi-clube. **No dia em que entrar dinheiro — mesmo "Apoia-nos", in-app payment, ou consultor pago — Hobby está tecnicamente violado.** Vercel não auto-deteta, mas suspensão por queixa é real.

**Mitigações por ordem de dor:**
1. Manter só donativos até validar revenue, depois **Vercel Pro a $20/mês** (1 utilizador). Path of least disruption.
2. Se $20/mês inaceitável: migrar para **Netlify free** (uso comercial permitido) ou **Cloudflare Pages + OpenNext** (idem, atenção aos 3 MiB). Planear já: evitar features Vercel-only (KV/Blob, ISR-on-demand quirks, Edge Config) para a migração ser mecânica.
3. Escape hatch longo prazo: **Oracle Cloud Always Free** com Next.js self-hosted (`next start` atrás de Caddy) + cron nativo.

**GDPR:** Vercel processa dados UE em regiões UE com `fra1`, tem DPA UE, é sub-processor de Supabase em muitos setups — aceitável para health data com consentimento documentado e DPIA. Cloudflare e Netlify oferecem postura comparável.

**Ação concreta:** ship em Vercel Hobby + Supabase Cron agora; lembrete no calendário para reavaliar à primeira feature paga ou primeiro cliente externo a pagar; manter código Next.js provider-agnostic (sem imports `@vercel/*` para além do `next/*`).

---

## Stack Final Recomendado

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (PWA)                                         │
│  Next.js 16 (Webpack mode em dev, Turbopack só prod)    │
│  + Serwist (service worker)                             │
│  + Dexie.js (IndexedDB outbox + cache)                  │
│  + TanStack Query (persist, optimistic UI)              │
│  + UUIDv7 client-generated IDs                          │
│  → Hosted on Vercel Hobby (region: fra1)                │
└─────────────────────────────────────────────────────────┘
                          ↕ HTTPS
┌─────────────────────────────────────────────────────────┐
│  BACKEND (Supabase, EU region)                          │
│  Postgres (RLS, multi-tenant ready)                     │
│  Auth (supabase-js, autoRefreshToken)                   │
│  Realtime (use sparingly: coach dashboard only)         │
│  Storage (player photos, ephemeral PDFs)                │
│  Edge Functions:                                        │
│    - send-push (web-push npm lib + VAPID)               │
│    - schedule-handler (called by pg_cron)               │
│  pg_cron / Supabase Cron (sub-minute scheduling)        │
└─────────────────────────────────────────────────────────┘
                          ↕
        ┌──────────┴──────────┐
        ↓                     ↓
   Browser Push        GitHub Actions
   Services            (heartbeat anti-pause,
   (Google/Mozilla/    every 6 days)
   Apple per browser)
```

### Custo total esperado MVP (1 clube, 40 jogadores)

| Item | Custo/mês |
|---|---|
| Vercel Hobby | **0 €** |
| Supabase Free | **0 €** |
| GitHub Actions (heartbeat) | **0 €** |
| Domain (opcional, .pt ~12 €/ano) | ~1 €/mês |
| **Total** | **~0 €/mês** |

---

## Condições Operacionais Não-Negociáveis

Para que o "zero-cost estruturalmente sustentável" se mantenha credível:

1. **Heartbeat anti-pause Supabase**: GitHub Action a correr a cada 6 dias com query trivial. Sem isto, paragem de 7 dias pausa a BD.
2. **Onboarding iOS dedicado**: instruções animadas "Adicionar ao Ecrã Inicial" antes de pedir permissão de push. Sem instalação não há push, e dados offline são evicted após 7 dias.
3. **Nunca pôr Article 9 data em payloads de push**: notificações com texto opaco, dados carregados após abertura via canal autenticado.
4. **Drain por foreground, não Background Sync**: assumir que iOS nunca terá Background Sync; UX explícita de "pendentes" no header.
5. **Métrica de install rate por plataforma**: trigger de Capacitor wrap se iOS install <40% no mês 2.
6. **Código Next.js provider-agnostic**: zero imports `@vercel/*` para além de `next/*` — preparar migração para Netlify/Cloudflare se Vercel Hobby for inviabilizado por monetização futura.

---

## Pontos de Inflexão Conhecidos

| Sinal | Ação |
|---|---|
| 4-5º clube ativo | Decidir Pro ($25/mês) ou self-host Supabase |
| iOS install rate <40% no mês 2 | Sprint de Capacitor wrap |
| Primeiro pagamento (donativo > revenue) | Migrar para Vercel Pro ou Netlify/Cloudflare |
| Volume push >2M mensagens/mês | Reavaliar VAPID vs FCM (analytics, batching) |
| BD >400 MB | Política de arquivamento de épocas antigas |
| Realtime conexões pico >150 | Auditar fan-out; considerar polling onde aplicável |

---

## Atualizações ao Product Brief

Em consequência desta investigação, o Product Brief deve ser revisto em dois pontos:

1. **Substituir "FCM (Firebase Cloud Messaging)" por "Web Push (VAPID)"** na descrição do stack técnico (secção "Notas técnicas" e tabela de specs nos requirements).
2. **Substituir "Vercel/Railway" por "Vercel"** no campo de hosting; Railway já não é gratuito desde 2023.
3. **Qualificar "zero-cost estruturalmente sustentável"** com nota de pé que o limite credível são deployments de clube individual; a partir do 5º clube, é Pro plan ou self-hosting.

---

## Fontes

### PWA vs nativo iOS
- [PWA iOS Limitations and Safari Support 2026 — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Do Progressive Web Apps Work on iOS? 2026 — Mobiloud](https://www.mobiloud.com/blog/progressive-web-apps-ios)
- [Sending web push notifications — Apple Developer](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [Updates to Storage Policy — WebKit Blog](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [iOS Version Adoption Rates 2026 — Business of Apps](https://www.businessofapps.com/data/ios-version-adoption-rates/)
- [Apple Reveals iOS 26 Adoption Stats — MacRumors, Feb 2026](https://www.macrumors.com/2026/02/13/apple-shares-ios-26-adoption-stats/)
- [Mobile OS Market Share Portugal — Statcounter](https://gs.statcounter.com/os-market-share/mobile/portugal)
- [Capacitor — Building PWAs](https://capacitorjs.com/docs/web/progressive-web-apps)
- [Expo Documentation](https://docs.expo.dev/)
- [TestFlight Costs Complete Guide — MetaCTO](https://www.metacto.com/blogs/the-complete-guide-to-testflight-costs-integration-and-maintenance)

### Supabase free tier
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [Supabase DPA](https://supabase.com/legal/dpa)
- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)
- [supabase-pause-prevention — GitHub](https://github.com/travisvn/supabase-pause-prevention)
- [Neon Plans](https://neon.com/docs/introduction/plans)
- [PlanetScale Hobby Tier Deprecation FAQ](https://planetscale.com/docs/plans/hobby-plan-deprecation-faq)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Database Free Tier Comparison 2026 — agentdeals](https://agentdeals.dev/database-free-tier-comparison-2026)

### Offline-first
- [Background Synchronization API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [Background Sync — caniuse](https://caniuse.com/background-sync)
- [Building an Offline-First PWA with Next.js, IndexedDB, Supabase — Medium, Jan 2026](https://oluwadaprof.medium.com/building-an-offline-first-pwa-notes-app-with-next-js-indexeddb-and-supabase-f861aa3a06f9)
- [PowerSync — Bringing Offline-First To Supabase](https://www.powersync.com/blog/bringing-offline-first-to-supabase)
- [Serwist Getting Started](https://serwist.pages.dev/docs/next/getting-started)
- [Next.js Guides: PWAs](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [TanStack DB 0.6 — Persistence and Offline Support, Mar 2026](https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes)
- [Supabase Auth Sessions](https://supabase.com/docs/guides/auth/sessions)
- [PostgreSQL Logical Replication Conflicts](https://www.postgresql.org/docs/current/logical-replication-conflicts.html)

### Push notifications
- [Firebase Cloud Messaging docs](https://firebase.google.com/docs/cloud-messaging)
- [Migrate from legacy FCM APIs to HTTP v1](https://firebase.google.com/docs/cloud-messaging/migrate-v1)
- [RFC 8030: Generic Event Delivery Using HTTP Push](https://www.rfc-editor.org/rfc/rfc8030)
- [RFC 8292: VAPID for Web Push](https://datatracker.ietf.org/doc/html/rfc8292)
- [W3C Push API specification](https://www.w3.org/TR/push-api/)
- [Sending messages with web push libraries — web.dev](https://web.dev/articles/sending-messages-with-web-push-libraries)
- [web-push — npm](https://www.npmjs.com/package/web-push)
- [web-push-libs/web-push — GitHub](https://github.com/web-push-libs/web-push)
- [Web Push Error 410 — Pushpad](https://pushpad.xyz/blog/web-push-error-410-the-push-subscription-has-expired-or-the-user-has-unsubscribed)
- [Supabase Edge Functions — docs](https://supabase.com/docs/guides/functions)
- [Web Push with Mobile Safari (iOS 16.4) — pwa.io](https://pwa.io/articles/web-push-with-ios-safari-16-4-made-easy)
- [iOS special requirements for web push — Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications)

### Hosting
- [Vercel Hobby Plan docs](https://vercel.com/docs/plans/hobby)
- [Vercel Limits](https://vercel.com/docs/limits)
- [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
- [Vercel Cron Jobs Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Functions region config](https://vercel.com/docs/functions/configuring-functions/region)
- [Railway Pricing Plans](https://docs.railway.com/pricing/plans)
- [Render free-tier sleep behavior — community](https://render.discourse.group/t/do-web-services-on-a-free-tier-go-to-sleep-after-some-time-inactive/3303)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare)
- [Netlify Pricing](https://www.netlify.com/pricing/)
- [Deno Deploy Pricing](https://deno.com/deploy/pricing)
- [Oracle Cloud Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Supabase Cron module](https://supabase.com/modules/cron)
- [Supabase: Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)

Todas as fontes verificadas em 2026-05-02. Sinalizações de fontes >12 meses estão presentes nos relatórios dos subagents (mantidas onde a fonte continua a ser autoritativa apesar da idade — ex: WebKit blog post on storage policy, RFCs, PlanetScale deprecation announcement).
