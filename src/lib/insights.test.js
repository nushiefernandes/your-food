const { mockInvoke } = vi.hoisted(() => {
  const mockInvoke = vi.fn()
  return { mockInvoke }
})

vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}))

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getInsights } from './insights'

describe('insights client', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('calls supabase.functions.invoke with "insights"', async () => {
    mockInvoke.mockResolvedValue({ data: { entry_count: 5, insights: {} }, error: null })
    const result = await getInsights()
    expect(mockInvoke).toHaveBeenCalledWith('insights')
    expect(result.data.entry_count).toBe(5)
  })

  it('returns error when invoke fails', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'unauthorized' } })
    const result = await getInsights()
    expect(result.error).toBeTruthy()
    expect(result.data).toBeNull()
  })

  it('returns structured insights on success', async () => {
    const mockData = {
      computed_at: '2026-03-08T12:00:00Z',
      entry_count: 22,
      insights: {
        eating: { top_dishes: [{ name: 'Shawarma', count: 3 }] },
        places: { top_venues: [{ name: 'Goan Street Food', visits: 3 }] },
        home_vs_out: { cooking_ratio: { home_pct: 35, out_pct: 65 } },
        spending: { avg_meal_cost: 350 },
        timing: { logging_streak: { current: 3, longest: 5 } },
        weather: { avg_meal_temp: 27 },
        social: { solo_pct: 55 },
        meta: { total_meals: 22 },
      },
    }
    mockInvoke.mockResolvedValue({ data: mockData, error: null })
    const result = await getInsights()
    expect(result.data.insights.eating.top_dishes).toHaveLength(1)
    expect(result.data.insights.meta.total_meals).toBe(22)
  })
})
