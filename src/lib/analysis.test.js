import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

vi.mock('./supabase', () => ({
  supabase: mockSupabase,
}))

import { analyzeDishPhoto, analyzeDishPhotos, filterByConfidence } from './analysis'

describe('analysis lib', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('filterByConfidence', () => {
    it('keeps only values at or above default threshold (0.5)', () => {
      const filtered = filterByConfidence({
        dish_name: { value: 'Biryani', confidence: 0.93 },
        cuisine_type: { value: 'Indian', confidence: 0.6 },
        estimated_cost: { value: 320, confidence: 0.45 },
      })

      expect(filtered).toEqual({
        dish_name: 'Biryani',
        cuisine_type: 'Indian',
      })
    })

    it('returns null for null suggestions', () => {
      expect(filterByConfidence(null)).toBeNull()
    })
  })

  describe('analyzeDishPhotos', () => {
    it('invokes analyze-dish Edge Function with single photoPaths array', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          suggestions: { dish_name: { value: 'Dosa', confidence: 0.9 } },
          model: 'gemini-2.5-flash',
          latency_ms: 812,
        },
        error: null,
      })

      const result = await analyzeDishPhotos(['p1'])

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'analyze-dish',
        expect.objectContaining({ body: { photoPaths: ['p1'] } })
      )
      expect(result).toEqual({
        suggestions: { dish_name: { value: 'Dosa', confidence: 0.9 } },
        model: 'gemini-2.5-flash',
        latency_ms: 812,
      })
    })

    it('invokes analyze-dish Edge Function with all provided photo paths', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          suggestions: { dish_name: { value: 'Thali', confidence: 0.88 } },
          model: 'gemini-2.5-flash',
          latency_ms: 640,
        },
        error: null,
      })

      await analyzeDishPhotos(['p1', 'p2', 'p3'])

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'analyze-dish',
        expect.objectContaining({ body: { photoPaths: ['p1', 'p2', 'p3'] } })
      )
    })
  })

  describe('analyzeDishPhoto', () => {
    it('delegates to analyzeDishPhotos with a single path array', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          suggestions: { dish_name: { value: 'Dosa', confidence: 0.9 } },
          model: 'gemini-2.5-flash',
          latency_ms: 812,
        },
        error: null,
      })

      const result = await analyzeDishPhoto('p1')

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'analyze-dish',
        expect.objectContaining({ body: { photoPaths: ['p1'] } })
      )
      expect(result).toEqual({
        suggestions: { dish_name: { value: 'Dosa', confidence: 0.9 } },
        model: 'gemini-2.5-flash',
        latency_ms: 812,
      })
    })

    it('normalizes Edge Function payload errors', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { error: 'api_error' },
        error: null,
      })

      const result = await analyzeDishPhoto('user-1/fail.jpg')

      expect(result).toEqual({ suggestions: null, error: 'api_error' })
    })

    it('returns timeout when invoke never resolves', async () => {
      vi.useFakeTimers()
      mockSupabase.functions.invoke.mockImplementation(() => new Promise(() => {}))

      const pending = analyzeDishPhoto('user-1/slow.jpg')
      await vi.advanceTimersByTimeAsync(30000)

      await expect(pending).resolves.toEqual({ suggestions: null, error: 'timeout' })
    })

    it('maps AbortError to timeout', async () => {
      mockSupabase.functions.invoke.mockRejectedValue({ name: 'AbortError' })

      const result = await analyzeDishPhoto('user-1/aborted.jpg')

      expect(result).toEqual({ suggestions: null, error: 'timeout' })
    })
  })
})
