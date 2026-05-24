# Web Push Notifications — SPARTA

> Story 4.7 — Push Subscription Infrastructure: VAPID Setup & Subscribe/Unsubscribe

---

## Visão Geral

O SPARTA utiliza a **Web Push API** (VAPID) para enviar notificações push aos jogadores antes e após cada sessão de treino (Story 4.8). A infraestrutura inclui:

- Tabela `push_subscriptions` (Supabase) com RLS por jogador
- Server Actions em `src/lib/actions/push.ts`
- Client Component em `src/app/configuracoes/notificacoes/`
- Service Worker em `src/app/sw.ts` (eventos `push` + `notificationclick`)

---

## Setup Inicial (uma vez por projeto)

### 1. Gerar par de chaves VAPID

```bash
npx -y web-push generate-vapid-keys
```

Exemplo de output:
```
Public Key:
BNbxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Private Key:
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Configurar chaves

#### Local (`.env.local`)
```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNbxxxxxxxxxxx...
# Privada não entra no .env.local em produção — apenas para testes locais
VAPID_PRIVATE_KEY=xxxxxxxxxx...
```

#### Vercel (Produção)
```
Project → Settings → Environment Variables:
  NEXT_PUBLIC_VAPID_PUBLIC_KEY = <chave pública>
```

> ⚠️ `VAPID_PRIVATE_KEY` **nunca** vai para Vercel. Fica exclusivamente em Supabase Edge Function secrets.

#### Supabase Edge Functions (Produção)
```bash
supabase secrets set VAPID_PRIVATE_KEY=<chave privada>
```

---

## Arquivo `.env.example`

O `.env.example` já documenta:
```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

---

## Verificação Local (curl)

Após gerar as chaves e ter uma subscrição válida no browser, podes testar:

```bash
npx web-push send-notification \
  --endpoint="<endpoint-do-browser>" \
  --p256dh="<p256dh-key>" \
  --auth="<auth-key>" \
  --vapid-subject="mailto:admin@sparta.app" \
  --vapid-public-key="<NEXT_PUBLIC_VAPID_PUBLIC_KEY>" \
  --vapid-private-key="<VAPID_PRIVATE_KEY>" \
  --payload='{"title":"Teste SPARTA","body":"Notificação de teste!","data":{"deepLink":"/hoje"}}'
```

---

## Fluxo de Subscrição

```
Jogador → /configuracoes/notificacoes
  → [Ativar notificações] 
    → Notification.requestPermission() 
    → pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })
    → subscribeToNotifications({ endpoint, keys }) [Server Action]
    → DB: push_subscriptions UPSERT (is_active=true)
    → UI: "Ativo desde [data]"
```

## Fluxo de Desactivação

```
Jogador → [Desativar]
  → Confirm dialog
    → unsubscribeFromNotifications() [Server Action]
    → DB: UPDATE is_active=false
    → pushManager.getSubscription().unsubscribe() [browser]
    → UI: "Inativo"
```

## Fluxo 410 Gone (subscrição expirada)

```
Edge Function send-push → HTTP 410 de serviço push
  → deactivateExpiredSubscription(endpoint) [Server Action]
  → DB: UPDATE is_active=false
  → Log: { event: 'push_subscription_expired', endpoint_prefix, profile_id }
  → UI próxima vez que jogador abre: "Inativo — reativa aqui"
```

---

## Segurança

| Preocupação | Mitigação |
|---|---|
| Chave privada VAPID exposta | Apenas em Supabase Edge Function secrets; nunca em Vercel public env |
| `keys_json` acedida por outro jogador | RLS `profile_id = auth.uid()` bloqueia cross-player reads |
| `keys_json` acedida por staff | Sem policy de staff SELECT; só service role (Edge Functions) pode aceder |
| Endpoint não sanitizado em logs | Apenas primeiros 60 chars logged; profile_id para audit |

---

## Ficheiros Relevantes

| Ficheiro | Propósito |
|---|---|
| `supabase/migrations/000210_push_subscriptions.sql` | Tabela + RLS |
| `src/lib/actions/push.ts` | Server Actions: subscribe, unsubscribe, deactivate |
| `src/app/configuracoes/notificacoes/page.tsx` | Página de settings |
| `src/app/configuracoes/notificacoes/notifications-settings.tsx` | Client Component |
| `src/app/sw.ts` | Service Worker: push + notificationclick |
| `__tests__/lib/push.test.ts` | Testes unitários das actions |

---

## Troubleshooting

**"Permissão negada" no browser:**
- Verificar se o browser tem notificações bloqueadas para o domínio
- Chrome: `chrome://settings/content/notifications`

**Service Worker não regista push:**
- Verificar `NEXT_PUBLIC_VAPID_PUBLIC_KEY` está definida no ambiente
- Confirmar que o SW está registado: `navigator.serviceWorker.ready`

**410 Gone de imediato:**
- A subscrição expirou (browser limpou dados ou utilizador limpou cookies)
- O utilizador precisa de subscrever novamente em `/configuracoes/notificacoes`

**Subscrição duplicada no DB:**
- A constraint `UNIQUE(profile_id, endpoint)` garante upsert em vez de inserção duplicada
- Se mudar de browser, é criada uma nova row (novo endpoint)
