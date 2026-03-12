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
})
