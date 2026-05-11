---
title: GDPR Legal Review — Wellness Data (Art. 9)
date: 2026-05-09
author: Legal & Compliance Review
status: APPROVED
audience: Product, Backend, Compliance
---

# ⚖️ Revisão Legal GDPR — Dados de Bem-estar (Art. 9)

## Âmbito da Revisão

**Requisito:** Integrar 6 campos de wellness no Painel de Prontidão (mood, dores musculares, exames, sono, energia, concentração).

**Questão Legal:** Alguns destes campos constituem "dados de categorias especiais" sob GDPR Art. 9?

---

## 1. Classificação de Dados (GDPR Art. 9)

### Campos Sujeitos a Art. 9 (Categorias Especiais)

| Campo | Classificação | Base Legal | Motivo |
|-------|---------------|-----------|--------|
| **mood_score** (1–5 emoji) | ⚠️ Saúde Mental | Consentimento Art. 9(2)(a) | Avalia bem-estar psicológico do atleta |
| **muscle_pain_zones** (JSON: joelho, ombro, etc.) | 🔴 **Dados de Saúde** | Consentimento Art. 9(2)(a) | Localização e tipo de dor = informação médica/biométrica |
| **sleep_quality_score** | ⚠️ Saúde | Consentimento Art. 9(2)(a) | Qualidade de sono = padrão de saúde |
| **sRPE_value** (carga de treino) | 🟢 Contexto Desportivo | Interesse Legítimo Art. 6(1)(f) | Avaliação subjetiva de esforço; não diagnóstico |
| **has_exams_this_week** | 🟢 Contexto Educacional | Interesse Legítimo Art. 6(1)(f) | Flag comportamental; não saúde ou biométrica |
| **energy_score** | ⚠️ Saúde | Consentimento Art. 9(2)(a) | Energia = indicador de fadiga/estado físico |
| **concentration_score** | ⚠️ Saúde | Consentimento Art. 9(2)(a) | Concentração = função cognitiva |
| **emotional_state_score** | 🔴 **Dados de Saúde** | Consentimento Art. 9(2)(a) | Estado emocional = saúde mental |

**Conclusão:** 5 campos são "dados de categorias especiais" (Art. 9). Requerem base legal adicional além do consentimento simples (Art. 6).

---

## 2. Base Legal Selecionada

### ✅ Opção: Consentimento Explícito (Art. 9(2)(a))

**Por quê:**
- Aplica-se a contexto desportivo (atletismo/saúde) onde consentimento é aceitável
- Transparência máxima: o jogador sabe exatamente quais dados estão a ser processados
- Facilita exercício de direitos (direito de revogação, acesso, rectificação)
- Não requer avaliação de "interesse legítimo" mais complexa

**Alternativas rejeitadas:**
- ❌ **Art. 9(2)(h)** (diagnóstico/prevenção): Não aplica — não há profissional médico a fazer diagnóstico
- ❌ **Art. 9(2)(e)** (manifestamente públicos): Não aplica — dados são privados do atleta
- ❌ **Art. 9(2)(f)** (interesse legítimo): Possível, mas requer DPIA + balanceamento rigoroso; consentimento é mais simples

---

## 3. Requisitos de Consentimento Explícito

### Obrigações do Controlador (Club)

Conforme GDPR Art. 7, o consentimento deve ser:

1. **Livre** — Sem coação. ✅ Implementação: Consentimento é opção separada (não bundled com outras obrigações)
2. **Específico** — Claro para qual propósito. ✅ Implementação: Campo "wellness data collection" separado do consentimento geral
3. **Informado** — O titular sabe exatamente o quê. ✅ Implementação: Texto de consentimento enumera cada campo
4. **Inquestionável** — Fácil de comprovar. ✅ Implementação: Guardar `wellness_consent` table com timestamp e versão

### Informações Necessárias (Art. 13/14)

O jogador deve receber (via Privacy Notice ou Consent Modal):

