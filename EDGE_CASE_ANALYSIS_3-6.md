# Edge Case Analysis: Story 3-6 Right-to-Export CSV Download

**Analysis Date:** 2026-05-22  
**Component:** Data Export (RGPD Art. 20)  
**Scope:** Server Actions (`requestDataExportForSelf`, `requestDataExportByToken`), Edge Function (`export-csv`), Client UI Components

---

## Critical Edge Cases

### 1. **Player Email Not Available for Async Path**
- **Scenario:** Export exceeds 5MB (async path), but player record has `NULL` email field
- **Current Handling:** Line 286 in `export-csv/index.ts` hardcodes recipient as `brevoSenderEmail` (the SPARTA sender email) instead of player's email. Comment says "recipient resolved from player profile if available" but this is NOT implemented.
- **Risk:** HIGH
- **Impact:** Email sent to staff mailbox instead of player; player never receives export link; cannot access their data within 7-day window
- **Recommendation:** 
  - Fetch player email from `profiles` table and fall back to a queue/notification system if NULL
  - Validate email format before sending to Brevo
  - Log failed email sends to a retry table for manual staff follow-up

---

### 2. **Race Condition: Multiple Simultaneous Export Requests**
- **Scenario:** User clicks "Export" button twice rapidly, or same token used from two browser tabs
- **Current Handling:** No idempotency key, no duplicate request detection
- **Risk:** HIGH
- **Impact:** 
  - Two separate ZIP files generated and stored
  - Storage quota consumed (if 5MB × 2 = 10MB)
  - Duplicate audit logs
  - Two async emails sent (if async path)
  - User confusion about which file is current
- **Recommendation:** 
  - Add request deduplication in Server Action (check for in-flight request per playerId)
  - Implement idempotency key in Edge Function (playerId + timestamp epoch shard)
  - Return existing signed URL if export already in progress

---

### 3. **ZIP File Size Threshold Boundary at Exactly 5MB**
- **Scenario:** ZIP exactly 5,242,880 bytes (5 * 1024 * 1024)
- **Current Handling:** Line 274: `zipBytes.length > 5 * 1024 * 1024` — greater-than check
- **Risk:** MEDIUM
- **Impact:** At exactly 5MB, uses sync path (returns signed URL). One byte over triggers async path (no URL, async=true). Inconsistent UX at boundary.
- **Recommendation:** 
  - Document why threshold is 5MB (email attachment limit?)
  - Consider adding buffer (e.g., 4.5MB) to be safe
  - Test both sync and async paths at boundary

---

### 4. **Empty CSV Files When Player Has No Data**
- **Scenario:** Player record exists but has no entries in any data tables (new player, no metrics, no consents)
- **Current Handling:** `rowsToCsv([])` returns empty string (line 13); ZIP contains empty CSVs and README only
- **Risk:** LOW
- **Impact:** User downloads ZIP with only README and empty CSV files. Expected behavior but may confuse users.
- **Recommendation:** 
  - Include player_id in README for verification
  - Add note in UI: "Export will include only tables with available data"
  - Add validation in rowsToCsv to return just headers for empty tables

---

### 5. **Service Role Key Exposed in Error Logs**
- **Scenario:** Network timeout or fetch error while calling `/functions/v1/export-csv`
- **Current Handling:** Lines 37-38 log `status` only, but JSON body parsing on line 41 could expose details if error payload contains sensitive info
- **Risk:** MEDIUM
- **Impact:** Error details logged in server logs; potential exposure of credentials or internal structure
- **Recommendation:** 
  - Never log response body
  - Sanitize error messages returned to client
  - Rotate service role key periodically

---

### 6. **Token Validation Server Roundtrip on Public Page**
- **Scenario:** User loads `/direitos/[token]/exportar` → server calls `validate-subject-token` → Edge Function hangs or returns 500
- **Current Handling:** Page renders error state (lines 56-74), but no retry mechanism; user must refresh manually
- **Risk:** MEDIUM
- **Impact:** Page load blocks on Edge Function; timeout at server level (default ~30s); poor UX if Supabase is slow
- **Recommendation:** 
  - Add timeout guard (e.g., 10-second max)
  - Render optimistic UI if validation times out (allow retry client-side)
  - Cache token validation for 60-120 seconds to avoid repeated roundtrips

---

