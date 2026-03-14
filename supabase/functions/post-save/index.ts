import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGIN") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
if (ALLOWED_ORIGINS.length === 0) ALLOWED_ORIGINS.push("*")

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""

type Entry = Record<string, unknown>
type CountMap = Map<string, number>

function corsHeaders(origin: string) {
  const allowedOrigin = ALLOWED_ORIGINS.includes("*")
    ? "*"
    : ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ""
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }
}

function jsonResponse(
  body: Record<string, unknown>,
  origin: string,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  })
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalize(value: unknown): string {
  return asTrimmedString(value).toLowerCase().replace(/\s+/g, " ")
}

function getDate(value: unknown): Date | null {
  const raw = asTrimmedString(value)
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7)
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Number(((part / total) * 100).toFixed(2))
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  const sum = values.reduce((total, n) => total + n, 0)
  return Number((sum / values.length).toFixed(2))
}

function getWeather(entry: Entry): Record<string, unknown> | null {
  const weather = entry.weather
  if (!weather || typeof weather !== "object") return null
  return weather as Record<string, unknown>
}

function getWeatherTemp(entry: Entry): number | null {
  const weather = getWeather(entry)
  if (!weather) return null
  const temperature = asNumber(weather.temperature)
  if (temperature != null) return temperature
  return asNumber(weather.temp_c)
}

function splitCompanions(raw: unknown): string[] {
  const text = asTrimmedString(raw)
  if (!text) return []
  return text
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
}

function sortByCountThenName(rows: Array<{ name: string; count: number }>) {
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return rows
}

function countBy(entries: Entry[], valueGetter: (entry: Entry) => string): CountMap {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const key = valueGetter(entry)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}

// EATING (8)
function topDishes(entries: Entry[]) {
  const labels = new Map<string, string>()
  const counts = countBy(entries, (entry) => {
    const dish = asTrimmedString(entry.dish_name)
    if (!dish) return ""
    const key = dish.toLowerCase()
    if (!labels.has(key)) labels.set(key, dish)
    return key
  })

  return sortByCountThenName(
    Array.from(counts, ([key, count]) => ({
      name: labels.get(key) || key,
      count,
    })),
  ).slice(0, 10)
}

function cuisineBreakdown(entries: Entry[]) {
  const counts = countBy(entries, (entry) => asTrimmedString(entry.cuisine_type))
  const total = Array.from(counts.values()).reduce((sum, n) => sum + n, 0)
  if (total === 0) return []

  return Array.from(counts, ([cuisine, count]) => ({
    cuisine,
    count,
    pct: pct(count, total),
  })).sort((a, b) => b.count - a.count || a.cuisine.localeCompare(b.cuisine))
}

function cuisineDiversity(entries: Entry[]) {
  return new Set(
    entries
      .map((entry) => asTrimmedString(entry.cuisine_type))
      .filter(Boolean),
  ).size
}

function newDishesThisMonth(entries: Entry[]) {
  const firstSeen = new Map<string, Date>()

  for (const entry of entries) {
    const dish = normalize(entry.dish_name)
    const ateAt = getDate(entry.ate_at)
    if (!dish || !ateAt) continue
    const existing = firstSeen.get(dish)
    if (!existing || ateAt < existing) firstSeen.set(dish, ateAt)
  }

  const nowMonth = monthKey(new Date())
  let count = 0
  for (const firstDate of firstSeen.values()) {
    if (monthKey(firstDate) === nowMonth) count += 1
  }

  return count
}

function ratingDistribution(entries: Entry[]) {
  const histogram: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }

  for (const entry of entries) {
    const rating = asNumber(entry.rating)
    if (rating == null) continue
    const whole = Math.round(rating)
    if (whole >= 1 && whole <= 5) histogram[String(whole)] += 1
  }

  return histogram
}

