# Health Data Access Audit Logging

**Reference:** Story 3.11 — Health Data Access Audit Logging (Auto-Wrapper for Staff Reads)

This guide explains how to use the `auditedRead()` wrapper to ensure all staff access to health data is automatically logged for GDPR compliance (FR50, AR21).

---

## When to Use auditedRead()

Use `auditedRead()` whenever a **Server Action** or **Edge Function** reads health data on behalf of a staff member. The wrapper ensures an audit log is created immediately after the read, without blocking the read operation.

**Health data tables requiring audit:**
- `fatigue_responses` — Player fatigue ratings
- `match_events` — Match performance events
- `readiness_snapshots` — Readiness assessment snapshots
- `session_metrics` — Session performance metrics

**Who triggers auditing:**
- Staff members (treinador, analista) reading data for coaching/analysis
- System does NOT audit:
  - Player views of their own data (separate consent/RLS protection)
  - Batch jobs without active sessions
  - Internal migrations or anonymization jobs

---

## Detailed Example

### Scenario: Staff views player fatigue response

```typescript
// ✅ CORRECT: Staff action reading player fatigue data
// File: src/lib/actions/health-data.ts

import { auditedRead } from "@/lib/data/audited";
import { createServerClient } from "@/lib/supabase/server";

export async function getPlayerFatigueResponse(
  playerId: string,
  sessionId: string
) {
  // Wrap the read operation with auditedRead()
  const response = await auditedRead(
    {
      targetKind: "fatigue_response",
      targetId: playerId,
      action: "viewed_fatigue_response",
      payload: {
        session_id: sessionId,
        // Optional: include context for analysis
        read_context: "coach_dashboard",
      },
    },
    async () => {
      // Your actual read logic here
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("fatigue_responses")
        .select("*")
        .eq("player_id", playerId)
        .eq("session_id", sessionId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch fatigue response: ${error.message}`);
      }

      return data;
    }
  );

  return response;
}
```

### Another Example: Match events read

```typescript
// ✅ CORRECT: Staff reads match events
export async function getMatchEvents(
  matchId: string,
  sessionId: string
) {
  const events = await auditedRead(
    {
      targetKind: "match_event",
      targetId: matchId,
      action: "read_match_events",
      payload: {
        session_id: sessionId,
      },
    },
    async () => {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("match_events")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch match events: ${error.message}`);
      }

      return data;
    }
  );

  return events;
}
```

---

## Fire-and-Forget Behavior

The `auditedRead()` wrapper follows a **fire-and-forget** pattern:

1. **Your code executes** the read operation (`fn()`)
2. **Result is returned immediately** to your code
3. **In the background**, an audit log is inserted asynchronously
4. **If audit insert fails**, a JSON error log is emitted to stdout (for ops monitoring), but your read is NOT affected

**Why is this safe?**

- **Read availability is critical** — we never compromise read latency for audit logging
- **Audit logs are important** — but losing a single log entry doesn't break the system
- **Structured error logging** — operations team can monitor audit failures via cloud logs
- **Retention policy** — 12-month retention via Story 1.12's pg_cron job captures long-term audit trail

---

## Anti-Patterns: What NOT to Do

### ❌ Direct query without auditedRead()

```typescript
// WRONG: Directly queries health table without audit
export async function getPlayerFatigue(playerId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("fatigue_responses")  // ❌ LINTER WILL FAIL
    .select("*")
    .eq("player_id", playerId);
  return data;
}
```

The ESLint rule `no-direct-health-data-read` will catch this at build time:
```
Error: Direct query of 'fatigue_responses' violates FR50 audit logging. Use auditedRead() wrapper instead.
```

### ❌ RPC call without auditedRead()

```typescript
// WRONG: Direct RPC call that accesses health data
const { data } = await supabase.rpc("get_fatigue_summary", { player_id: id });
// ❌ LINTER WILL WARN if RPC name hints at health data access
```

---

## Handling Errors

### Case 1: Read operation fails (fn() throws)

The error is propagated to your code, as expected:

```typescript
const response = await auditedRead(
  { targetKind: "fatigue_response", ... },
  async () => {
    // If this throws, caller receives the error
    const { data, error } = await supabase
      .from("fatigue_responses")
      .select("*")
      .single();

    if (error) {
      throw error; // Caller gets this error
    }

    return data; // Audit log is still inserted asynchronously
  }
);
```

### Case 2: Audit log insert fails

Your code never sees this error — it's logged to stdout in JSON format:

```json
{
  "timestamp": "2026-05-22T10:30:45Z",
  "level": "error",
  "message": "audit_log insert failed",
  "action": "viewed_fatigue_response",
  "target_kind": "fatigue_response",
  "target_id": "<player-uuid>",
  "actor_id": "<staff-uuid>",
  "error": "FK constraint violation",
  "context": "auditedRead wrapper"
}
```

**Operations team should monitor** these logs and alert if error rate spikes.

---

## Retention & GDPR Compliance

### Audit Log Retention

All audit logs (created by `auditedRead()` or other means) are retained for **12 months** via the `purge_audit_logs_older_than_12_months` pg_cron job (Story 1.12).

- **AC #5**: After 12 months, entries are automatically deleted
- **FR50 Compliance**: Staff access logs are auditable for 12 months
- **GDPR Art. 15**: Subject (player) can request access logs within 12-month window via Story 3.12

### Checking Audit Logs Manually

```sql
-- Example: See all fatigue responses read by staff user
SELECT
  id,
  actor_id,
  action,
  target_kind,
  target_id,
  payload,
  occurred_at
FROM audit_logs
WHERE target_kind = 'fatigue_response'
  AND target_id = '<player-uuid>'
ORDER BY occurred_at DESC
LIMIT 10;
```

---

## Testing auditedRead()

### Unit Tests

The `lib/data/audited.test.ts` file includes comprehensive tests:

```bash
npm run test -- src/lib/data/audited.test.ts --run
```

Tests cover:
- ✅ Correct audit log insertion
- ✅ Fire-and-forget failure handling
- ✅ No logging for system-internal jobs
- ✅ Concurrent reads (separate audit rows)
- ✅ Payload serialization
- ✅ Structured error logging

### Integration Tests

The `lib/data/audited.integration.test.ts` validates end-to-end behavior with a real Supabase test database.

---

## Summary

| Concept | Details |
|---------|---------|
| **Use When** | Staff reads health data (fatigue, match events, readiness, session metrics) |
| **How** | Wrap the read function with `auditedRead({ targetKind, targetId, action }, fn)` |
| **Latency Impact** | Fire-and-forget: ~0ms impact (audit logs asynchronously in background) |
| **Failure Mode** | Read succeeds; audit failure logs to stdout; read result unaffected |
| **Retention** | 12 months (Story 1.12 pg_cron job) |
| **GDPR** | FR50 (auditable logs), FR51 (subject visibility), AR21 (access logs) |
| **ESLint** | Rule `no-direct-health-data-read` prevents bypassing wrapper |

---

## References

- **FR50:** Sistema regista log auditável de cada acesso a dados de saúde por staff
- **FR51:** Titular pode consultar quem acedeu aos seus dados de saúde nos últimos 12 meses (Story 3.12)
- **AR21:** Tabela `audit_logs` com triggers para registo automático
- **NFR56:** Logs estruturados (JSON) para eventos críticos
- **Story 1.12:** Audit Logs & Telemetry Foundation Tables
- **Story 3.12:** Subject Visibility — Who Accessed My Health Data