### 7. **Token Regex Allows Tokens Up to 256 Characters**
- **Scenario:** Attacker sends token with 256 valid characters (legitimate per regex `/^[a-zA-Z0-9_-]{1,256}$/`)
- **Current Handling:** Regex accepts 1-256 chars; Edge Function receives token in body
- **Risk:** MEDIUM
- **Impact:** Large tokens increase payload size; no validation of actual token existence until Edge Function call
- **Recommendation:** 
  - Enforce tighter length bound (e.g., 32-64 chars) if actual tokens are shorter
  - Validate token format and length in `requestDataExportByToken` before fetch

---

### 8. **Missing Environment Variables at Runtime**
- **Scenario:** 
  - Production deployment missing `BREVO_API_KEY` or `BREVO_SENDER_EMAIL` (misconfigured)
  - Async export triggered but credentials absent
- **Current Handling:** Lines 278-303: Fire-and-forget proceeds without email; logged as warning
- **Risk:** HIGH (for async path, MEDIUM for sync path)
- **Impact:** Player never receives export link in async flow; silent failure; no retry
- **Recommendation:** 
  - Validate Brevo credentials at Edge Function startup
  - If async export but no credentials, return error instead of silent success
  - Consider adding a fallback: queue message to staff if Brevo unavailable

---

### 9. **Player Table Query Uses Hardcoded Full Name**
- **Scenario:** Player record exists but `full_name` is NULL, empty string, or contains only whitespace
- **Current Handling:** Line 128: `playerName = playerRow?.full_name ?? playerId` — falls back to playerId
- **Risk:** LOW
- **Impact:** README shows UUID instead of player name; UI displays "Exportar dados de <uuid>"
- **Recommendation:** 
  - Sanitize and validate full_name in README generation
  - Trim whitespace
  - Add fallback display name: "Jogador" instead of raw UUID

---

### 10. **Audit Log Insert May Fail Silently**
- **Scenario:** `audit_logs` table insert fails (e.g., RLS denial, connection error)
- **Current Handling:** Lines 268-272: No error check on insert result
- **Risk:** MEDIUM
- **Impact:** Export completes but audit trail missing; RGPD Art. 32 compliance gap
- **Recommendation:** 
  - Check `error` field on insert response
  - Log audit log failures explicitly
  - Consider audit log write as critical; fail export if insert fails

---

### 11. **Signed URL Generation Fails After Successful Upload**
- **Scenario:** Upload succeeds, but storage signed URL creation fails (e.g., Supabase storage service down)
- **Current Handling:** Lines 253-263: Returns error response
- **Risk:** MEDIUM
- **Impact:** Orphaned ZIP file in storage (consumes quota); user sees error; no way to retrieve file
- **Recommendation:** 
  - Implement cleanup: delete file if signing fails
  - Add admin cleanup job to remove orphaned exports older than 7 days
  - Consider backup signing mechanism (e.g., alternative key)

---

### 12. **Profile Table Query Uses Wrong Column Name**
- **Scenario:** Edge Function queries `profiles` table with `id = playerId`, but schema may expect `user_id` or different structure
- **Current Handling:** Lines 141-151: Error caught and logged; CSV omitted
- **Risk:** LOW (error handling exists)
- **Impact:** `profiles.csv` skipped silently
- **Recommendation:** 
  - Validate schema in migration or test
  - Add explicit test: verify profiles.csv included for self-export

---

### 13. **JSZip.generateAsync() May Exceed Memory or Timeout**
- **Scenario:** 
  - Large ZIP (e.g., 20MB uncompressed data across many tables)
  - JSZip compression takes >30 seconds
- **Current Handling:** No timeout; no memory limit
- **Risk:** HIGH
- **Impact:** Edge Function hangs → user timeout → partial ZIP uploaded or no upload
- **Recommendation:** 
  - Add timeout guard for generateAsync (e.g., 30-second abort)
  - Streaming ZIP generation for very large exports
  - Consider chunked table processing

---

### 14. **Blob Constructor May Fail on Edge**
- **Scenario:** Deno runtime behavior differs from Node; `Blob` constructor may not support `buffer as ArrayBuffer` cast
- **Current Handling:** Lines 237-238: Comment notes type cast required
- **Risk:** MEDIUM
- **Impact:** ZIP generation fails at blob creation; user gets error
- **Recommendation:** 
  - Test in actual Deno environment
  - Use `new Blob([zipBytes])` directly (no buffer cast)
  - Add explicit test: export-csv handler in Deno runtime