function avgRatingByCuisine(entries: Entry[]) {
  const stats = new Map<string, { sum: number; count: number }>()

  for (const entry of entries) {
    const cuisine = asTrimmedString(entry.cuisine_type)
    const rating = asNumber(entry.rating)
    if (!cuisine || rating == null) continue
    const current = stats.get(cuisine) || { sum: 0, count: 0 }
    current.sum += rating
    current.count += 1
    stats.set(cuisine, current)
  }

  return Array.from(stats, ([cuisine, stat]) => ({
    cuisine,
    avg: Number((stat.sum / stat.count).toFixed(2)),
    count: stat.count,
  })).sort((a, b) => b.avg - a.avg || b.count - a.count || a.cuisine.localeCompare(b.cuisine))
}

function comboMealPct(entries: Entry[]) {
  if (entries.length === 0) return 0
  const combos = entries.filter((entry) => entry.is_combo === true).length
  return pct(combos, entries.length)
}

function topRatedDishes(entries: Entry[]) {
  const seen = new Set<string>()
  const result: Array<{ name: string; venue: string | null; date: string | null }> = []

  for (const entry of entries) {
    const rating = asNumber(entry.rating)
    const dish = asTrimmedString(entry.dish_name)
    if (rating !== 5 || !dish) continue
    const key = dish.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const d = getDate(entry.ate_at)
    result.push({
      name: dish,
      venue: asTrimmedString(entry.venue_name) || null,
      date: d ? dateKey(d) : null,
    })

    if (result.length >= 10) break
  }

  return result
}

// PLACES (5)
function topVenues(entries: Entry[]) {
  const outEntries = entries.filter((entry) => entry.entry_type === "eating_out")
  const counts = countBy(outEntries, (entry) => asTrimmedString(entry.venue_name))

  return sortByCountThenName(
    Array.from(counts, ([name, visits]) => ({ name, count: visits })),
  ).slice(0, 10).map(({ name, count }) => ({ name, visits: count }))
}

function loyaltyVsDiscovery(entries: Entry[]) {
  const outEntries = entries.filter((entry) => entry.entry_type === "eating_out")
  const counts = countBy(outEntries, (entry) => asTrimmedString(entry.venue_name))
  const venueCounts = Array.from(counts.values())

  if (venueCounts.length === 0) {
    return { repeat_pct: 0, first_visit_pct: 0 }
  }

  const repeat = venueCounts.filter((n) => n > 1).length
  const firstVisit = venueCounts.filter((n) => n === 1).length

  return {
    repeat_pct: pct(repeat, venueCounts.length),
    first_visit_pct: pct(firstVisit, venueCounts.length),
  }
}

function topNeighbourhoods(entries: Entry[]) {
  const counts = countBy(entries, (entry) => asTrimmedString(entry.neighbourhood))

  return sortByCountThenName(
    Array.from(counts, ([name, count]) => ({ name, count })),
  ).slice(0, 10)
}

function geographicRange(entries: Entry[]) {
  const cities = new Set<string>()

  for (const entry of entries) {
    const neighbourhood = asTrimmedString(entry.neighbourhood)
    if (!neighbourhood) continue
    const parts = neighbourhood.split(",").map((part) => part.trim()).filter(Boolean)
    if (parts.length === 0) continue
    cities.add(parts[parts.length - 1])
  }

  const list = Array.from(cities).sort((a, b) => a.localeCompare(b))
  return { cities: list, count: list.length }
}

function bestRatedVenues(entries: Entry[]) {
  const venueStats = new Map<string, { visits: number; sum: number; ratedCount: number }>()

  for (const entry of entries) {
    const venue = asTrimmedString(entry.venue_name)
    if (!venue) continue

    const stat = venueStats.get(venue) || { visits: 0, sum: 0, ratedCount: 0 }
    stat.visits += 1

    const rating = asNumber(entry.rating)
    if (rating != null) {
      stat.sum += rating
      stat.ratedCount += 1
    }

    venueStats.set(venue, stat)
  }

  return Array.from(venueStats, ([name, stat]) => ({
    name,
    avg_rating: stat.ratedCount > 0 ? Number((stat.sum / stat.ratedCount).toFixed(2)) : null,
    visits: stat.visits,
  }))
    .filter((row) => row.visits >= 2 && row.avg_rating != null)
    .sort((a, b) => (b.avg_rating as number) - (a.avg_rating as number) || b.visits - a.visits || a.name.localeCompare(b.name))
}

