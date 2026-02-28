import { describe, it, expect, vi } from 'vitest'
import { weatherDescription } from './weather'

describe('weatherDescription', () => {
  it('returns Clear sky for code 0', () => {
    expect(weatherDescription(0)).toBe('Clear sky')
  })

  it('returns Partly cloudy for codes 1-3', () => {
    expect(weatherDescription(1)).toBe('Partly cloudy')
    expect(weatherDescription(2)).toBe('Partly cloudy')
    expect(weatherDescription(3)).toBe('Partly cloudy')
  })

  it('returns Fog for codes 45-48', () => {
    expect(weatherDescription(45)).toBe('Fog')
    expect(weatherDescription(48)).toBe('Fog')
  })

  it('returns Drizzle for codes 51-55', () => {
    expect(weatherDescription(51)).toBe('Drizzle')
    expect(weatherDescription(53)).toBe('Drizzle')
    expect(weatherDescription(55)).toBe('Drizzle')
  })

  it('returns Rain for codes 61-65', () => {
    expect(weatherDescription(61)).toBe('Rain')
    expect(weatherDescription(63)).toBe('Rain')
    expect(weatherDescription(65)).toBe('Rain')
  })

  it('returns Snow for codes 71-75', () => {
    expect(weatherDescription(71)).toBe('Snow')
    expect(weatherDescription(73)).toBe('Snow')
    expect(weatherDescription(75)).toBe('Snow')
  })

  it('returns Rain showers for codes 80-82', () => {
    expect(weatherDescription(80)).toBe('Rain showers')
    expect(weatherDescription(81)).toBe('Rain showers')
    expect(weatherDescription(82)).toBe('Rain showers')
  })

  it('returns Thunderstorm for code 95', () => {
    expect(weatherDescription(95)).toBe('Thunderstorm')
  })

  it('returns a fallback for unknown codes', () => {
    const result = weatherDescription(999)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('fetchWeather', () => {
  it('returns null when fetch fails', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'))

    const { fetchWeather } = await import('./weather')
    const result = await fetchWeather(12.97, 77.59, '2026-02-24T12:00:00Z')
    expect(result).toBeNull()

    globalThis.fetch = originalFetch
  })

  it('returns null for non-ok response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

    const { fetchWeather } = await import('./weather')
    const result = await fetchWeather(12.97, 77.59, '2026-02-24T12:00:00Z')
    expect(result).toBeNull()

    globalThis.fetch = originalFetch
  })

  it('extracts correct hour from response', async () => {
    const originalFetch = globalThis.fetch
    const mockHourly = {
      time: Array(24).fill(0).map((_, i) => `2026-02-24T${String(i).padStart(2, '0')}:00`),
      temperature_2m: Array(24).fill(0).map((_, i) => 20 + i),
      weathercode: Array(24).fill(0),
      precipitation: Array(24).fill(0),
    }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ hourly: mockHourly }),
    })

    const { fetchWeather } = await import('./weather')
    // 14:00 UTC → hour 14
    const result = await fetchWeather(12.97, 77.59, '2026-02-24T14:00:00Z')
    expect(result).toEqual({
      temp_c: 34, // 20 + 14
      weather_code: 0,
      precipitation_mm: 0,
    })

    globalThis.fetch = originalFetch
  })
})