- [ ] **Identidade do Controlador:** Nome do clube + contacto legal
- [ ] **Finalidades:** "Monitorização de bem-estar, otimização de carga de treino, prevenção de lesões"
- [ ] **Dados Específicos:** Enumeração de mood, dores, sono, energia, concentração, estado emocional
- [ ] **Destinatários:** Coach, analista (staff do clube)
- [ ] **Período de Retenção:** "Mantido durante a época; eliminado 12 meses após saída do clube"
- [ ] **Direitos GDPR:** Acesso, rectificação, apagamento, revogação do consentimento
- [ ] **Direito de Reclamação:** "Contacte a autoridade de proteção de dados (ex: CNPD em PT)"

---

## 4. Texto de Consentimento (Componente App)

### Modal de Consentimento — Wellness Data Collection

**Português:**

```
╔════════════════════════════════════════════════════════════════╗
║  CONSENTIMENTO PARA RECOLHA DE DADOS DE BEM-ESTAR            ║
║  GDPR Art. 9(2)(a) — Dados de Categorias Especiais           ║
╚════════════════════════════════════════════════════════════════╝

O [NOME DO CLUBE] pretende processar os seguintes dados 
de bem-estar para otimizar o seu treino e monitorizar a sua saúde:

📋 DADOS RECOLHIDOS:
  ✓ Humor (escala de 1–5)
  ✓ Dores musculares (localização: joelho, ombro, etc.)
  ✓ Qualidade de sono
  ✓ Energia percebida
  ✓ Concentração
  ✓ Estado emocional
  ✓ Exames/testes agendados

🎯 FINALIDADES:
  • Monitorização de bem-estar do atleta
  • Otimização de carga de treino individual
  • Prevenção de sobrecarga e lesões
  • Análise de desempenho desportivo
  • Decisões de convocação/escalação

👥 QUEM TEM ACESSO:
  • Staff técnico do clube (coach, analista)
  • Nenhuma partilha com terceiros

📅 PERÍODO DE RETENÇÃO:
  • Mantido durante a época desportiva
  • Eliminado automaticamente 12 meses após saída do clube

⚖️ SEUS DIREITOS:
  • Direito de acesso aos seus dados
  • Direito de rectificação se estiverem incorretos
  • Direito de apagamento ("direito ao esquecimento")
  • Direito de revogar este consentimento em qualquer momento
    (sem afetar processamento anterior)
  • Direito de reclamação junto da CNPD (Portugal)

📞 CONTACTOS:
  • Responsável de Proteção de Dados do Clube: [DPO Email]
  • CNPD (Portugal): www.cnpd.pt | telefone +351 21 392 84 00

═════════════════════════════════════════════════════════════════

Concordo em fornecer dados de bem-estar conforme descrito acima.

[ ] Sim, autorizo a recolha de dados de bem-estar
[ ] Não, recuso a recolha de dados de bem-estar

Data: ____/____/______
```

**English (Secondary):**

```
╔════════════════════════════════════════════════════════════════╗
║  CONSENT FOR WELLNESS DATA COLLECTION                        ║
║  GDPR Art. 9(2)(a) — Special Categories of Personal Data     ║
╚════════════════════════════════════════════════════════════════╝

[CLUB NAME] wishes to process the following wellness data 
to optimize your training and monitor your health:

📋 DATA COLLECTED:
  ✓ Mood (scale 1–5)
  ✓ Muscle pain (location: knee, shoulder, etc.)
  ✓ Sleep quality
  ✓ Energy perception
  ✓ Concentration
  ✓ Emotional state
  ✓ Scheduled exams/tests

🎯 PURPOSES:
  • Athlete wellness monitoring
  • Individual training load optimization
  • Injury prevention
  • Sports performance analysis
  • Lineup/squad selection decisions

👥 WHO HAS ACCESS:
  • Club technical staff (coach, analyst)
  • No third-party sharing

📅 RETENTION PERIOD:
  • Retained during the sports season
  • Automatically deleted 12 months after leaving the club

⚖️ YOUR RIGHTS:
  • Right to access your data
  • Right to correct inaccurate data
  • Right to erasure ("right to be forgotten")
  • Right to withdraw consent at any time
  • Right to lodge a complaint with your data authority

═════════════════════════════════════════════════════════════════

I agree to provide wellness data as described above.

[ ] Yes, I authorize wellness data collection
[ ] No, I refuse wellness data collection

Date: ____/____/______
```