// HOME VS OUT (5)
function cookingRatio(entries: Entry[]) {
  const homeCount = entries.filter((entry) => entry.entry_type === "home_cooked").length
  const outCount = entries.filter((entry) => entry.entry_type === "eating_out").length
  const total = homeCount + outCount

  return {
    home_pct: pct(homeCount, total),
    out_pct: pct(outCount, total),
    home_count: homeCount,
    out_count: outCount,
  }
}

function cookingTrend(entries: Entry[]) {
  const byMonth = new Map<string, { home: number; out: number }>()

  for (const entry of entries) {
    const d = getDate(entry.ate_at)
    if (!d) continue
    const month = monthKey(d)
    const row = byMonth.get(month) || { home: 0, out: 0 }
    if (entry.entry_type === "home_cooked") row.home += 1
    if (entry.entry_type === "eating_out") row.out += 1
    byMonth.set(month, row)
  }

  return Array.from(byMonth, ([month, row]) => ({ month, home: row.home, out: row.out }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

function avgRatingComparison(entries: Entry[]) {
  const homeRatings: number[] = []
  const outRatings: number[] = []

  for (const entry of entries) {
    const rating = asNumber(entry.rating)
    if (rating == null) continue
    if (entry.entry_type === "home_cooked") homeRatings.push(rating)
    if (entry.entry_type === "eating_out") outRatings.push(rating)
  }

  return {
    home: avg(homeRatings),
    out: avg(outRatings),
  }
}

function avgPrepTime(entries: Entry[]) {
  const values: number[] = []

  for (const entry of entries) {
    if (entry.entry_type !== "home_cooked") continue
    const prep = asNumber(entry.prep_time_minutes)
    if (prep == null) continue
    values.push(prep)
  }

  return avg(values)
}

function recipeUrlPct(entries: Entry[]) {
  const homeEntries = entries.filter((entry) => entry.entry_type === "home_cooked")
  if (homeEntries.length === 0) return null

  const withRecipe = homeEntries.filter((entry) => asTrimmedString(entry.recipe_url).length > 0).length
  return pct(withRecipe, homeEntries.length)
}

// SPENDING (4)
function totalByPeriod(entries: Entry[]) {
  const totals = new Map<string, number>()

  for (const entry of entries) {
    const d = getDate(entry.ate_at)
    const cost = asNumber(entry.cost)
    if (!d || cost == null) continue
    const month = monthKey(d)
    totals.set(month, (totals.get(month) || 0) + cost)
  }

  return Array.from(totals, ([month, total]) => ({
    month,
    total: Number(total.toFixed(2)),
  })).sort((a, b) => a.month.localeCompare(b.month))
}

function avgMealCost(entries: Entry[]) {
  const costs = entries
    .map((entry) => asNumber(entry.cost))
    .filter((cost): cost is number => cost != null && cost > 0)

  return avg(costs)
}

function mostExpensive(entries: Entry[]) {
  let winner: Entry | null = null
  let maxCost = -Infinity

  for (const entry of entries) {
    const cost = asNumber(entry.cost)
    if (cost == null) continue
    if (cost > maxCost) {
      maxCost = cost
      winner = entry
    }
  }

  if (!winner) return null

  const d = getDate(winner.ate_at)
  return {
    dish: asTrimmedString(winner.dish_name),
    cost: maxCost,
    venue: asTrimmedString(winner.venue_name) || null,
    date: d ? dateKey(d) : null,
  }
}

function costByCuisine(entries: Entry[]) {
  const stats = new Map<string, { sum: number; count: number }>()

  for (const entry of entries) {
    const cuisine = asTrimmedString(entry.cuisine_type)
    const cost = asNumber(entry.cost)
    if (!cuisine || cost == null) continue

    const row = stats.get(cuisine) || { sum: 0, count: 0 }
    row.sum += cost
    row.count += 1
    stats.set(cuisine, row)
  }

  return Array.from(stats, ([cuisine, row]) => ({
    cuisine,
    avg: Number((row.sum / row.count).toFixed(2)),
    count: row.count,
  })).sort((a, b) => b.avg - a.avg || b.count - a.count || a.cuisine.localeCompare(b.cuisine))
}

// TIMING (5)
function mealTimeDistribution(entries: Entry[]) {
  const buckets = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  }

  for (const entry of entries) {
    const d = getDate(entry.ate_at)
    if (!d) continue
    const hour = d.getUTCHours()

    if (hour >= 5 && hour <= 11) {
      buckets.morning += 1
    } else if (hour >= 12 && hour <= 16) {
      buckets.afternoon += 1
    } else if (hour >= 17 && hour <= 21) {
      buckets.evening += 1
    } else {
      buckets.night += 1
    }
  }

  return buckets
}

function dayOfWeek(entries: Entry[]) {
  const days = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 }
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

  for (const entry of entries) {
    const d = getDate(entry.ate_at)
    if (!d) continue
    const label = labels[d.getUTCDay()]
    days[label] += 1
  }

  return days
}

function startOfWeekUTC(d: Date): Date {
  const day = d.getUTCDay()
  const diffFromMonday = (day + 6) % 7
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - diffFromMonday)
  return start
}

