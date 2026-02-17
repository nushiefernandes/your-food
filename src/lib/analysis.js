import { supabase } from './supabase'

const MOCK_AI = import.meta.env.VITE_MOCK_AI === 'true'
const TIMEOUT_MS = 8000

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export async function analyzeDishPhoto(photoPath) {
  if (MOCK_AI) {
    await delay(800)
    return {
      suggestions: {
        dish_name: { value: 'Mock Paneer Tikka', confidence: 0.95 },
        cuisine_type: { value: 'North Indian', confidence: 0.9 },
        entry_type: { value: 'eating_out', confidence: 0.8 },
        estimated_cost: { value: 350, confidence: 0.6 },
        description: {
          value: 'Chunks of paneer marinated in spices and grilled in a tandoor.',
          confidence: 0.85
        }
      },
      model: 'mock',
      latency_ms: 800
    }
  }

  // Dual timeout: AbortController cancels the in-flight request (resource cleanup),
  // while Promise.race guarantees timeout behavior even if supabase.functions.invoke
  // doesn't reliably honor AbortSignal in all environments/SDK versions.
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, TIMEOUT_MS)

  const timeoutPromise = delay(TIMEOUT_MS).then(() => ({
    suggestions: null,
    error: 'timeout'
  }))

  try {
    const invokePromise = supabase.functions.invoke('analyze-dish', {
      body: { photoPath },
      signal: controller.signal
    }).then(({ data, error }) => {
      if (error || data?.error) {
        return { suggestions: null, error: data?.error || 'api_error' }
      }

      return {
        suggestions: data?.suggestions ?? null,
        model: data?.model,
        latency_ms: data?.latency_ms
      }
    })

    return await Promise.race([invokePromise, timeoutPromise])
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { suggestions: null, error: 'timeout' }
    }
    return { suggestions: null, error: 'api_error' }
  } finally {
    clearTimeout(timeoutId)
  }
}

export function filterByConfidence(suggestions, threshold = 0.5) {
  if (!suggestions) return null

  const filtered = {}
  for (const [key, entry] of Object.entries(suggestions)) {
    if (!entry || typeof entry.confidence !== 'number') continue
    if (entry.confidence >= threshold) {
      filtered[key] = entry.value
    }
  }

  return filtered
}