---

### 15. **CSV Escape Logic Does Not Handle ALL Edge Cases**
- **Scenario:** 
  - CSV value contains only quotes: `""`
  - Value contains carriage return (`\r`) without newline
  - Value contains null bytes or control characters
- **Current Handling:** Lines 15-19: Escapes quotes and checks for comma, quote, newline
- **Risk:** LOW (CSV parsing usually tolerant)
- **Impact:** CSV corruption or parsing errors in some readers
- **Recommendation:** 
  - Add explicit test: rowsToCsv with edge case values
  - Consider escaping carriage returns: `\r\n` normalization
  - Document CSV dialect (RFC 4180 compliance)

---

### 16. **No Maximum Number of Tables in ZIP**
- **Scenario:** Schema evolves; 50+ tables added, each with 1000+ rows
- **Current Handling:** No limit on ZIP contents
- **Risk:** MEDIUM
- **Impact:** ZIP generation timeout, storage quota exceeded, memory spike
- **Recommendation:** 
  - Set table count limit (e.g., max 20 tables)
  - Set row limit per table (e.g., max 10k rows per table)
  - Document limits in README

---

### 17. **Fetch Timeout to Export-CSV Edge Function Not Set**
- **Scenario:** Edge Function hangs for 60+ seconds
- **Current Handling:** Default Node fetch timeout (no explicit timeout set)
- **Risk:** HIGH
- **Impact:** Server Action hangs; request times out; client never receives response; user page freezes
- **Recommendation:** 
  - Add explicit AbortController with 30-second timeout
  - Wrap in try/catch for timeout error
  - Return `async: true, url: undefined` on timeout (deferred export)

---

### 18. **Duplicate Table Handling in includedTables Array**
- **Scenario:** Code path includes same table twice (e.g., profiles queried separately, then in a loop)
- **Current Handling:** Lines 131-232: No deduplication; includedTables could have duplicates
- **Risk:** LOW
- **Impact:** README lists "profiles" twice; confusing output
- **Recommendation:** 
  - Use Set instead of array for includedTables
  - Or add guard: `if (!includedTables.includes(tableName))`

---

### 19. **Brevo Fire-and-Forget Error Swallowed**
- **Scenario:** Brevo fetch fails with network error; Promise.catch silently logs
- **Current Handling:** Lines 294-300: Error logged but request already returned success to user
- **Risk:** MEDIUM
- **Impact:** User receives async success response but email never sent; user waits for email that will never arrive
- **Recommendation:** 
  - Store pending exports in DB with status (pending_email, sent, failed)
  - Implement retry queue for failed emails
  - Send staff alert if email send fails

---

### 20. **Player Authorization Not Verified for Own Data**
- **Scenario:** User calls `requestDataExportByToken(stolen_token)` where token points to a different player
- **Current Handling:** Edge Function `validate-subject-token` handles authorization; but if validation is weak, attacker gets other player's data
- **Risk:** HIGH (depends on validate-subject-token security)
- **Impact:** RGPD breach; unauthorized data disclosure
- **Recommendation:** 
  - Audit validate-subject-token Edge Function (out of scope for this review but critical)
  - Log all export requests with token origin
  - Implement request signing to prevent token tampering

---

### 21. **No Storage Bucket RLS Policy Defined**
- **Scenario:** Unsigned request to storage bucket could bypass signed URL
- **Current Handling:** Bucket is private (line 4 in migration: `public = false`), but no explicit RLS policies
- **Risk:** MEDIUM
- **Impact:** If RLS not enforced, unauthorized access to exports
- **Recommendation:** 
  - Add explicit storage bucket RLS: allow service role to write, public to read signed URLs only
  - Test: verify unsigned requests are rejected

---

### 22. **README File Not Included in Sync Path Return Value**
- **Scenario:** User gets signed URL for sync export; downloads ZIP; README present but not mentioned in UI
- **Current Handling:** README always added (line 234); included in all ZIPs
- **Risk:** LOW
- **Impact:** Good default, but undocumented
- **Recommendation:** 
  - Update UI: "Your download includes a README.txt with details"

---

