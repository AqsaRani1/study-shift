// ============================================================
// netlify/functions/claude-proxy.js
// Proxies Claude API — key stays server-side in env vars
// Test it: https://yoursite.netlify.app/.netlify/functions/claude-proxy
// ============================================================

exports.handler = async function (event, context) {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  // GET request = health check (visit in browser to test)
  if (event.httpMethod === "GET") {
    const keySet = !!process.env.CLAUDE_API_KEY;
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "ok",
        function: "claude-proxy",
        key_set: keySet,
        message: keySet
          ? "CLAUDE_API_KEY is set. Function is ready."
          : "CLAUDE_API_KEY is NOT set. Go to Netlify → Site configuration → Environment variables → Add CLAUDE_API_KEY",
      }),
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  // Check API key
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: {
          message:
            "CLAUDE_API_KEY not set in Netlify environment variables. Go to: Netlify Dashboard → your site → Site configuration → Environment variables → Add variable → Key: CLAUDE_API_KEY",
        },
      }),
    };
  }

  // Forward to Anthropic
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: event.body,
    });

    const data = await response.text();
    return {
      statusCode: response.status,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: { message: `Proxy error: ${err.message}` },
      }),
    };
  }
};
