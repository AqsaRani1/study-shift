// ============================================================
// netlify/functions/gemini-proxy.js
// Proxies Google Gemini API calls — key stays server-side
// Health check: GET /.netlify/functions/gemini-proxy
// ============================================================
exports.handler = async function (event) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: CORS, body: "" };

  // Health check — visit this URL in browser to verify key is set
  if (event.httpMethod === "GET") {
    const keySet = !!process.env.GEMINI_API_KEY;
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ok",
        key_set: keySet,
        message: keySet
          ? "✅ GEMINI_API_KEY is set. Function is ready!"
          : "❌ GEMINI_API_KEY not set. Go to Netlify → Site configuration → Environment variables → Add GEMINI_API_KEY",
      }),
    };
  }

  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "GEMINI_API_KEY not set in Netlify environment variables.",
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    // Gemini endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.text();
    return {
      statusCode: res.status,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