function busiestPeriod(entries: Entry[]) {
  const weekCounts = new Map<string, number>()

  for (const entry of entries) {
    const d = getDate(entry.ate_at)
    if (!d) continue
    const weekStart = dateKey(startOfWeekUTC(d))
    weekCounts.set(weekStart, (weekCounts.get(weekStart) || 0) + 1)
  }

  if (weekCounts.size === 0) return null

  let bestWeek = ""
  let bestCount = 0
  for (const [week, count] of weekCounts) {
    if (count > bestCount || (count === bestCount && week < bestWeek)) {
      bestWeek = week
      bestCount = count
    }
  }

  return { week_start: bestWeek, count: bestCount }
}

function loggingStreak(entries: Entry[]) {
  const dayNums = Array.from(
    new Set(
      entries
        .map((entry) => getDate(entry.ate_at))
        .filter((d): d is Date => d != null)
        .map((d) => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000)),
    ),
  ).sort((a, b) => a - b)

  if (dayNums.length === 0) return { current: 0, longest: 0 }

  let longest = 1
  let run = 1
  for (let i = 1; i < dayNums.length; i += 1) {
    if (dayNums[i] === dayNums[i - 1] + 1) {
      run += 1
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  let current = 1
  for (let i = dayNums.length - 1; i > 0; i -= 1) {
    if (dayNums[i] === dayNums[i - 1] + 1) current += 1
    else break
  }

  return { current, longest }
}

function lateNightCount(entries: Entry[]) {
  let count = 0
  for (const entry of entries) {
    const d = getDate(entry.ate_at)
    if (!d) continue
    const hour = d.getUTCHours()
    if (hour >= 22 || hour < 5) count += 1
  }
  return count
}

// WEATHER (3)
function weatherCorrelation(entries: Entry[]) {
  const conditionStats = new Map<string, Map<string, number>>()

  for (const entry of entries) {
    const weather = getWeather(entry)
    const condition = asTrimmedString(weather?.condition)
    const type = asTrimmedString(entry.entry_type)
    if (!condition || !type) continue

    const typeCounts = conditionStats.get(condition) || new Map<string, number>()
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
    conditionStats.set(condition, typeCounts)
  }

  const result: Array<{ condition: string; top_type: string; count: number }> = []

  for (const [condition, typeCounts] of conditionStats) {
    let topType = ""
    let topCount = 0
    for (const [type, count] of typeCounts) {
      if (count > topCount || (count === topCount && type < topType)) {
        topType = type
        topCount = count
      }
    }
    result.push({ condition, top_type: topType, count: topCount })
  }

  return result.sort((a, b) => b.count - a.count || a.condition.localeCompare(b.condition))
}

function hotWeatherDishes(entries: Entry[]) {
  return entries
    .map((entry) => ({ entry, temp: getWeatherTemp(entry) }))
    .filter(({ temp }) => temp != null && temp > 30)
    .sort((a, b) => (b.temp as number) - (a.temp as number))
    .slice(0, 5)
    .map(({ entry, temp }) => {
      const d = getDate(entry.ate_at)
      return {
        dish: asTrimmedString(entry.dish_name),
        temp: temp as number,
        date: d ? dateKey(d) : null,
      }
    })
}

function avgMealTemp(entries: Entry[]) {
  const temps = entries
    .map((entry) => getWeatherTemp(entry))
    .filter((temp): temp is number => temp != null)

  return avg(temps)
}

// SOCIAL (3)
function soloPct(entries: Entry[]) {
  if (entries.length === 0) return 0
  const soloCount = entries.filter((entry) => splitCompanions(entry.companions).length === 0).length
  return pct(soloCount, entries.length)
}

function topCompanions(entries: Entry[]) {
  const canonical = new Map<string, string>()
  const counts = new Map<string, number>()

  for (const entry of entries) {
    const names = splitCompanions(entry.companions)
    for (const name of names) {
      const key = name.toLowerCase()
      if (!canonical.has(key)) canonical.set(key, name)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }

  return Array.from(counts, ([key, count]) => ({
    name: canonical.get(key) || key,
    count,
  }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 10)
}

function companionCuisine(entries: Entry[]) {
  const companionCuisineCounts = new Map<string, Map<string, number>>()

  for (const entry of entries) {
    const cuisine = asTrimmedString(entry.cuisine_type)
    if (!cuisine) continue

    for (const companion of splitCompanions(entry.companions)) {
      const cuisineCounts = companionCuisineCounts.get(companion) || new Map<string, number>()
      cuisineCounts.set(cuisine, (cuisineCounts.get(cuisine) || 0) + 1)
      companionCuisineCounts.set(companion, cuisineCounts)
    }
  }

  const result: Array<{ companion: string; cuisine: string; count: number }> = []

  for (const [companion, cuisineCounts] of companionCuisineCounts) {
    let topCuisine = ""
    let topCount = 0
    for (const [cuisine, count] of cuisineCounts) {
      if (count > topCount || (count === topCount && cuisine < topCuisine)) {
        topCuisine = cuisine
        topCount = count
      }
    }
    result.push({ companion, cuisine: topCuisine, count: topCount })
  }

  return result.sort((a, b) => a.companion.localeCompare(b.companion))
}

// META (6)
function photoRate(entries: Entry[]) {
  if (entries.length === 0) return 0

  const withPhoto = entries.filter((entry) => {
    const photoUrl = asTrimmedString(entry.photo_url)
    const photoPath = asTrimmedString(entry.photo_path)
    return Boolean(photoUrl || photoPath)
  }).length

  return pct(withPhoto, entries.length)
}

function aiAccuracy(entries: Entry[]) {
  let eligible = 0
  let matches = 0

  for (const entry of entries) {
    const aiSuggestions = entry.ai_suggestions
    if (!aiSuggestions || typeof aiSuggestions !== "object") continue

    const aiDish = asTrimmedString((aiSuggestions as Record<string, unknown>)?.dish_name &&
      ((aiSuggestions as Record<string, unknown>).dish_name as Record<string, unknown>)?.value)
    const actualDish = asTrimmedString(entry.dish_name)

    if (!aiDish) continue
    eligible += 1

    const a = normalize(actualDish)
    const b = normalize(aiDish)
    if (!a || !b) continue
    if (a.includes(b) || b.includes(a)) matches += 1
  }

  if (eligible === 0) return null
  return pct(matches, eligible)
}

function firstEntry(entries: Entry[]) {
  let first: Entry | null = null
  let firstDate: Date | null = null

  for (const entry of entries) {
    const d = getDate(entry.ate_at)
    if (!d) continue
    if (!firstDate || d < firstDate) {
      first = entry
      firstDate = d
    }
  }

  if (!first || !firstDate) return null

  return {
    dish: asTrimmedString(first.dish_name),
    venue: asTrimmedString(first.venue_name) || null,
    date: dateKey(firstDate),
  }
}

function busiestDay(entries: Entry[]) {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    const d = getDate(entry.ate_at)
    if (!d) continue
    const day = dateKey(d)
    counts.set(day, (counts.get(day) || 0) + 1)
  }

  if (counts.size === 0) return null

  let bestDay = ""
  let bestCount = 0
  for (const [day, count] of counts) {
    if (count > bestCount || (count === bestCount && day < bestDay)) {
      bestDay = day
      bestCount = count
    }
  }

  return { date: bestDay, count: bestCount }
}

function dishesToRevisit(entries: Entry[]) {
  const dishCounts = new Map<string, number>()

  for (const entry of entries) {
    const dish = normalize(entry.dish_name)
    if (!dish) continue
    dishCounts.set(dish, (dishCounts.get(dish) || 0) + 1)
  }

  return entries
    .filter((entry) => {
      const rating = asNumber(entry.rating)
      const dish = normalize(entry.dish_name)
      return rating != null && rating >= 4 && dish && dishCounts.get(dish) === 1
    })
    .sort((a, b) => {
      const ratingA = asNumber(a.rating) || 0
      const ratingB = asNumber(b.rating) || 0
      if (ratingB !== ratingA) return ratingB - ratingA
      const dateA = getDate(a.ate_at)?.getTime() || 0
      const dateB = getDate(b.ate_at)?.getTime() || 0
      return dateB - dateA
    })
    .slice(0, 10)
    .map((entry) => {
      const d = getDate(entry.ate_at)
      return {
        dish: asTrimmedString(entry.dish_name),
        rating: asNumber(entry.rating) || 0,
        venue: asTrimmedString(entry.venue_name) || null,
        date: d ? dateKey(d) : null,
      }
    })
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || ""

  if (ALLOWED_ORIGINS.length === 0) {
    console.error("ALLOWED_ORIGIN not set — refusing request. Set ENV=development for local dev.")
    return new Response(JSON.stringify({ insights: null, newMilestones: [], error: "api_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== "POST") {
    return jsonResponse({ insights: null, newMilestones: [], error: "api_error" }, origin)
  }

  try {
    const authHeader = req.headers.get("authorization") || ""
    const token = authHeader.replace("Bearer ", "")
    if (!token) {
      return jsonResponse({ insights: null, newMilestones: [], error: "unauthorized" }, origin, 401)
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing Supabase environment variables")
      return jsonResponse({ insights: null, newMilestones: [], error: "api_error" }, origin, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ insights: null, newMilestones: [], error: "unauthorized" }, origin, 401)
    }
    const userId = user.id

    const body = await req.json().catch(() => null)
    const entryId = body && typeof body === "object"
      ? asTrimmedString((body as Record<string, unknown>).entryId)
      : ""
    void entryId

    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('user_id', userId)
      .order('ate_at', { ascending: false })

    if (error) {
      console.error("Failed to fetch entries", error)
      return jsonResponse({ insights: null, newMilestones: [], error: "api_error" }, origin, 500)
    }

    const entries = Array.isArray(data) ? (data as Entry[]) : []
    const cuisineBreakdownValue = cuisineBreakdown(entries)
    const cookingRatioValue = cookingRatio(entries)
    const geographicRangeValue = geographicRange(entries)
    const loggingStreakValue = loggingStreak(entries)

    const insights = {
      eating: {
        top_dishes: topDishes(entries),
        cuisine_breakdown: cuisineBreakdownValue,
        cuisine_diversity: cuisineDiversity(entries),
        new_dishes_this_month: newDishesThisMonth(entries),
        rating_distribution: ratingDistribution(entries),
        avg_rating_by_cuisine: avgRatingByCuisine(entries),
        combo_meal_pct: comboMealPct(entries),
        top_rated_dishes: topRatedDishes(entries),
      },
      places: {
        top_venues: topVenues(entries),
        loyalty_vs_discovery: loyaltyVsDiscovery(entries),
        top_neighbourhoods: topNeighbourhoods(entries),
        geographic_range: geographicRangeValue,
        best_rated_venues: bestRatedVenues(entries),
      },
      home_vs_out: {
        cooking_ratio: cookingRatioValue,
        cooking_trend: cookingTrend(entries),
        avg_rating_comparison: avgRatingComparison(entries),
        avg_prep_time: avgPrepTime(entries),
        recipe_url_pct: recipeUrlPct(entries),
      },
      spending: {
        total_by_period: totalByPeriod(entries),
        avg_meal_cost: avgMealCost(entries),
        most_expensive: mostExpensive(entries),
        cost_by_cuisine: costByCuisine(entries),
      },
      timing: {
        meal_time_distribution: mealTimeDistribution(entries),
        day_of_week: dayOfWeek(entries),
        busiest_period: busiestPeriod(entries),
        logging_streak: loggingStreakValue,
        late_night_count: lateNightCount(entries),
      },
      weather: {
        correlation: weatherCorrelation(entries),
        hot_weather_dishes: hotWeatherDishes(entries),
        avg_meal_temp: avgMealTemp(entries),
      },
      social: {
        solo_pct: soloPct(entries),
        top_companions: topCompanions(entries),
        companion_cuisine: companionCuisine(entries),
      },
      meta: {
        total_meals: entries.length,
        photo_rate_pct: photoRate(entries),
        ai_accuracy_pct: aiAccuracy(entries),
        first_entry: firstEntry(entries),
        busiest_day: busiestDay(entries),
        dishes_to_revisit: dishesToRevisit(entries),
      },
    }

    const { data: seenData, error: seenError } = await supabase
      .from('milestones_seen')
      .select('milestone')
      .eq('user_id', userId)

    if (seenError) {
      console.error("Failed to fetch seen milestones", seenError)
      return jsonResponse({ insights, newMilestones: [] }, origin)
    }

    const seenIds = new Set(
      (Array.isArray(seenData) ? seenData : [])
        .map((row) => asTrimmedString((row as Record<string, unknown>).milestone))
        .filter(Boolean),
    )

    const candidates = [
      { id: "first_meal", label: "First meal logged!", emoji: "🎉", confetti: true, unlocked: entries.length === 1 },
      { id: "meals_10", label: "10 meals logged", emoji: "🍽️", confetti: false, unlocked: entries.length >= 10 },
      { id: "meals_25", label: "25 meals logged", emoji: "📸", confetti: false, unlocked: entries.length >= 25 },
      { id: "meals_50", label: "50 meals logged", emoji: "🎊", confetti: true, unlocked: entries.length >= 50 },
      { id: "meals_100", label: "100 meals logged", emoji: "🏆", confetti: true, unlocked: entries.length >= 100 },
      { id: "streak_7", label: "7-day logging streak", emoji: "🔥", confetti: false, unlocked: loggingStreakValue.current >= 7 },
      { id: "streak_30", label: "30-day logging streak", emoji: "🔥🔥🔥", confetti: true, unlocked: loggingStreakValue.current >= 30 },
      { id: "cuisines_5", label: "5 cuisines explored", emoji: "🌍", confetti: false, unlocked: cuisineBreakdownValue.length >= 5 },
      { id: "cuisines_10", label: "10 cuisines explored", emoji: "🌎", confetti: false, unlocked: cuisineBreakdownValue.length >= 10 },
      { id: "home_meals_10", label: "10 home-cooked meals", emoji: "🍳", confetti: false, unlocked: cookingRatioValue.home_count >= 10 },
      { id: "cities_2", label: "Eating in 2+ cities", emoji: "✈️", confetti: false, unlocked: geographicRangeValue.count >= 2 },
    ]

    const newMilestones = candidates
      .filter((milestone) => milestone.unlocked && !seenIds.has(milestone.id))
      .map(({ id, label, emoji, confetti }) => ({ id, label, emoji, confetti }))

    if (newMilestones.length > 0) {
      const { error: upsertError } = await supabase.from('milestones_seen').upsert(
        newMilestones.map((m) => ({ milestone: m.id })),
        { onConflict: 'user_id,milestone', ignoreDuplicates: true },
      )

      if (upsertError) {
        console.error("Failed to persist milestones", upsertError)
        return jsonResponse({ insights, newMilestones: [] }, origin)
      }
    }

    return jsonResponse({ insights, newMilestones }, origin)
  } catch (error) {
    console.error("Unhandled error", error)
    return jsonResponse({ insights: null, newMilestones: [], error: "api_error" }, origin, 500)
  }
})
