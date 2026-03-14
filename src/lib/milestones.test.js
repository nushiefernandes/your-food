import { describe, it, expect } from 'vitest'
import { checkMilestones, MILESTONES } from './milestones'

const makeInsights = (overrides = {}) => ({
  meta: { total_meals: 1, ...overrides.meta },
  timing: { logging_streak: { current: 0, longest: 0 }, ...overrides.timing },
  eating: { cuisine_breakdown: [], ...overrides.eating },
  home_vs_out: { cooking_ratio: { home_count: 0 }, ...overrides.home_vs_out },
  places: { geographic_range: { cities: [], count: 0 }, ...overrides.places },
})

describe('checkMilestones', () => {
  it('returns first_meal milestone on first entry', () => {
    const result = checkMilestones(makeInsights(), [])
    expect(result.some(m => m.id === 'first_meal')).toBe(true)
  })

  it('does not return already-seen milestones', () => {
    const result = checkMilestones(makeInsights(), ['first_meal'])
    expect(result.some(m => m.id === 'first_meal')).toBe(false)
  })

  it('returns meals_10 at exactly 10 meals', () => {
    const result = checkMilestones(makeInsights({ meta: { total_meals: 10 } }), [])
    expect(result.some(m => m.id === 'meals_10')).toBe(true)
  })

  it('does not return meals_10 at 11 meals (threshold is exact)', () => {
    const result = checkMilestones(makeInsights({ meta: { total_meals: 11 } }), [])
    expect(result.some(m => m.id === 'meals_10')).toBe(false)
  })

  it('returns streak_7 at current streak of exactly 7', () => {
    const result = checkMilestones(makeInsights({ timing: { logging_streak: { current: 7, longest: 7 } } }), [])
    expect(result.some(m => m.id === 'streak_7')).toBe(true)
  })

  it('returns cuisines_5 when 5+ cuisines in breakdown', () => {
    const cuisines = ['Italian', 'Indian', 'Japanese', 'Mexican', 'Thai']
      .map(c => ({ cuisine: c, count: 1, pct: 20 }))
    const result = checkMilestones(makeInsights({ eating: { cuisine_breakdown: cuisines } }), [])
    expect(result.some(m => m.id === 'cuisines_5')).toBe(true)
  })

  it('marks confetti=true for major milestones (50, 100, streak_30, first_meal)', () => {
    const result = checkMilestones(makeInsights({ meta: { total_meals: 50 } }), [])
    const m50 = result.find(m => m.id === 'meals_50')
    expect(m50?.confetti).toBe(true)
  })

  it('returns empty array when nothing triggers', () => {
    const result = checkMilestones(makeInsights({ meta: { total_meals: 3 } }), [])
    expect(result).toHaveLength(0)
  })

  // Catches M1: cuisines_5 uses >= not === — exactly 5 would pass both, but 6 only passes >=
  it('returns cuisines_5 when user has more than 5 cuisines (>= not ===)', () => {
    const cuisines = ['Italian', 'Indian', 'Japanese', 'Mexican', 'Thai', 'Chinese']
      .map(c => ({ cuisine: c, count: 1, pct: 16.7 }))
    const result = checkMilestones(makeInsights({ eating: { cuisine_breakdown: cuisines } }), [])
    expect(result.some(m => m.id === 'cuisines_5')).toBe(true)
  })

  // Catches M3: minor milestones (meals_10, meals_25) have confetti: false
  // — if any were accidentally set to true, celebration fires on routine saves
  it('marks confetti=false for minor meal-count milestones (10 and 25)', () => {
    const at10 = checkMilestones(makeInsights({ meta: { total_meals: 10 } }), [])
    const m10 = at10.find(m => m.id === 'meals_10')
    expect(m10?.confetti).toBe(false)

    const at25 = checkMilestones(makeInsights({ meta: { total_meals: 25 } }), [])
    const m25 = at25.find(m => m.id === 'meals_25')
    expect(m25?.confetti).toBe(false)
  })

  // Catches M5: meals_100 threshold is exactly 100, not 99
  it('returns meals_100 at exactly 100 meals, not at 99', () => {
    const at99 = checkMilestones(makeInsights({ meta: { total_meals: 99 } }), [])
    expect(at99.some(m => m.id === 'meals_100')).toBe(false)

    const at100 = checkMilestones(makeInsights({ meta: { total_meals: 100 } }), [])
    expect(at100.some(m => m.id === 'meals_100')).toBe(true)
  })

  // Catches M6: home_meals_10 uses >= not === — 11 home meals should still trigger
  it('returns home_meals_10 when home_count exceeds 10 (>= not ===)', () => {
    const result = checkMilestones(
      makeInsights({ home_vs_out: { cooking_ratio: { home_count: 11 } } }),
      []
    )
    expect(result.some(m => m.id === 'home_meals_10')).toBe(true)
  })
})