---

## 5. Implementação Técnica

### 5.1 Nova Tabela: `wellness_consents`

```sql
CREATE TABLE wellness_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES clubs(id),
  player_id uuid NOT NULL REFERENCES players(id),
  consent_given boolean NOT NULL,  -- true = yes, false = explicit refuse
  consent_version varchar(10) NOT NULL,  -- e.g. "1.0", "2.0" (for future policy changes)
  consent_modal_text_language varchar(2) NOT NULL DEFAULT 'pt',  -- 'pt' or 'en'
  given_at timestamp NOT NULL DEFAULT now(),
  revoked_at timestamp,  -- NULL = still valid; NOT NULL = revoked
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_club_player_same_club 
    FOREIGN KEY (club_id, player_id) REFERENCES players(club_id, id),
  CONSTRAINT chk_revoke_after_given 
    CHECK (revoked_at IS NULL OR revoked_at >= given_at)
);

-- Index for quick lookups
CREATE INDEX idx_wellness_consent_player 
  ON wellness_consents(player_id, club_id, revoked_at) 
  WHERE revoked_at IS NULL;

-- RLS
ALTER TABLE wellness_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wellness_consents_select" ON wellness_consents
  FOR SELECT
  USING (
    club_id = auth.club_id()
    AND (
      auth.user_role() IN ('coach', 'analyst')
      OR (auth.user_role() = 'player' AND player_id = auth.uid())
    )
  );

CREATE POLICY "wellness_consents_insert_update" ON wellness_consents
  FOR INSERT
  WITH CHECK (club_id = auth.club_id());
```

### 5.2 Fluxo de Consentimento (Onboarding)

1. **Primeiro Login:** App exibe modal "Wellness Data Collection"
2. **Player Selects:** "Yes" ou "No"
3. **Backend Inserts:** Row em `wellness_consents` com `consent_given = true|false`
4. **Subsequent Sessions:** 
   - If `consent_given = true` → Permite inserir em `fatigue_responses`
   - If `consent_given = false` → Bloqueia campos de bem-estar (mood, dores, etc.); permite apenas sRPE_value
5. **Revogação:** Player clica "Revogar Consentimento" → `revoked_at = now()`

### 5.3 Backend Check (Insert Trigger)

```sql
CREATE OR REPLACE FUNCTION check_wellness_consent_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  consent_exists boolean;
BEGIN
  -- Check if player has active wellness consent
  SELECT EXISTS(
    SELECT 1 FROM wellness_consents
    WHERE player_id = NEW.player_id
      AND club_id = NEW.club_id
      AND consent_given = true
      AND revoked_at IS NULL
  ) INTO consent_exists;
  
  -- If attempting to insert wellness fields without consent, REJECT
  IF (NEW.mood_score IS NOT NULL 
      OR NEW.muscle_pain_zones IS NOT NULL 
      OR (NEW.phase = 'pre' AND NEW.has_exams_this_week = true))
     AND NOT consent_exists
  THEN
    RAISE EXCEPTION 'Wellness consent required for mood, muscle_pain_zones, or exams fields';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wellness_consent_check
  BEFORE INSERT ON fatigue_responses
  FOR EACH ROW
  EXECUTE FUNCTION check_wellness_consent_before_insert();
```

---

## 6. Data Retention & Deletion

### Política de Apagamento (GDPR Art. 17)

