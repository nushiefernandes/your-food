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
    avg_rating_comparison: { home: 4.2, out: 3.5 },
  },
  timing: {
    logging_streak: { current: 4, longest: 7 },
  },
  social: {
    solo_pct: 80,
    top_companions: [{ name: 'Alice', count: 3 }, { name: 'Bob', count: 1 }],
  },
  spending: { avg_meal_cost: 300 },
  meta: {
    total_meals: 20,
    dishes_to_revisit: [{ dish: 'Curry' }],
  },
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
      eating: { cuisine_breakdown: [], top_dishes: [{ name: 'Burger', count: 2 }], avg_rating_by_cuisine: [] },
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
    const entry = { companions: ['Charlie'] } // Charlie not in top_companions, so companion_repeat won't fire
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

  // go_to_dish: fires when dish count >= 3
  it('returns go_to_dish nudge when dish has been logged 3+ times', () => {
    const entry = { dish_name: 'Curry' } // count: 4 in baseInsights
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).toBe('go_to_dish')
    expect(result?.text).toContain('Curry')
  })

  // go_to_dish: does NOT fire when dish count < 3
  it('does not return go_to_dish nudge when dish count is below threshold', () => {
    const entry = { dish_name: 'Pasta' } // count: 1 in baseInsights
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).not.toBe('go_to_dish')
  })

  // companion_repeat: fires when a companion appears 3+ times
  it('returns companion_repeat nudge when companion has shared 3+ meals', () => {
    const entry = { companions: ['Alice'] } // Alice count: 3
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).toBe('companion_repeat')
    expect(result?.text).toContain('Alice')
  })

  // companion_repeat: also handles comma-separated string companions
  it('returns companion_repeat nudge when companions field is a comma-separated string', () => {
    const entry = { companions: 'Alice, Bob' }
    const result = selectNudge(entry, baseInsights)
    expect(result?.id).toBe('companion_repeat')
    expect(result?.text).toContain('Alice')
  })

  // companion_repeat: does NOT fire when no companion has count >= 3
  it('does not return companion_repeat nudge when companion count is below threshold', () => {
    const entry = { companions: ['Bob'] } // Bob count: 1
    const insightsLowCount = {
      ...baseInsights,
      social: { ...baseInsights.social, top_companions: [{ name: 'Bob', count: 1 }] },
    }
    const result = selectNudge(entry, insightsLowCount)
    expect(result?.id).not.toBe('companion_repeat')
  })

  // dish_revisit: fires when dish is in dishes_to_revisit and count >= 2
  it('returns dish_revisit nudge when dish is flagged for revisit', () => {
    const entry = { dish_name: 'Curry' } // count: 4, in dishes_to_revisit
    // go_to_dish fires first in selectNudge (count >= 3) — test the template directly
    const template = NUDGE_TEMPLATES.find(t => t.id === 'dish_revisit')
    const text = template.check(entry, baseInsights)
    expect(text).toContain('Curry')
  })

  // dish_revisit: does NOT fire when dish is not in dishes_to_revisit
  it('does not return dish_revisit nudge when dish is not flagged for revisit', () => {
    const entry = { dish_name: 'Pasta' } // count: 1, not in dishes_to_revisit
    const template = NUDGE_TEMPLATES.find(t => t.id === 'dish_revisit')
    expect(template.check(entry, baseInsights)).toBeNull()
  })

  // home_beats_out: fires when home avg rating > out avg by 0.5+ with sufficient data
  it('returns home_beats_out nudge when home meals consistently rate higher', () => {
    // home: 4.2, out: 3.5 — difference of 0.7 >= threshold of 0.5
    const entry = { entry_type: 'home' }
    const template = NUDGE_TEMPLATES.find(t => t.id === 'home_beats_out')
    const text = template.check(entry, baseInsights)
    expect(text).toBeTruthy()
    expect(text).toMatch(/home meals/i)
  })

  // home_beats_out: does NOT fire for eating-out entries
  it('does not return home_beats_out nudge for restaurant entries', () => {
    const entry = { entry_type: 'out' }
    const template = NUDGE_TEMPLATES.find(t => t.id === 'home_beats_out')
    expect(template.check(entry, baseInsights)).toBeNull()
  })

  // home_beats_out: does NOT fire when data is insufficient (< 5 of either type)
  it('does not return home_beats_out nudge when insufficient data', () => {
    const entry = { entry_type: 'home' }
    const lowDataInsights = {
      ...baseInsights,
      home_vs_out: {
        avg_rating_comparison: { home: 4.5, out: 3.0 },
        cooking_ratio: { home_count: 3, out_count: 3 }, // below the 5-meal minimum
      },
    }
    const template = NUDGE_TEMPLATES.find(t => t.id === 'home_beats_out')
    expect(template.check(entry, lowDataInsights)).toBeNull()
  })

  // companion: empty array [] is truthy in JS — must NOT fire "Nice to have company!"
  // Catches bug: !entry?.companions doesn't guard against []
  it('does not return companion nudge when companions is an empty array', () => {
    const entry = { companions: [] }
    const highSoloInsights = { ...baseInsights, social: { ...baseInsights.social, solo_pct: 85 } }
    const template = NUDGE_TEMPLATES.find(t => t.id === 'companion')
    expect(template.check(entry, highSoloInsights)).toBeNull()
  })

  // companion: still fires when companions array has at least one person
  it('returns companion nudge when companions has entries and user is mostly solo', () => {
    const entry = { companions: ['Alice'] }
    const highSoloInsights = { ...baseInsights, social: { ...baseInsights.social, solo_pct: 85 } }
    const template = NUDGE_TEMPLATES.find(t => t.id === 'companion')
    expect(template.check(entry, highSoloInsights)).toBeTruthy()
  })
})
