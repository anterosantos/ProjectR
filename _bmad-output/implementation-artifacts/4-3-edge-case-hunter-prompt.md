# Edge Case Hunter Review — Story 4.3

**Role:** Edge Case Hunter (project read access + diff)

You have read-only access to the codebase. Your job: Walk every branching path, boundary condition, and state transition in the diff. Find unhandled edge cases and unusual behavior.

---

## Changes Summary

Story 4.3 adds i18n support for fatigue questionnaire (u14 age group variant).

**Key files:**
1. New: `src/lib/i18n/pt-PT/fatigue.ts` — copy variants (senior, u14)
2. Modified: `fatigue-questionnaire.tsx` — ageGroup prop + i18n integration
3. Modified: `fatigue-slider.tsx` — ageGroup prop (pass-through)
4. Test additions for both components

---

## Edge Cases to Explore

### 1. Null / Undefined / Empty String Handling

**Boundary:** `getFatigueCopy(ageGroup?: string)`

```typescript
export function getFatigueCopy(ageGroup?: string): FatigueCopySet {
  if (ageGroup === "u14" || ageGroup === "u15") return FATIGUE_COPY.u14;
  return FATIGUE_COPY.senior;
}
```

- What if `ageGroup = null`? → Falls through to senior (likely correct, but verify with page.tsx caller)
- What if `ageGroup = ""`? (empty string) → Falls through to senior (correct)
- What if `ageGroup = "U14"`? (uppercase) → Falls through to senior (case-sensitive, may be unintended)
- What if `ageGroup = "u14\n"` or `"u14 "` (whitespace)? → Falls through to senior
- What if `ageGroup = 123` or object? (not a string) → Type system prevents it, but runtime?

**Recommendation:** Check if page.tsx normalizes `player.age_group` before passing.

---

### 2. Array Access Without Checks

**In fatigue-questionnaire.tsx:**

```typescript
{copy.dimensions.map((dim) => (
  <FatigueSlider
    key={dim.key}
    id={`slider-${dim.key}`}
    label={dim.label}
    minLabel={dim.minLabel}
    maxLabel={dim.maxLabel}
    // ...
  />
))}
```

- What if `copy.dimensions` is `undefined` or `null`? → `.map()` throws error
- What if `copy.dimensions` is an empty array `[]`? → Renders zero sliders (valid, but unusual)
- What if `dim.key`, `dim.label`, etc. are missing? → Type system should prevent, but verify

**Evidence:** fatigue.ts line 44–50 shows u14 dimensions are always an array with 5 items. Senior is identical count. Both hardcoded, so edge case is unlikely.

**Recommendation:** Confirm that `FatigueCopySet.dimensions` type is `readonly FatigueDimensionCopy[]` (non-optional, non-nullable).

---

### 3. Conditional Rendering of Help Text

**In fatigue-questionnaire.tsx:**

```typescript
{copy.helpText && (
  <p className="text-sm ...">
    {copy.helpText}
  </p>
)}
```

- What if `copy.helpText = ""`? (empty string) → Renders nothing (falsy check catches it) ✓
- What if `copy.helpText = 0` or `false`? → Won't render (but shouldn't happen per spec)
- What if `copy.helpText = null`? → Won't render ✓ (correct per spec: senior has `null`)

**Verdict:** Conditional rendering is correct.

---

### 4. Prop Passing to Child Components

**FatigueSlider receives ageGroup prop:**

```typescript
<FatigueSlider
  key={dim.key}
  id={`slider-${dim.key}`}
  label={dim.label}
  minLabel={dim.minLabel}
  maxLabel={dim.maxLabel}
  min={1}
  max={5}
  value={values[dim.key]}
  onChange={(v) => handleChange(dim.key, v)}
  disabled={isSubmitting}
  ageGroup={ageGroup}  // ← NEW
/>
```

- `ageGroup` is passed directly from parent (no default applied by FatigueQuestionnaire, which has `default: "senior"`)
- What if parent has `ageGroup` undefined but FatigueSlider expects a string? → TypeScript allows `undefined`, component docstring says it's informational
- **Edge case:** If FatigueQuestionnaire passes `ageGroup={undefined}`, FatigueSlider receives `undefined` (not `"senior"`). Is this handled?

**Check:** Does FatigueSlider component body use `ageGroup`? (Answer: No, it's pass-through per comments)

**Verdict:** Safe, but parent should ensure `ageGroup` has a default before passing.

---

### 5. Type Safety: `as const satisfies`

**In fatigue.ts:**

```typescript
export const FATIGUE_COPY = {
  senior: { ... },
  u14: { ... },
} as const satisfies Record<string, FatigueCopySet>;
```

- `as const` locks the object shape to literal types
- `satisfies` validates against `Record<string, FatigueCopySet>` at compile time
- **Edge case:** What if someone adds a new key like `u13: {...}` and forgets to update `getFatigueCopy()`? → Function won't match, falls back to senior (safe, but not ideal)

**Verdict:** Type-safe pattern, but runtime doesn't validate. Consider adding a type-level exhaustiveness check.

---

### 6. Missing page.tsx Changes?

**Spec Task 4:** "Update `page.tsx` to derive and pass `ageGroup`"

The diff does NOT include `page.tsx` changes. 

**Critical edge case:** If `page.tsx` doesn't pass `ageGroup` prop, all users will render as `"senior"` variant. Is this intentional (deferred to next PR)?

**Recommendation:** Verify that page.tsx was already updated in Story 4.2 or earlier, OR this change is incomplete.

---

## Test Coverage Edge Cases

### fatigue-slider.test.tsx

```typescript
it("aceita prop ageGroup='u14' sem erro", () => {
  render(
    <FatigueSlider
      {...defaultProps}
      ageGroup="u14"
      // ...
    />
  );
  // ...
});
```

- Tests pass `ageGroup="u14"` with custom labels
- **Missing test:** `ageGroup={undefined}` (default case from parent)
- **Missing test:** `ageGroup=""` (empty string)

### fatigue-questionnaire.test.tsx

```typescript
it("renderiza labels simplificados para dim_energy", async () => {
  await renderAndSettle({ ...BASE_PROPS, ageGroup: "u14" });
  // ...
});
```

- Tests cover `ageGroup="u14"`
- **Missing test:** No explicit test for `ageGroup="senior"` (implicit in BASE_PROPS)
- **Missing test:** What if `player.age_group = "u15"`? (Should map to u14 copy, but is it tested?)

---

## Output Format

List findings as Markdown. For each edge case:
- **Title** (one line)
- **Boundary/Condition:** What specific edge case triggers this?
- **Impact:** What happens? Is it handled?
- **Evidence:** Code location or test gap
- **Recommendation:** How to fix or verify

Example:
```
## Empty ageGroup string
**Boundary:** `getFatigueCopy("")`
**Impact:** Falls through to senior copy (likely intended)
**Evidence:** fatigue.ts line 64–65; no test for empty string
**Recommendation:** Verify page.tsx never passes empty string; add test for safety.
```

---

**Submit your findings here or paste back when done.**