### 23. **7-Day Signed URL Expiry Hard-Coded**
- **Scenario:** User downloads file on day 6; loses internet; returns on day 8
- **Current Handling:** Line 255: `createSignedUrl(path, 604800)` — 604800 = 7 days in seconds
- **Risk:** LOW (documented in UI, email)
- **Impact:** Expected behavior but could improve to 14 days for better UX
- **Recommendation:** 
  - Consider longer TTL (14 days) for large exports
  - Document in README and UI

---

### 24. **No Handling for Concurrent Table Schema Changes**
- **Scenario:** During export:
  - Thread 1: fetches players data
  - Schema migration: adds/removes column
  - Thread 2: fetches player_metrics
  - Column mismatch in CSV headers
- **Current Handling:** No transaction; each table fetched independently
- **Risk:** LOW-MEDIUM
- **Impact:** Inconsistent CSV headers across files; parsing errors
- **Recommendation:** 
  - Wrap all table queries in single transaction
  - Or add schema version to README

---

### 25. **Client Component Doesn't Validate Response URL**
- **Scenario:** Server Action returns `url: "javascript:alert('xss')"`
- **Current Handling:** Lines 46, 56 in client components: used directly in `href`
- **Risk:** LOW (URL comes from signed Supabase, but still)
- **Impact:** XSS if server compromised
- **Recommendation:** 
  - Validate URL starts with `https://`
  - Verify URL hostname matches expected domain

---

## Summary Table

| ID | Title | Risk | Status | Priority |
|--|--|--|--|--|
| 1 | Player Email Not Available | HIGH | Unhandled | P0 |
| 2 | Race Condition: Multiple Exports | HIGH | Unhandled | P0 |
| 3 | ZIP Size Boundary (5MB) | MEDIUM | Design | P1 |
| 4 | Empty CSV Files | LOW | Handled | P2 |
| 5 | Service Role in Logs | MEDIUM | Partially | P1 |
| 6 | Token Validation Roundtrip | MEDIUM | Unhandled | P1 |
| 7 | Token Length Validation | MEDIUM | Unhandled | P1 |
| 8 | Missing Brevo Credentials | HIGH | Partially | P0 |
| 9 | Player Name Null/Whitespace | LOW | Handled | P2 |
| 10 | Audit Log Insert Failure | MEDIUM | Unhandled | P1 |
| 11 | Signed URL Generation Fails | MEDIUM | Handled | P1 |
| 12 | Profile Table Query Error | LOW | Handled | P2 |
| 13 | ZIP Generation Timeout | HIGH | Unhandled | P0 |
| 14 | Blob Constructor Issue | MEDIUM | Partially | P1 |
| 15 | CSV Escape Edge Cases | LOW | Partial | P2 |
| 16 | No Max Table Limit | MEDIUM | Unhandled | P1 |
| 17 | Fetch Timeout to Edge | HIGH | Unhandled | P0 |
| 18 | Duplicate Tables in README | LOW | Unhandled | P2 |
| 19 | Brevo Email Fire-and-Forget | MEDIUM | Unhandled | P1 |
| 20 | Token Authorization Bypass | HIGH | Depends | P0 |
| 21 | Storage RLS Missing | MEDIUM | Unhandled | P1 |
| 22 | README Not Documented | LOW | Expected | P3 |
| 23 | 7-Day TTL Hard-Coded | LOW | Expected | P3 |
| 24 | Schema Changes During Export | LOW-MEDIUM | Unhandled | P2 |
| 25 | XSS in Return URL | LOW | Likely Safe | P3 |

---

## Recommended Immediate Actions (P0)

1. **Implement player email resolution** for async exports (ID #1)
2. **Add request deduplication** per playerId (ID #2)
3. **Add fetch timeout** (30s) to Edge Function call (ID #17)
4. **Validate Brevo credentials** at Edge Function startup (ID #8)
5. **Add timeout guard** for ZIP generation (ID #13)
6. **Audit token authorization** in validate-subject-token (ID #20)

---

## Testing Recommendations

- [ ] Test with player having NULL email
- [ ] Test double-click export (race condition)
- [ ] Test export near 5MB boundary
- [ ] Test with missing Brevo credentials
- [ ] Test with 1000+ rows per table
- [ ] Test with simulate network timeout to Edge Function
- [ ] Test storage bucket RLS (unsigned request rejection)
- [ ] Test CSV escaping with quotes, newlines, commas
- [ ] Test async email delivery (Brevo webhook confirmation)
- [ ] Load test: 100 concurrent exports

