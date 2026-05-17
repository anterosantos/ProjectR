# TRIAGE — Story 2-1 Code Review Findings

## Input Status
- **Blind Hunter**: ✅ 9 findings (markdown format)
- **Edge Case Hunter**: ✅ 7 findings (path analysis)
- **Acceptance Auditor**: ✅ 5 AC violations
- **Failed layers**: None

---

## Normalized Findings (Deduplicated)

### 🔴 CRITICAL #1: createPlayer atomicidade comprometida
**Sources**: Blind #1, Edge #1, Auditor #1-2

INSERT player (linha 133-140) depois RPC positions (linha 159-162). Se RPC falha E delete falha, player órfão persiste. AC#3 exige: "se positions falhar, player é revertido". Sem transação explícita.

**Location**: `src/lib/actions/players.ts:131-170`  
**Classification**: `PATCH` — usar single RPC ou transação explícita

---

### 🔴 CRITICAL #2: updatePlayer RPC failure deixa inconsistência
**Sources**: Blind #2, Edge #2

UPDATE player (linha 190-198) depois RPC (linha 217-220). Se RPC falha, UPDATE já commitou — positions ≠ player data. Contraste com createPlayer que compensa (createPlayer não compensa também!). AC#5 requer atomicidade.

**Location**: `src/lib/actions/players.ts:172-229`  
**Classification**: `PATCH` — adicionar compensação ou single RPC

---

### 🔴 CRITICAL #3: archivePlayer missing logAccess
**Sources**: Blind #4, Auditor #3

createPlayer/updatePlayer chamam `logAccess()` (linha 226). archivePlayer (231-258) não chama. AC#5 estabelece padrão. FR50 exige audit trail para todas as mudanças. Audit trail incompleto.

**Location**: `src/lib/actions/players.ts:231-258`  
**Classification**: `PATCH` — adicionar `await logAccess("player.archived", "player", playerId)`

---

### 🟡 HIGH #4: RLS "player sees own record" nunca dispara (profile_id=NULL)
**Sources**: Blind #3, Edge #4

Migration policy (linha 93): `WHERE profile_id = auth.uid()`. Schema (linha 27): `profile_id NULLABLE`. Se NULL → policy FALSE → player nunca vê posições.

**Question**: É intencional? Impacta AC#1 (player access).

**Location**: `src/lib/supabase/migrations/000070_players_positions.sql:62-64`  
**Classification**: `DECISION_NEEDED` — clarificar intent: NULL = não tem profile yet? Ou bug?

---

### 🟡 HIGH #5: archivePlayer cross-club bypass (RLS-only)
**Sources**: Blind #9, Edge #6

UPDATE (249-252): `.eq("id", playerId)` sem `.eq("club_id", ...)`. Depende só de RLS. Se RLS falha, qualquer staff arquiva players de outro clube.

**Location**: `src/lib/actions/players.ts:249-252`  
**Classification**: `PATCH` — adicionar `.eq("club_id", userClubId)`

---

### 🟡 HIGH #6: Birthdate permite datas inválidas
**Sources**: Blind #8, Edge #7

Schema (linha 24): `z.string().date()` só valida formato. Permite futuro (2099) e 1800. Edge case: birthdate=2099, age_group=u14 → nonsensical.

**Location**: `src/lib/schemas/players.ts:24`  
**Classification**: `PATCH` — adicionar `refine((data) => differenceInYears(now, birthdate) between 4-100)`

---

### 🟡 HIGH #7: getPlayers RLS-only filter (missing explicit club scoping)
**Sources**: Blind #6

Query (57-61): `select("*, positions(*)")` sem `.eq("club_id", ...)`. RLS should filter mas no defense-in-depth.

**Location**: `src/lib/actions/players.ts:54-86`  
**Classification**: `PATCH` — adicionar explicit `.eq("club_id", ...)`

---

### 🟢 MEDIUM #8: logAccess fire-and-forget (observability)
**Sources**: Blind #7

updatePlayer (226): `await logAccess(...)` sem try-catch. Se falha, audit trail incompleto. Redirect happens regardless.

**Location**: `src/lib/actions/players.ts:226`  
**Classification**: `DEFER` — Story 1.12 allows fire-and-forget. Minor observability issue.

---

### 🟢 MEDIUM #9: sort_order mapping cosmetic
**Sources**: Blind #5, Edge #5

Schema max 5 posições (0-4 constraint). createPlayer mapeia com índice → works correctly (0,1,2,3,4 fits 0-4). Confusing but no bug.

**Location**: `src/lib/actions/players.ts:153-157`  
**Classification**: `DISMISS` — cosmetic, works correctly

---

### 🟢 MEDIUM #10: getPlayer wildcard select (type safety)
**Sources**: Edge #3

Query (95): `.select("*, positions(*)")` com cast (103). Schema mismatch possible. Should explicit select.

**Location**: `src/lib/actions/players.ts:88-104`  
**Classification**: `PATCH` — explicit select list

---

## Summary

| Category | Count | IDs |
|----------|-------|-----|
| DECISION_NEEDED | 1 | #4 (RLS profile_id intent) |
| PATCH | 7 | #1,#2,#3,#5,#6,#7,#10 |
| DEFER | 1 | #8 (observability) |
| DISMISS | 1 | #9 (cosmetic) |
| **ACTIONABLE** | **8** | |

---

## Severity Distribution

- 🔴 CRITICAL: 3 (atomicidade issues + missing audit)
- 🟡 HIGH: 4 (RLS gaps, cross-club, validation)
- 🟢 MEDIUM: 2 (observability, type safety)

---

## Status: ❌ BLOCKERS DETECTED

**Story 2-1 CANNOT MERGE** until:
1. ✋ **DECISION**: RLS profile_id intent clarified (#4)
2. ✋ **PATCH**: createPlayer + updatePlayer atomicidade fixed (#1, #2)
3. ✋ **PATCH**: archivePlayer + audit logging fixed (#3)
4. ✋ **PATCH**: Cross-club bypass + validation fixed (#5, #6)

Recommendations below in Step 4.
