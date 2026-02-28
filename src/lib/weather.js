export async function fetchWeather(lat, lng, isoTimestamp) {
  try {
    const { datePart, hour } = parseIsoParts(isoTimestamp)
    if (!datePart || hour == null) return null

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      hourly: 'temperature_2m,weathercode,precipitation',
      start_date: datePart,
      end_date: datePart,
      timezone: 'UTC',
    })

    const daysSince = (Date.now() - new Date(datePart).getTime()) / (1000 * 60 * 60 * 24)
    const base = daysSince > 7
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast'
    const url = `${base}?${params.toString()}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const data = await res.json()
    const hourly = data?.hourly
    const times = hourly?.time
    const temps = hourly?.temperature_2m
    const codes = hourly?.weathercode
    const precips = hourly?.precipitation

    if (!Array.isArray(times) || !Array.isArray(temps) || !Array.isArray(codes) || !Array.isArray(precips)) {
      return null
    }

    const target = `${datePart}T${String(hour).padStart(2, '0')}:00`
    const idx = times.indexOf(target)
    if (idx === -1) return null

    const temp_c = temps[idx]
    const weather_code = codes[idx]
    const precipitation_mm = precips[idx]

    if (
      typeof temp_c !== 'number' ||
      typeof weather_code !== 'number' ||
      typeof precipitation_mm !== 'number'
    ) {
      return null
    }

    return { temp_c, weather_code, precipitation_mm }
  } catch {
    return null
  }
}

export function weatherDescription(code) {
  if (code === 0) return 'Clear sky'
  if (code >= 1 && code <= 3) return 'Partly cloudy'
  if (code >= 45 && code <= 48) return 'Fog'
  if (code >= 51 && code <= 55) return 'Drizzle'
  if (code >= 61 && code <= 65) return 'Rain'
  if (code >= 71 && code <= 75) return 'Snow'
  if (code >= 80 && code <= 82) return 'Rain showers'
  if (code === 95) return 'Thunderstorm'
  return 'Unknown'
}

function parseIsoParts(isoTimestamp) {
  if (typeof isoTimestamp === 'string' && isoTimestamp.length >= 13 && /^\d{4}-\d{2}-\d{2}/.test(isoTimestamp)) {
    const datePart = isoTimestamp.slice(0, 10)
    const hour = Number(isoTimestamp.slice(11, 13))
    if (!Number.isNaN(hour)) return { datePart, hour }
  }

  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) return { datePart: null, hour: null }
  return { datePart: date.toISOString().slice(0, 10), hour: date.getUTCHours() }
}
