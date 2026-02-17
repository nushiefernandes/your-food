// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || ""

const PROMPT = `You are a food identification expert specializing in Indian cuisine and international dishes commonly eaten in India.

Analyze this food photo and return structured data about the dish.

IMPORTANT RULES:
- Use the local/native name for dishes (e.g., "Paneer Butter Masala" not "Indian cottage cheese curry", "Idli" not "steamed rice cake", "Biryani" not "spiced rice with meat")
- For Indian dishes, use the most commonly recognized name (Hindi/regional transliteration in English)
- If multiple dishes are visible, identify the primary/main dish
- If this is clearly not food, set all confidence values to 0
- For entry_type: "eating_out" if plating/setting suggests restaurant, "home_cooked" if home preparation
- For estimated_cost: estimate in Indian Rupees (₹). For eating_out, restaurant price. For home_cooked, ingredient cost.
- confidence is your certainty from 0.0 to 1.0
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return jsonResponse({ suggestions: null, error: "api_error" })
  }

  try {
    const body = await req.json()
    const photoPath = body?.photoPath

    if (typeof photoPath !== "string" || !isValidPhotoPath(photoPath)) {
      return jsonResponse({ suggestions: null, error: "invalid_path" })
    }

    const storageUrl =
      `${SUPABASE_URL}/storage/v1/object/public/meal-photos/${photoPath}`

    const imageResponse = await fetch(storageUrl)
    if (!imageResponse.ok) {
      console.error("Storage fetch failed", imageResponse.status)
      return jsonResponse({ suggestions: null, error: "api_error" })
    }

    const contentType = imageResponse.headers.get("content-type") ||
      "image/jpeg"
    const arrayBuffer = await imageResponse.arrayBuffer()
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
