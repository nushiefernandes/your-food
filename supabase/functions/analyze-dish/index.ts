// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"

const IS_DEV = Deno.env.get("ENV") === "development"
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || (IS_DEV ? "*" : "")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || ""
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

const PROMPT = `You are a food identification expert specializing in Indian cuisine and international dishes commonly eaten in India.

Analyze this food photo and return a JSON object with exactly these three fields:

{
  "dish_name": { "value": "<dish name(s), comma-separated if multiple>", "confidence": <0.0-1.0> },
  "cuisine_type": { "value": "<cuisine category>", "confidence": <0.0-1.0> },
  "entry_type": { "value": "eating_out" | "home_cooked", "confidence": <0.0-1.0> }
}

RULES:
- Use the local/native name (e.g. "Paneer Butter Masala", "Idli", "Biryani")
- For Indian dishes, use the most commonly recognized Hindi/regional transliteration
- If multiple dishes are visible, list all identifiable dishes separated by commas (e.g. "Chicken Biryani, Raita, Gulab Jamun")
- entry_type must be exactly "eating_out" or "home_cooked" — judge from plating, background, and presentation
- If this is clearly not food, set all confidence values to 0
- Return ONLY the JSON object, no other text
`

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  })
}

function isValidPhotoPath(photoPath: string): boolean {
  if (photoPath.includes("..") || photoPath.includes("//")) return false
  if (!/^[a-zA-Z0-9._/-]+$/.test(photoPath)) return false
  const pattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\/\d+-[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/
  return pattern.test(photoPath)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function allConfidenceZero(parsed: Record<string, unknown>): boolean {
  const fields = Object.values(parsed)
  if (fields.length === 0) return false
  return fields.every((field) => {
    if (!field || typeof field !== "object") return false
    const confidence = (field as { confidence?: unknown }).confidence
    return typeof confidence === "number" && confidence === 0
  })
}

Deno.serve(async (req) => {
  // Fail-closed CORS: reject non-OPTIONS requests when ALLOWED_ORIGIN is not configured
  if (!ALLOWED_ORIGIN) {
    console.error("ALLOWED_ORIGIN not set — refusing request. Set ENV=development for local dev.")
    return new Response(JSON.stringify({ suggestions: null, error: "api_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return jsonResponse({ suggestions: null, error: "api_error" })
  }

  try {
    // Extract user ID from JWT for ownership check
    const authHeader = req.headers.get("authorization") || ""
    const token = authHeader.replace("Bearer ", "")
    let userId = ""
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]))
        userId = payload.sub || ""
      } catch {
        // JWT decode failed — Supabase verify_jwt handles auth, this is for ownership only
      }
    }

    const body = await req.json()
    const photoPath = body?.photoPath

    if (typeof photoPath !== "string" || !isValidPhotoPath(photoPath)) {
      return jsonResponse({ suggestions: null, error: "invalid_path" })
    }

    // Ownership check: photoPath must start with the authenticated user's ID
    if (userId && !photoPath.startsWith(userId + "/")) {
      console.error("Ownership check failed:", photoPath, "for user", userId)
      return jsonResponse({ suggestions: null, error: "invalid_path" })
    }

    const storageUrl =
      `${SUPABASE_URL}/storage/v1/object/public/meal-photos/${photoPath}`

    const imageResponse = await fetch(storageUrl)
    if (!imageResponse.ok) {
      console.error("Storage fetch failed", imageResponse.status)
      return jsonResponse({ suggestions: null, error: "api_error" })
    }

    // Size limit: reject images larger than 5MB (defense-in-depth; client resizes to ~200KB)
    const contentLength = parseInt(imageResponse.headers.get("content-length") || "0", 10)
    if (contentLength > MAX_IMAGE_BYTES) {
      console.error("Image too large:", contentLength, "bytes")
      return jsonResponse({ suggestions: null, error: "payload_too_large" })
    }

    const contentType = imageResponse.headers.get("content-type") ||
      "image/jpeg"
    const arrayBuffer = await imageResponse.arrayBuffer()

    // Double-check actual size (content-length can be missing or wrong)
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      console.error("Image body too large:", arrayBuffer.byteLength, "bytes")
      return jsonResponse({ suggestions: null, error: "payload_too_large" })
    }
    const base64 = arrayBufferToBase64(arrayBuffer)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const start = Date.now()

    let geminiResponse: Response
    try {
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: PROMPT },
                  {
                    inlineData: {
                      mimeType: contentType,
                      data: base64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 512,
              responseMimeType: "application/json",
            },
          }),
        },
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return jsonResponse({ suggestions: null, error: "timeout" })
      }
      console.error("Gemini fetch failed", error)
      return jsonResponse({ suggestions: null, error: "api_error" })
    } finally {
      clearTimeout(timeoutId)
    }

    const latencyMs = Date.now() - start

    if (!geminiResponse.ok) {
      console.error("Gemini API error", geminiResponse.status)
      return jsonResponse({ suggestions: null, error: "api_error" })
    }

    const geminiJson = await geminiResponse.json()
    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== "string") {
      console.error("Gemini response missing text")
      return jsonResponse({ suggestions: null, error: "api_error" })
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      console.error("Gemini JSON parse failed", error)
      return jsonResponse({ suggestions: null, error: "api_error" })
    }

    if (allConfidenceZero(parsed)) {
      return jsonResponse({ suggestions: null, error: "not_food" })
    }

    return jsonResponse({
      suggestions: parsed,
      model: "gemini-2.5-flash",
      latency_ms: latencyMs,
    })
  } catch (error) {
    console.error("Unhandled error", error)
    return jsonResponse({ suggestions: null, error: "api_error" })
  }
})
