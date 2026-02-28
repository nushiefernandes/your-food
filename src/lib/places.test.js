import { describe, it, expect, vi } from 'vitest'
import { findNearbyPlace } from './places'

const savedPlaces = [
  { id: '1', name: 'Cafe Coffee Day', lat: 12.9716, lng: 77.5946 },
  { id: '2', name: 'Mabrouk', lat: 12.9580, lng: 77.5920 },
  { id: '3', name: 'Toit', lat: 12.9784, lng: 77.6408 },
]

describe('findNearbyPlace', () => {
  it('returns exact match (0m distance)', () => {
    const match = findNearbyPlace(12.9716, 77.5946, savedPlaces, 50)
    expect(match).not.toBeNull()
    expect(match.name).toBe('Cafe Coffee Day')
  })

  it('returns place within 50m radius', () => {
    // ~30m offset from Cafe Coffee Day
    const match = findNearbyPlace(12.9718, 77.5946, savedPlaces, 50)
    expect(match).not.toBeNull()
    expect(match.name).toBe('Cafe Coffee Day')
  })

  it('returns null when no place within radius', () => {
    // 500m away from any saved place
    const match = findNearbyPlace(12.9800, 77.5946, savedPlaces, 50)
    expect(match).toBeNull()
  })

  it('returns null for empty saved places', () => {
    const match = findNearbyPlace(12.9716, 77.5946, [], 50)
    expect(match).toBeNull()
  })

  it('returns first match when multiple places nearby', () => {
    const closePlaces = [
      { id: '1', name: 'Place A', lat: 12.9716, lng: 77.5946 },
      { id: '2', name: 'Place B', lat: 12.9716, lng: 77.5947 },
    ]
    const match = findNearbyPlace(12.9716, 77.5946, closePlaces, 50)
    expect(match).not.toBeNull()
    expect(match.name).toBe('Place A')
  })

  it('respects custom radius', () => {
    // Mabrouk is ~1.5km from CCD coords
    const match50 = findNearbyPlace(12.9716, 77.5946, savedPlaces, 50)
    expect(match50?.name).toBe('Cafe Coffee Day')

    // With a huge radius, should still return closest first (CCD)
    const match5000 = findNearbyPlace(12.9716, 77.5946, savedPlaces, 5000)
    expect(match5000?.name).toBe('Cafe Coffee Day')
  })
})
