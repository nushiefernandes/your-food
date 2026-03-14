# 7B Rethink — Task Tracker

## Status
- [x] Phase A: Model aliases updated (index.js) — restart Claude Code to activate
- [x] Phase B: Opus 4.6 verified plan ✅
- [ ] **Step 1: milestones.js** — code done by Codex, tests incomplete (see below)
- [ ] Step 2: nudges.js companion guard
- [ ] Step 3: post-save Edge Function
- [ ] Step 4: Saved.jsx refactor
- [ ] Step 5: Integration tests

## Step 1 Open Items (do now)

### Real bug to fix
`checkMilestones(insights, null)` — `null` overrides default param, `null.includes()` throws TypeError.
Fix: `const ids = seenIds ?? []` inside `checkMilestones`, use `ids` throughout.

### Missing tests (add to milestones.test.js)
1. `checkMilestones(insights, null)` → no throw
2. `total_meals=100` → all 4 count milestones fire (intentional cascade)
3. `streak=31` → both streak_7 AND streak_30 fire
4. all milestones in seenIds → returns `[]`
5. `MILESTONES.find(m => m.id === 'meals_50').confetti === true` (guard confetti flags)
6. `MILESTONES.find(m => m.id === 'meals_10').confetti === false`

### Then commit Step 1 and move to Step 2.

## Step 2 — nudges.js
- Line 94: `!entry?.companions` → `!entry?.companions?.length`
- Add test: `companions=[]` returns null nudge

## Step 3 — post-save Edge Function
- New: `supabase/functions/post-save/index.ts`
- Extract `computeInsights` helper from `insights/index.ts`
- Atomic INSERT ON CONFLICT DO NOTHING RETURNING milestone
- Returns `{ insights, newMilestones }`

## Step 4 — Saved.jsx refactor
- Remove getEntry fallback (redirect if no router state)
- AbortController (not cancelled boolean)
- hasNavigated ref guard (prevents double-navigate)
- 2-timer: 4s hard cap + 1.5s min display after ready
- 3 state values: status/nudge/milestones
- Run /simplify after

## Step 5 — Integration tests (Saved.test.jsx)
- StrictMode double-mount → single milestone insert
- Redirect timing
- AbortController cleanup