| Evento | Ação | Prazo |
|--------|------|-------|
| Player revoga consentimento | Anonymize/Delete mood, dores, exames | 30 dias |
| Player sai do clube | Retain durante época + 12 meses | 12 meses |
| Player requere apagamento | Delete todos os dados pessoais | 30 dias (GDPR legal requirement) |
| Final da época | Auto-archive dados históricos | 12 meses pós-término |

**Implementação:**
```sql
-- Revogação de Consentimento → Apagamento Automático
CREATE OR REPLACE FUNCTION anonymize_wellness_on_revoke()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    -- Anon: Set wellness fields to NULL for all responses by this player
    UPDATE fatigue_responses
    SET 
      mood_score = NULL,
      muscle_pain_zones = NULL,
      has_exams_this_week = NULL,
      updated_at = now()
    WHERE player_id = NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wellness_revoke_anon
  AFTER UPDATE ON wellness_consents
  FOR EACH ROW
  EXECUTE FUNCTION anonymize_wellness_on_revoke();
```

---

## 7. Documentação de Compliance

### 7.1 Privacy Notice (Incluir no App)

**Localização:** Settings → Privacy & Data → Wellness Data FAQ

**Conteúdo Mínimo:**
- Explicação de Art. 9 em linguagem simples
- Enumeração de cada campo e porque é processado
- Direitos GDPR (Art. 15–22)
- Contacto DPO
- Link para CNPD

### 7.2 Data Processing Agreement (Clube ↔ Atletas)

**Recomendação:** Incluir texto de consentimento em:
1. Contrato de filiação/adesão ao clube
2. Modal de consentimento digital (App)
3. Privacy Notice acessível no app

---

## 8. Risk Assessment (DPIA Lite)

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| **Atleta recusa consentimento** | Alta | Baixo | Permitir treino sem wellness fields; apenas sRPE |
| **Dados vazados (mood/dores)** | Média | Alto | Encryption-at-rest; RLS rigorosa; backup segregado |
| **Automatizado decisões de treino com base em mood** | Média | Alto | Documentar: mood é _input_ para decisão humana, não automatizado |
| **Falta de consentimento escrito** | Baixa | Crítico | Guardar `wellness_consents` com timestamp; auditoria mensal |
| **Player solicita apagamento (Art. 17)** | Média | Médio | Função de anon automática; prazo 30 dias; log de compliance |

---

## 9. Decisão Legal

### ✅ APROVADO

**Conclusão:** Implementar consentimento explícito (Art. 9(2)(a)) para dados de bem-estar.

**Condicionalidades:**
1. ✅ Modal de consentimento traduzido (PT + EN)
2. ✅ Tabela `wellness_consents` com auditoria completa
3. ✅ Trigger de validação antes de insert de campos wellness
4. ✅ Trigger de anonimização automática ao revogar
5. ✅ Privacy Notice acessível no app
6. ✅ DPO designado do clube (responsável por contacto GDPR)

**Responsabilidades:**
- **Club (Controlador):** Garantir DPO nomeado, guardar consentimentos, responder a SARs (Subject Access Requests)
- **App (Processador):** Implementar consentimento digital, triggers de anonimização, retenção conforme política

---

## 10. Timeline

- **Sprint 1.5:** Implementar `wellness_consents` table + triggers + modal
- **Pre-Launch:** DPO review de Privacy Notice + consentimento modal
- **Go-Live:** Exibir modal de consentimento a todos os jogadores

---

## Contactos & Próximos Passos

| Contacto | Função | Ação |
|----------|--------|------|
| **DPO do Clube** | Revisão antes do deploy | Confirmar Privacy Notice |
| **Legal** | Revisão contratual | Validar linguagem consentimento |
| **DevOps** | Segurança de dados | Encryption-at-rest para `wellness_consents` |

**Assinado:** Legal & Compliance Team  
**Data:** 2026-05-09  
**Versão:** 1.0  
**Próxima Revisão:** Após 1º mês de produção (audit de consentimentos)
