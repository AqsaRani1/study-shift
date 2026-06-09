// ============================================================
// netlify/functions/gemini-proxy.js
// ============================================================
exports.handler = async function (event) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: CORS, body: "" };

  // GET = health check — open in browser to debug
  if (event.httpMethod === "GET") {
    const key = process.env.GEMINI_API_KEY || "";
    const keySet = key.length > 0;
    const keyOk = key.startsWith("AIza"); // all Gemini keys start with AIza
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        status: keySet ? "ok" : "error",
        key_set: keySet,
        key_valid: keyOk,
        key_hint: keySet
          ? `${key.slice(0, 6)}...${key.slice(-4)} (${key.length} chars)`
          : "NOT SET",
        message: !keySet
          ? "❌ GEMINI_API_KEY not set. Netlify → Site configuration → Environment variables → Add GEMINI_API_KEY"
          : !keyOk
            ? "⚠️ Key is set but does NOT start with AIza — it may be wrong. Gemini keys always start with AIza"
            : "✅ Key looks correct. Function is ready.",
      }),
    };
  }

  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: {
          message:
            "GEMINI_API_KEY not set. Go to Netlify → Site configuration → Environment variables → Add GEMINI_API_KEY",
        },
      }),
    };
  }

  // if (!apiKey.startsWith("AIza")) {
  //   return {
  //     statusCode: 500,
  //     headers: { ...CORS, "Content-Type": "application/json" },
  //     body: JSON.stringify({
  //       error: {
  //         message: `API key looks wrong — Gemini keys always start with "AIza". Your key starts with "${apiKey.slice(0, 6)}". Get a fresh key from aistudio.google.com/apikey`,
  //       },
  //     }),
  //   };
  // }

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

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedBody),
    });
    const text = await res.text();

    // If Gemini returned an error, log it clearly
    if (!res.ok) {
      let errMsg = text;
      try {
        const parsed = JSON.parse(text);
        errMsg = parsed?.error?.message || text;
      } catch (e) {}
      console.error(`Gemini API error ${res.status}:`, errMsg);
    }

    return {
      statusCode: res.status,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { message: `Network error reaching Gemini: ${err.message}` },
      }),
    };
  }
};
