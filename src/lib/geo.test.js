import { describe, it, expect } from 'vitest'
import { haversineMeters } from './geo'

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(12.97, 77.59, 12.97, 77.59)).toBe(0)
  })

  it('calculates ~111km for 1 degree latitude at equator', () => {
    const distance = haversineMeters(0, 0, 1, 0)
    expect(distance).toBeGreaterThan(110000)
    expect(distance).toBeLessThan(112000)
  })

  it('calculates ~111km for 1 degree longitude at equator', () => {
    const distance = haversineMeters(0, 0, 0, 1)
    expect(distance).toBeGreaterThan(110000)
    expect(distance).toBeLessThan(112000)
  })

  it('calculates known distance: Bangalore to Mumbai (~842km)', () => {
    const distance = haversineMeters(12.9716, 77.5946, 19.0760, 72.8777)
    expect(distance).toBeGreaterThan(830000)
    expect(distance).toBeLessThan(860000)
  })

  it('calculates short distance: two restaurants 50m apart', () => {
    // ~50m offset at Bangalore latitude
    const distance = haversineMeters(12.9716, 77.5946, 12.9720, 77.5946)
    expect(distance).toBeGreaterThan(30)
    expect(distance).toBeLessThan(70)
  })

  it('handles negative coordinates (Southern/Western hemispheres)', () => {
    const distance = haversineMeters(-33.8688, 151.2093, -37.8136, 144.9631)
    // Sydney to Melbourne ~714km
    expect(distance).toBeGreaterThan(700000)
    expect(distance).toBeLessThan(730000)
  })

  it('is symmetric: distance A→B equals B→A', () => {
    const ab = haversineMeters(12.97, 77.59, 19.07, 72.88)
    const ba = haversineMeters(19.07, 72.88, 12.97, 77.59)
    expect(ab).toBeCloseTo(ba, 5)
  })
})
