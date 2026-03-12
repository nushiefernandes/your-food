import { describe, it, expect } from 'vitest'
import { selectNudge, NUDGE_TEMPLATES } from './nudges'

const baseInsights = {
  eating: {
    cuisine_breakdown: [{ cuisine: 'Italian', count: 1 }, { cuisine: 'Indian', count: 3 }],
    top_dishes: [{ name: 'Pasta', count: 1 }, { name: 'Curry', count: 4 }],
    avg_rating_by_cuisine: [{ cuisine: 'Italian', avg: 3.0, count: 2 }],
  },
  places: {
    top_venues: [{ name: 'Trattoria', visits: 3 }],
  },
  home_vs_out: {
    cooking_ratio: { home_pct: 40, out_pct: 60, home_count: 8, out_count: 12 },
  },
  timing: {
    logging_streak: { current: 4, longest: 7 },
  },
  social: { solo_pct: 80 },
  spending: { avg_meal_cost: 300 },
  meta: { total_meals: 20 },
}

describe('selectNudge', () => {
  it('returns first_cuisine nudge when cuisine count is 1', () => {
    const entry = { cuisine_type: 'Italian', rating: 3 }
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).toBe('first_cuisine')
    expect(result?.text).toContain('Italian')
  })

  it('returns venue_regular nudge for 3+ visits', () => {
    const entry = { venue_name: 'Trattoria', rating: 4 }
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).toBe('venue_regular')
    expect(result?.text).toContain('Trattoria')
  })

  it('returns five_star nudge for rating 5', () => {
    const entry = { rating: 5, dish_name: 'Unknown' }
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).toBe('five_star')
  })

  it('returns new_dish nudge for first-time dish', () => {
    const entry = { dish_name: 'Pasta', rating: 4 }
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).toBe('new_dish')
  })

  it('skips last shown nudge id (sessionStorage dedup)', () => {
    const entry = { cuisine_type: 'Italian', rating: 3 }
    const result = selectNudge(entry, baseInsights, 'first_cuisine')
    expect(result?.id).not.toBe('first_cuisine')
  })

  it('returns null when no template matches', () => {
    const entry = { dish_name: 'Burger', rating: 3 }
    const emptyInsights = {
      eating: { cuisine_breakdown: [], top_dishes: [{ name: 'Burger', count: 5 }], avg_rating_by_cuisine: [] },
      places: { top_venues: [] },
      timing: { logging_streak: { current: 1 } },
      social: { solo_pct: 30 },
      spending: { avg_meal_cost: 300 },
      home_vs_out: { cooking_ratio: { home_count: 2 } },
    }
    expect(selectNudge(entry, emptyInsights)).toBeNull()
  })

  it('handles null insights gracefully without throwing', () => {
    expect(() => selectNudge({ rating: 3 }, null)).not.toThrow()
    expect(selectNudge({ rating: 3 }, null)).toBeNull()
  })
})
