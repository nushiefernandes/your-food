import "@supabase/functions-js/edge-runtime.d.ts"

const IS_DEV = Deno.env.get("ENV") === "development"
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGIN") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
if (IS_DEV) ALLOWED_ORIGINS.push("http://localhost:5173", "http://localhost:4173")
const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY") || ""

const PLACES_API_BASE = "https://places.googleapis.com/v1/places"
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

// Per-user rate limiting (in-memory, resets on cold start)
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

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

type RequestType = "nearby" | "autocomplete" | "details"
const VALID_TYPES: RequestType[] = ["nearby", "autocomplete", "details"]

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || ""

  if (ALLOWED_ORIGINS.length === 0) {
    console.error("ALLOWED_ORIGIN not set — refusing request.")
    return jsonResponse({ error: "api_error" }, origin, 500)
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, origin, 405)
  }

  const start = Date.now()

  try {
    // Auth: Supabase verify_jwt (enabled by default) validates the token at the gateway.
    // This decode extracts sub for rate-limiting only — not for auth.
    const authHeader = req.headers.get("authorization") || ""
    const token = authHeader.replace("Bearer ", "")
    let userId = ""
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]))
        userId = payload.sub || ""
      } catch {
        return jsonResponse({ error: "unauthorized" }, origin, 401)
      }
    }
    if (!userId) {
      return jsonResponse({ error: "unauthorized" }, origin, 401)
    }

    if (!checkRateLimit(userId)) {
      return jsonResponse({ error: "rate_limited" }, origin, 429)
    }

    const body = await req.json()
    const type = body?.type as string

    if (!VALID_TYPES.includes(type as RequestType)) {
      return jsonResponse({ error: "invalid_type" }, origin, 400)
    }

    let result: Record<string, unknown>

    if (type === "nearby") {
      result = await handleNearby(body)
    } else if (type === "autocomplete") {
      result = await handleAutocomplete(body)
    } else {
      result = await handleDetails(body)
    }

    const latencyMs = Date.now() - start
    console.log(JSON.stringify({ type, user_id: userId, latency_ms: latencyMs, status: "ok" }))

    return jsonResponse(result, origin)
  } catch (error) {
    const latencyMs = Date.now() - start
    console.error(JSON.stringify({ type: "unknown", latency_ms: latencyMs, error: String(error) }))
    return jsonResponse({ error: "api_error" }, origin, 500)
  }
})

async function handleNearby(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  const radius = Math.min(Math.max(Number(body.radius) || 100, 50), 500)

  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "invalid_params", places: [] }
  }

  const res = await fetch(`${PLACES_API_BASE}:searchNearby`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius,
        },
      },
      includedTypes: ["restaurant", "cafe", "bar", "bakery", "meal_takeaway"],
      maxResultCount: 10,
    }),
  })

  if (!res.ok) {
    console.error("Google Nearby failed:", res.status)
    return { error: "upstream_error", places: [] }
  }

  const data = await res.json()
  const places = (data.places || []).map((p: Record<string, unknown>) => ({
    google_place_id: p.id,
    name: (p.displayName as Record<string, string>)?.text || "",
    address: p.formattedAddress || "",
    lat: (p.location as Record<string, number>)?.latitude,
    lng: (p.location as Record<string, number>)?.longitude,
  }))

  return { places }
}

async function handleAutocomplete(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const input = String(body.input || "").trim()
  if (!input || input.length > 100) {
    return { error: "invalid_params", predictions: [] }
  }

  const lat = Number(body.lat)
  const lng = Number(body.lng)

  const requestBody: Record<string, unknown> = {
    input,
    includedPrimaryTypes: ["restaurant", "cafe", "bar", "bakery", "meal_takeaway"],
  }

  if (isFinite(lat) && isFinite(lng)) {
    requestBody.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 5000.0,
      },
    }
  }

  const res = await fetch(`${PLACES_API_BASE}:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
    },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    console.error("Google Autocomplete failed:", res.status)
    return { error: "upstream_error", predictions: [] }
  }

  const data = await res.json()
  const predictions = (data.suggestions || []).map((s: Record<string, unknown>) => {
    const pred = s.placePrediction as Record<string, unknown> || {}
    const structured = pred.structuredFormat as Record<string, unknown> || {}
    return {
      google_place_id: pred.placeId,
      name: (structured.mainText as Record<string, string>)?.text || "",
      secondary: (structured.secondaryText as Record<string, string>)?.text || "",
    }
  })

  return { predictions }
}

async function handleDetails(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const placeId = String(body.place_id || "").trim()
  if (!placeId || placeId.length > 100) {
    return { error: "invalid_params" }
  }

  const res = await fetch(`${PLACES_API_BASE}/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
    },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    console.error("Google Details failed:", res.status)
    return { error: "upstream_error" }
  }

  const p = await res.json()
  return {
    place: {
      google_place_id: p.id,
      name: p.displayName?.text || "",
      address: p.formattedAddress || "",
      lat: p.location?.latitude,
      lng: p.location?.longitude,
    },
  }
}
