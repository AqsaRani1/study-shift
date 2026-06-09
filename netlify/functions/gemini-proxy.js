// ============================================================
// netlify/functions/gemini-proxy.js
// Now powered by Groq (free tier) — drop-in Gemini replacement
// Set GROQ_API_KEY in Netlify environment variables
// Get free key at: https://console.groq.com/keys
// ============================================================
exports.handler = async function (event) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: CORS, body: "" };

  // GET = health check
  if (event.httpMethod === "GET") {
    const key = process.env.GROQ_API_KEY || "";
    const keySet = key.length > 0;
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        status: keySet ? "ok" : "error",
        key_set: keySet,
        key_hint: keySet
          ? `${key.slice(0, 6)}...${key.slice(-4)} (${key.length} chars)`
          : "NOT SET",
        message: !keySet
          ? "❌ GROQ_API_KEY not set. Netlify → Site configuration → Environment variables → Add GROQ_API_KEY"
          : "✅ Key is set. Function is ready.",
      }),
    };
  }

  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const apiKey = (process.env.GROQ_API_KEY || "").trim();

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: {
          message:
            "GROQ_API_KEY not set. Go to Netlify → Site configuration → Environment variables → Add GROQ_API_KEY",
        },
      }),
    };
  }

  // Parse incoming Gemini-format request from app.js
  let parsedBody;
  try {
    parsedBody = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { message: "Invalid JSON in request body" },
      }),
    };
  }

  // Convert Gemini format → Groq/OpenAI format
  const geminiText = parsedBody?.contents?.[0]?.parts?.[0]?.text || "";
  const maxTokens = parsedBody?.generationConfig?.maxOutputTokens || 1024;
  const temperature = parsedBody?.generationConfig?.temperature ?? 0.7;

  const groqBody = {
    model: "llama3-8b-8192",
    messages: [{ role: "user", content: geminiText }],
    max_tokens: maxTokens,
    temperature: temperature,
  };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(groqBody),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`Groq API error ${res.status}:`, data);
      return {
        statusCode: res.status,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: { message: data?.error?.message || "Groq API error" },
        }),
      };
    }

    // Convert Groq response → Gemini response format so app.js works unchanged
    const text = data?.choices?.[0]?.message?.content || "";
    const geminiResponse = {
      candidates: [{ content: { parts: [{ text }] } }],
    };

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify(geminiResponse),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { message: `Network error reaching Groq: ${err.message}` },
      }),
    };
  }
};
