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

  // Catches M2: companion check reads entry.companions (not entry.companion or entry.companionPresent)
  // — if field name is wrong, this entry returns null instead of companion nudge
  it('returns companion nudge when entry has companions and user mostly eats solo', () => {
    const entry = { companions: ['Alice'] }
    const result = selectNudge(entry, baseInsights) // solo_pct: 80 > 70 threshold
    expect(result?.id).toBe('companion')
    expect(result?.text).toBeTruthy()
  })

  // Catches M3: cooking_streak check uses entry_type === 'home' (lowercase)
  // — if check used 'Home' instead, this entry would return null
  it('returns cooking_streak nudge for home-cooked meal when streak >= 3', () => {
    const entry = { entry_type: 'home' }
    const result = selectNudge(entry, baseInsights) // streak current: 4
    expect(result?.id).toBe('cooking_streak')
    expect(result?.text).toContain('4')
  })

  // Catches M7a: spending nudge fires when cost < 50% of average (not when cost > average)
  // — if < was flipped to >, cheap meals would get no nudge and expensive ones would get "cheap" text
  it('returns spending nudge when meal costs less than half the user average', () => {
    const entry = { cost: 100 } // avg is 300, threshold is 150
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).toBe('spending')
    expect(result?.text).toMatch(/less than your usual/i)
  })

  // Catches M7b: spending nudge fires when cost > 2x average (not when cost < average)
  it('returns spending nudge when meal costs more than double the user average', () => {
    const entry = { cost: 700 } // avg is 300, threshold is 600
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).toBe('spending')
    expect(result?.text).toMatch(/splurge/i)
  })

  // Catches M7c: spending nudge does NOT fire for an average-cost meal
  it('does not return spending nudge when cost is near the user average', () => {
    const entry = { cost: 300 } // exactly average — neither threshold triggers
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).not.toBe('spending')
  })
})
